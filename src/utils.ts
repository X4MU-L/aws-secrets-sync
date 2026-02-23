import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import rc from 'rc';
import { logger } from './logger';
import type { SecretsRcConfig } from './types';

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
			? `${question} [${defaultValue}]: `
			: `${question}: `;

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
export function getEnvConfig(secretName: string): string {
	const config = rc(secretName);

	const secretValues = config.LIST_OF_SECRETS.reduce(
		(acc: Record<string, string>, key: string) => {
			if (process.env[key] !== undefined) {
				acc[key] = process.env[key]!;
			} else {
				logger.warn(`Environment variable ${key} not found`);
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
		(envVar) => process.env[envVar] === 'true' || process.env[envVar] === 'yes',
	);
}

export async function loadFromEnvFile(
	envFilePath?: string,
	secretName: string = 'secrets',
	flags: { ci?: boolean; interactive?: boolean } = {},
	acceptDefaults: boolean = true,
): Promise<string> {
	const config = rc(secretName);
	if (typeof config !== 'object' || config === null) {
		throw new Error(
			`Invalid configuration for create .${secretName}rc in root folder\n
       visit https://github.com/x4mu-l/aws-sync-dotenv#readme for setup instructions
      `,
		);
	}
	const ignoreKeys: string[] = (config.IGNORE_KEYS as string[]) || [];
	const existingSecrets: string[] = (config.LIST_OF_SECRETS as string[]) || [];
	const isNpm = isNpmScript();

	if (isCiEnvironment(flags)) {
		return getEnvConfig(secretName);
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
		logger.warn(`Could not read .env file at ${filePath}`);
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
			!isCiEnvironment(flags) && (flags.interactive === true || !isNpm);

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

	const unsetKeys = listOfSecrets.filter((key) => {
		const value = process.env[key];
		return !value || value.trim() === '';
	});

	if (unsetKeys.length === 0) return true;

	logger.warn(
		'\nThe following secrets from .secretsrc are not set in your environment:',
	);
	unsetKeys.forEach((key) => logger.warn(`   - ${key}`));

	const shouldContinue = await promptYesNo(
		'\nDo you want to continue anyway?',
		false,
	);

	if (!shouldContinue) {
		logger.error('❌ Operation cancelled.');
		return false;
	}

	return true;
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
};
