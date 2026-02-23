import * as filesystem from 'fs';

import {
	CreateSecretCommand,
	GetSecretValueCommand,
	SecretsManagerClient,
	UpdateSecretCommand,
} from '@aws-sdk/client-secrets-manager';

import {
	Config,
	SecretManagerFunctionFactory,
	SecretValues,
	MergeStrategy,
} from './types';
import { logger } from './logger';

/**
 * Merge existing secret values with incoming values
 * @param existing - Current secret values
 * @param incoming - New values to apply
 * @param strategy - 'partial' (preserve unspecified) or 'override' (replace all)
 * @returns Merged secret values
 */
export function mergeSecretValues(
	existing: SecretValues,
	incoming: SecretValues,
	strategy: MergeStrategy = 'partial',
): SecretValues {
	if (strategy === 'override') {
		// Full replacement
		logger.debugLog('Using override strategy: replacing all values');
		return incoming;
	}

	// Partial merge: keep existing keys not in incoming, add/update incoming keys
	const merged = { ...existing };

	Object.keys(incoming).forEach((key) => {
		merged[key] = incoming[key];
	});

	logger.debugLog('Merged secret values', {
		existing_keys: Object.keys(existing).length,
		incoming_keys: Object.keys(incoming).length,
		merged_keys: Object.keys(merged).length,
	});

	return merged;
}

/**
 *  Get secret values from AWS Secrets Manager
 * @param secretsManager - AWS SDK client instance
 * @param secretId - ID of the secret to fetch
 * @returns {SecretValues} Parsed secret values
 */
export async function getSecretValues(
	secretsManager: SecretsManagerClient,
	secretId: string,
): Promise<SecretValues> {
	try {
		logger.debugLog('Fetching secret:', secretId);

		const command = new GetSecretValueCommand({ SecretId: secretId });
		const secretData = await secretsManager.send(command);

		if (!secretData.SecretString) {
			throw new Error('Secret has no value');
		}

		const values = JSON.parse(secretData.SecretString);
		logger.debugLog('Retrieved secret with keys:', Object.keys(values).length);

		return values as SecretValues;
	} catch (error) {
		logger.error('Failed to fetch secret:', error as Error);
		throw error;
	}
}

/**
 * Secrets Manager function factory
 * Creates secret operations bound to AWS SDK client and config
 */
const secretsManagerFunctionFactory = (
	secretsManager: SecretsManagerClient,
	fs: typeof filesystem,
	config: Config,
): SecretManagerFunctionFactory => ({
	/**
	 * Create or update secret with intelligent merge strategy
	 */
	createOrUpdateSecret: async (
		stage = 'dev',
		mergeStrategy: MergeStrategy = 'partial',
	): Promise<void> => {
		const secretId = `${config.Name}-${stage}`;

		try {
			logger.debugLog('Attempting to create secret:', secretId);

			const command = new CreateSecretCommand({
				Name: secretId,
				Description: config.Description,
				SecretString: config.SecretString,
			});
			await secretsManager.send(command);

			logger.success('Environment variables saved on AWS Secret Manager!');
		} catch (error) {
			const errorMessage = (error as Error).message;

			if (errorMessage.includes('already exists')) {
				logger.debugLog('Secret already exists, merging values');

				try {
					const existingValues = await getSecretValues(
						secretsManager,
						secretId,
					);
					const incomingValues = JSON.parse(config.SecretString);

					// Merge based on strategy
					const mergedValues = mergeSecretValues(
						existingValues,
						incomingValues,
						mergeStrategy,
					);

					const mergedSecretString = JSON.stringify(mergedValues);

					// Update with merged values
					const updateCommand = new UpdateSecretCommand({
						SecretId: secretId,
						Description: config.Description,
						SecretString: mergedSecretString,
					});
					await secretsManager.send(updateCommand);

					logger.success(
						'Environment variables updated on AWS Secret Manager!',
					);
					logger.debugLog('Update strategy:', mergeStrategy);
				} catch (mergeError) {
					const err =
						mergeError instanceof Error
							? mergeError
							: new Error(String(mergeError));
					logger.error('Failed to merge and update secret:', err);
					throw err;
				}
			} else {
				logger.error('Failed to create secret:', error as Error);
				throw error;
			}
		}
	},

	/**
	 * Fetch secret values from AWS
	 */
	getSecretValues: async (secretId: string): Promise<SecretValues> =>
		getSecretValues(secretsManager, secretId),

	/**
	 * Create local .env file from secret
	 */
	createLocalEnvironment: async (stage = 'dev'): Promise<void> => {
		const secretId = `${config.Name}-${stage}`;

		try {
			logger.debugLog('Fetching secret for local environment:', secretId);

			const environmentVars = await getSecretValues(secretsManager, secretId);
			const envFileContent = Object.keys(environmentVars)
				.map((key) => `${key}=${environmentVars[key]}`)
				.join('\n');

			// add comment at the top of the .env file
			const finalEnvFileContent = `# This .env file was generated from AWS Secrets Manager\n# Secret: ${secretId}\n\n${envFileContent}`;
			fs.writeFileSync('.env', finalEnvFileContent);
			logger.success('The .env file has been written successfully!');
		} catch (error) {
			logger.error('Failed to create local environment:', error as Error);
			throw error;
		}
	},

	/**
	 * Merge secret values helper
	 */
	mergeSecretValues,
});

export default secretsManagerFunctionFactory;
