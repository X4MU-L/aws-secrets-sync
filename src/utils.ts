import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import rc from 'rc';
import dotenv from 'dotenv';
import { logger, Color } from './logger';
import type { SecretsRcConfig, CLIFlags, ParsedCLI } from './types';

/**
 * Prompt user for input
 */
export async function prompt(
	question: string,
	defaultValue?: string,
): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		const ques = defaultValue
			? `${Color.Cyan}${question} [${defaultValue}]:${Color.Reset} `
			: `${Color.Cyan}${question}:${Color.Reset} `;

		rl.question(ques, (answer: string) => {
			rl.close();
			resolve(answer || defaultValue || '');
		});
	});
}

/**
 * Prompt user for yes/no choice
 */
export async function promptYesNo(
	question: string,
	defaultYes: boolean = true,
): Promise<boolean> {
	const choices = defaultYes ? '[Y/n]' : '[y/N]';
	const answer = await prompt(`${question} ${choices}`, defaultYes ? 'y' : 'n');
	return answer.toLowerCase().startsWith('y');
}

/**
 * Check if running as npm script
 * Note: This is a heuristic, as there's no reliable cross-platform way to detect
 */
export function isNpmScript(): boolean {
	// Checks if the process was started by a package manager lifecycle event
	return Boolean(
		process.env.npm_lifecycle_event || process.env.npm_config_user_agent,
	);
}

/**
 * Get environment variables as config payload
 */
export function getEnvConfig(secretName: string, ci: boolean = false): string {
	const config = rc(secretName);
	if (typeof config?.LIST_OF_SECRETS !== 'object' || config === null) {
		throw new Error(
			`Invalid configuration for create .${secretName}rc in root folder

       visit https://github.com/x4mu-l/aws-secrets-sync#readme for setup instructions
      `,
		);
	}
	const secretValues = config.LIST_OF_SECRETS.reduce(
		(acc: Record<string, string>, key: string) => {
			if (process.env[key] !== undefined) {
				acc[key] = process.env[key]!;
			} else {
				const isNpm = isNpmScript();
				const logFn = isNpm || ci ? logger.warn : logger.info;
				logFn.call(logger, `Environment variable ${key} not found`);
			}
			return acc;
		},
		{},
	);

	return JSON.stringify(secretValues);
}

/**
 * Detect if running in CI environment
 */
export function isCiEnvironment(flags?: { ci?: boolean }): boolean {
	if (flags?.ci === true) {
		return true;
	}

	// Check environment variables
	const ciEnvVars = [
		'CI',
		'CONTINUOUS_INTEGRATION',
		'GITHUB_ACTIONS',
		'GITLAB_CI',
		'BITBUCKET_PIPELINES',
		'CIRCLECI',
		'TRAVIS',
		'JENKINS_URL',
		'BUILDKITE',
		'DRONE',
	];

	return ciEnvVars.some(
		(envVar) =>
			process.env[envVar] === 'true' ||
			process.env[envVar] === 'yes' ||
			process.env[envVar] === '1',
	);
}

export async function loadFromEnvFile(
	envFilePath?: string,
	secretName: string = 'secrets',
	flags: { ci?: boolean; interactive?: boolean } = {},
	acceptDefaults: boolean = true,
): Promise<string> {
	const config = rc(secretName);
	if (typeof config?.LIST_OF_SECRETS !== 'object' || config === null) {
		throw new Error(
			`Invalid configuration for create .${secretName}rc in root folder

       visit https://github.com/x4mu-l/aws-secrets-sync#readme for setup instructions
      `,
		);
	}
	const ignoreKeys: string[] = (config.IGNORE_KEYS as string[]) || [];
	const existingSecrets: string[] = (config.LIST_OF_SECRETS as string[]) || [];
	const isNpm = isNpmScript();
	const isCi = isCiEnvironment(flags);
	if (isCi) {
		// In CI, try to load a .env file into process.env first.
		// dotenv won't override vars already set by the CI system (e.g. GitHub Secrets),
		// so this is safe — it only fills in any gaps.
		const ciEnvPath = envFilePath ?? path.join(process.cwd(), '.env');
		const dotenvResult = dotenv.config({ path: ciEnvPath, override: false });
		if (dotenvResult.error) {
			logger.debugLog(
				`No .env file found at ${ciEnvPath}, using CI environment as-is`,
			);
		} else {
			logger.debugLog(
				`Loaded .env from ${ciEnvPath} into process.env (CI mode)`,
			);
		}
		return getEnvConfig(secretName, isCi);
	}

	if (!isNpm && !acceptDefaults) {
		return getEnvConfig(secretName);
	}

	// Resolve the .env file path
	const filePath = envFilePath ?? path.join(process.cwd(), '.env');

	// Read the .env file
	let content: string;
	try {
		content = fs.readFileSync(filePath, 'utf-8');
	} catch {
		logger.debugLog(`Could not read .env file at ${filePath}`);
		return getEnvConfig(secretName);
	}

	// Resolve .secretsrc path, falling back to cwd
	const secretsRcPath: string = path.join(process.cwd(), '.secretsrc');

	// Parse all valid KEY=VALUE entries, skipping blank lines, comments, and ignored keys
	interface EnvEntry {
		key: string;
		value: string;
	}
	const entries: EnvEntry[] = content
		.split('\n')
		.map((line) => line.trim())
		.filter((trimmed) => Boolean(trimmed) && !trimmed.startsWith('#'))
		.map((trimmed) => trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/))
		.filter((m): m is RegExpMatchArray => m !== null)
		.filter((m) => !ignoreKeys.includes(m[1]))
		.map((m) => ({
			key: m[1],
			// Strip surrounding single or double quotes
			value: m[2].trim().replace(/^(["'])(.*)\1$/, '$2'),
		}));

	// Separate keys already tracked in .secretsrc from newly discovered ones
	const existingEntries = entries.filter(({ key }) =>
		existingSecrets.includes(key),
	);
	const newEntries = entries.filter(
		({ key }) => !existingSecrets.includes(key),
	);
	const newKeys = newEntries.map(({ key }) => key);

	// Always set keys that are already tracked in LIST_OF_SECRETS
	existingEntries.forEach(({ key, value }) => {
		process.env[key] = value;
		logger.debugLog(`Set env var: ${key}`);
	});

	// Handle new keys — prompt in interactive sessions, auto-accept in CI/npm
	if (newKeys.length > 0) {
		// Show prompt when running interactively (not CI, and either --interactive
		// flag is set OR not running as an npm script)
		const shouldPrompt =
			!isCiEnvironment(flags) && (flags.interactive === true || isNpm);

		let confirmed = true;
		if (shouldPrompt) {
			logger.info(
				'\nThe following new keys from .env are not yet tracked in .secretsrc:',
			);
			newKeys.forEach((key) => logger.info(`   - ${key}`));

			confirmed = await promptYesNo(
				'Add these keys to .secretsrc and set them in the environment?',
				true,
			);
		}

		if (confirmed) {
			newEntries.forEach(({ key, value }) => {
				process.env[key] = value;
				logger.debugLog(`Set new env var: ${key}`);
			});

			try {
				if (isNpm) {
					const raw = fs.readFileSync(secretsRcPath, 'utf-8');
					const secretsRc = JSON.parse(raw) as SecretsRcConfig;
					const updated = Array.from(
						new Set([...(secretsRc.LIST_OF_SECRETS ?? []), ...newKeys]),
					);
					secretsRc.LIST_OF_SECRETS = updated;
					fs.writeFileSync(
						secretsRcPath,
						`${JSON.stringify(secretsRc, null, 2)}\n`,
					);
					logger.debugLog(
						`Updated .secretsrc with new keys: ${newKeys.join(', ')}`,
					);
				}
			} catch {
				logger.debugLog('No .secretsrc found, skipping update');
			}
		} else {
			logger.info(
				'Skipping new keys. Only already-tracked secrets will be synced.',
			);
		}
	}

	return getEnvConfig(secretName);
}

/**
 * Check for secrets in LIST_OF_SECRETS that are not set in the environment.
 * In non-CI mode, lists the unset keys and prompts the user to continue.
 * Returns false if the user cancels, true otherwise.
 */
export async function checkUnsetSecrets(
	secretName: string = 'secrets',
	flags: { ci?: boolean; interactive?: boolean } = {},
): Promise<boolean> {
	if (isCiEnvironment(flags)) return true;

	const config = rc(secretName);
	const listOfSecrets: string[] = (config.LIST_OF_SECRETS as string[]) || [];

	const ciEnvPath = path.join(process.cwd(), '.env');
	const dotenvResult = dotenv.config({ path: ciEnvPath, override: false });
	if (dotenvResult.error) {
		logger.debugLog(
			`No .env file found at ${ciEnvPath}, using CI environment as-is`,
		);
	} else {
		logger.debugLog(`Loaded .env from ${ciEnvPath} into process.env (CI mode)`);
	}
	const unsetKeys = listOfSecrets.filter((key) => {
		const value = process.env[key];
		return !value || value.trim() === '';
	});

	if (unsetKeys.length === 0) return true;

	const isNpm = isNpmScript();
	const logFn = logger.warn;
	logFn.call(
		logger,
		`The following keys from .${secretName}rc are not set in the environment:`,
	);
	unsetKeys.forEach((key) => {
		logFn.call(logger, `   - ${key}`);
	});

	const shouldContinue = isNpm
		? true
		: await promptYesNo('\nDo you want to continue anyway?', false);

	if (!shouldContinue) {
		logger.error('❌ Operation cancelled.');
		return false;
	}

	return true;
}

/**
 * Parse command-line arguments and flags.
 * Supports both --key=value and --key value forms.
 * Boolean flags: --flag (no following value or next arg starts with -)
 */
export function parseCliArgs(args: string[]): ParsedCLI {
	interface ParseState {
		flags: CLIFlags;
		positional: string[];
		skip: boolean;
	}

	const state = args.reduce<ParseState>(
		(acc, arg, i) => {
			// This arg was already consumed as the value of the previous flag
			if (acc.skip) return { ...acc, skip: false };

			if (arg.startsWith('--')) {
				const eqIdx = arg.indexOf('=');
				if (eqIdx !== -1) {
					// --key=value
					const key = arg.slice(2, eqIdx);
					const val = arg.slice(eqIdx + 1);
					return { ...acc, flags: { ...acc.flags, [key]: val } };
				}
				const key = arg.slice(2);
				const next = args[i + 1];
				if (next !== undefined && !next.startsWith('-')) {
					// --key value  (consume next token as value)
					return { ...acc, flags: { ...acc.flags, [key]: next }, skip: true };
				}
				// --flag  (boolean)
				return { ...acc, flags: { ...acc.flags, [key]: true } };
			}

			if (arg.startsWith('-')) {
				// -f  (short boolean flag)
				return { ...acc, flags: { ...acc.flags, [arg.slice(1)]: true } };
			}

			return { ...acc, positional: [...acc.positional, arg] };
		},
		{ flags: {}, positional: [], skip: false },
	);

	return {
		command: state.positional[0],
		args: state.positional.slice(1),
		flags: state.flags,
	};
}

/**
 * Show help message
 */
export function showHelp(): void {
	console.log(`
AWS Sync DotEnv - Manage AWS Secrets Manager secrets from environment variables

USAGE:
  aws-sync-dotenv [COMMAND] [OPTIONS]

COMMANDS:
  configure                     Interactive setup of project configuration
  createOrUpdateSecret [STAGE]   Create or update secret in AWS Secrets Manager
  createLocalEnvironment [STAGE] Create local .env file from secret

OPTIONS:
  --stage <name>               Secret stage/environment (default: dev)
  --override                   Force full replacement of existing secret (dangerous)
  --ci                         Run in CI mode (no interactive prompts)
  --debug                      Show debug information
  --help                       Show this help message

EXAMPLES:
  # Initial setup
  aws-sync-dotenv configure

  # Create or update secret (partial merge by default)
  aws-sync-dotenv createOrUpdateSecret --stage prod

  # Full replacement of secret
  aws-sync-dotenv createOrUpdateSecret --stage prod --override

  # Fetch secret and create .env
  aws-sync-dotenv createLocalEnvironment --stage prod

  # CI/CD with no interactive prompts
  aws-sync-dotenv createOrUpdateSecret --stage prod --ci

For more information, visit: https://github.com/aws-sync-dotenv
	`);
}
export default {
	prompt,
	promptYesNo,
	isNpmScript,
	showHelp,
	getEnvConfig,
	checkUnsetSecrets,
	parseCliArgs,
};
