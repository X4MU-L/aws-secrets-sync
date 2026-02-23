import * as readline from 'readline';
import rc from 'rc';
import { logger } from './logger';

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
};
