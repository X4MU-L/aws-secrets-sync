#!/usr/bin/env node

import fs from 'fs';

import secretsManagerFunctionFactory from './secrets-manager';
import { logger } from './logger';
import { CLIFlags, ParsedCLI, MergeStrategy } from './types';
import { configureInteractive } from './configure';
import { initializeConfig, requireConfig } from './initialize';
import {
	resolveCredentials,
	createSecretsManagerClient,
	validateCredentials,
} from './credentials-resolver';
import {
	showHelp,
	isCiEnvironment,
	loadFromEnvFile,
	checkUnsetSecrets,
} from './utils';

/**
 * Parse command-line arguments and flags
 */
function parseCliArgs(args: string[]): ParsedCLI {
	const command = args[0];
	const restArgs = args.slice(1);

	const flags: CLIFlags = {};
	const positionalArgs: string[] = [];

	restArgs.forEach((arg) => {
		if (arg.startsWith('--')) {
			const [key, value] = arg.slice(2).split('=');
			flags[key] = value === undefined ? true : value;
		} else if (arg.startsWith('-')) {
			const key = arg.slice(1);
			flags[key] = true;
		} else {
			positionalArgs.push(arg);
		}
	});

	return {
		command,
		args: positionalArgs,
		flags,
	};
}

/**
 * Main CLI handler
 */
export async function cli(args: string[]): Promise<void> {
	const parsed = parseCliArgs(args.slice(2));
	const { command, flags } = parsed;

	// Enable debug logging if requested
	if (flags.debug) {
		logger.setDebug(true);
	}

	// Help command
	if (!command || flags.help) {
		showHelp();
		return;
	}

	try {
		switch (command) {
			case 'configure': {
				logger.info('Starting AWS Sync DotEnv configuration...');
				await configureInteractive();
				break;
			}

			case 'createOrUpdateSecret': {
				const stage = flags.stage || parsed.args[0] || 'dev';
				const mergeStrategy = (
					flags.override ? 'override' : 'partial'
				) as MergeStrategy;
				const ci = isCiEnvironment(flags);

				logger.debugLog('Creating or updating secret', {
					stage,
					mergeStrategy,
					ci,
				});

				// Resolve configuration (null if CI mode without config)
				const context =
					ci && !flags.interactive
						? null
						: await requireConfig(process.cwd(), flags);

				// Resolve AWS credentials
				const credentials = resolveCredentials(context, ci);
				logger.debugLog('Resolved credentials', {
					region: credentials.region,
					hasProfile: !!credentials.profile,
					hasExplicitCreds: !!(
						credentials.accessKeyId && credentials.secretAccessKey
					),
					hasSessionToken: !!credentials.sessionToken,
				});

				// Create AWS Secrets Manager client
				const secretsManager = createSecretsManagerClient(credentials);

				// Validate credentials (optional but recommended)
				if (!ci) {
					const identity = await validateCredentials(secretsManager);
					logger.info(`✓ Using AWS Account: ${identity.accountId}`);

					// Check if account matches expected (if configured)
					if (
						context?.config?.AWS_ACCOUNT_ID &&
						identity.accountId !== context.config.AWS_ACCOUNT_ID
					) {
						logger.warn(
							`Account mismatch! Expected: ${context.config.AWS_ACCOUNT_ID}, Got: ${identity.accountId}`,
						);
					}
				}

				// Warn about LIST_OF_SECRETS entries missing from process.env
				const shouldProceed = await checkUnsetSecrets('secrets', flags);
				if (!shouldProceed) {
					process.exit(1);
				}

				const secretString = await loadFromEnvFile(undefined, 'secrets', flags);
				const config = {
					Name: context?.config?.Name || process.env.AWS_SECRET_NAME || 'app',
					Description: context?.config?.Description || 'Application secrets',
					SecretString: secretString,
				};

				const { createOrUpdateSecret } = secretsManagerFunctionFactory(
					secretsManager,
					fs,
					config,
				);

				await createOrUpdateSecret(stage, mergeStrategy);
				break;
			}

			case 'createLocalEnvironment': {
				const stage = flags.stage || parsed.args[0] || 'dev';
				const ci = isCiEnvironment(flags);

				logger.debugLog('Creating local environment', {
					stage,
					ci,
				});

				// Resolve configuration
				const context =
					ci && !flags.interactive
						? null
						: await requireConfig(process.cwd(), flags);

				// Resolve AWS credentials
				const credentials = resolveCredentials(context, ci);

				// Create AWS Secrets Manager client
				const secretsManager = createSecretsManagerClient(credentials);

				const config = {
					Name: context?.config?.Name || process.env.AWS_SECRET_NAME || 'app',
					Description: context?.config?.Description || 'Application secrets',
					SecretString: '', // Not used for fetch operations
				};

				const { createLocalEnvironment } = secretsManagerFunctionFactory(
					secretsManager,
					fs,
					config,
				);

				await createLocalEnvironment(stage);
				break;
			}

			default: {
				logger.error(`Unknown command: ${command}`);
				showHelp();
				process.exit(1);
			}
		}
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		logger.error(err.message);
		if (flags.debug) {
			logger.error('Stack trace:', err);
		}
		process.exit(1);
	}
}

function createAwsSecretManager(
	secretName: string = 'secrets',
	description: string = 'Application secrets',
) {
	// resolve AWS credentials
	const credentials = resolveCredentials(null, true);

	// create AWS Secrets Manager client
	const secretsManager = createSecretsManagerClient(credentials);

	// config for secrets manager functions
	const config = {
		Name: secretName,
		Description: description,
		SecretString: '',
	};

	const factory = secretsManagerFunctionFactory(secretsManager, fs, config);

	return {
		createOrUpdateSecret: async (
			stage?: string,
			mergeStrategy?: MergeStrategy,
		) => {
			config.SecretString = await loadFromEnvFile(undefined, secretName, {
				ci: true,
			});
			return factory.createOrUpdateSecret(stage, mergeStrategy);
		},
		createLocalEnvironment: factory.createLocalEnvironment,
		getSecretValues: factory.getSecretValues,
		mergeSecretValues: factory.mergeSecretValues,
	};
}
// Export for programmatic use
export { configureInteractive, initializeConfig, requireConfig };
export { mergeSecretValues } from './secrets-manager';
export { logger } from './logger';

export default createAwsSecretManager;
