/**
 * AWS Credentials Resolution
 * Handles credential loading with proper priority order
 */

import {
	SecretsManagerClient,
	SecretsManagerClientConfig,
} from '@aws-sdk/client-secrets-manager';
import { fromEnv } from '@aws-sdk/credential-provider-env';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { ConfigContext } from './types';
import { logger } from './logger';

export interface ResolvedCredentials {
	region: string;
	profile?: string;
	accessKeyId?: string;
	secretAccessKey?: string;
	sessionToken?: string;
	accountId?: string;
}

/**
 * Resolve AWS credentials based on context and environment
 * Priority:
 * - CI Mode: environment variables only
 * - Local with .aws-config Profile: use AWS profile
 * - Local with .aws-config explicit creds: use explicit credentials
 * - Fallback: environment variables → AWS SDK default chain
 */
export function resolveCredentials(
	context: ConfigContext | null,
	isCi: boolean = false,
): ResolvedCredentials {
	const config = context?.config;

	// CI Mode: Only use environment variables
	if (isCi) {
		logger.debugLog('CI mode: using environment variables');

		const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
		const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
		const sessionToken = process.env.AWS_SESSION_TOKEN;
		const region =
			process.env.AWS_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1';

		if (!accessKeyId || !secretAccessKey) {
			throw new Error(
				'CI mode requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables',
			);
		}

		return {
			region,
			accessKeyId,
			secretAccessKey,
			sessionToken,
		};
	}

	// Local Mode with .aws-config
	if (config) {
		logger.debugLog('Resolving credentials from .aws-config');

		// Priority 1: AWS Profile (most secure)
		if (config.Profile) {
			logger.debugLog('Using AWS Profile:', config.Profile);
			return {
				region: config.Region,
				profile: config.Profile,
				accountId: config.AWS_ACCOUNT_ID,
			};
		}

		// Priority 2: Explicit credentials from config
		if (config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY) {
			logger.debugLog('Using explicit credentials from .aws-config');
			return {
				region: config.Region,
				accessKeyId: config.AWS_ACCESS_KEY_ID,
				secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
				sessionToken: config.AWS_SESSION_TOKEN,
				accountId: config.AWS_ACCOUNT_ID,
			};
		}
	}

	// Priority 3: Environment variables
	const envAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
	const envSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
	const envSessionToken = process.env.AWS_SESSION_TOKEN;
	const envRegion =
		process.env.AWS_DEFAULT_REGION ||
		process.env.AWS_REGION ||
		config?.Region ||
		'us-east-1';

	if (envAccessKeyId && envSecretAccessKey) {
		logger.debugLog('Using credentials from environment variables');
		return {
			region: envRegion,
			accessKeyId: envAccessKeyId,
			secretAccessKey: envSecretAccessKey,
			sessionToken: envSessionToken,
		};
	}

	// Priority 4: Fallback to AWS SDK default credential chain
	// (This will use ~/.aws/credentials, IAM roles, etc.)
	logger.debugLog('Using AWS SDK default credential chain');
	return {
		region: config?.Region || envRegion,
	};
}

/**
 * Create AWS Secrets Manager client with resolved credentials
 */
export function createSecretsManagerClient(
	credentials: ResolvedCredentials,
): SecretsManagerClient {
	const clientConfig: SecretsManagerClientConfig = {
		region: credentials.region,
	};

	// Use AWS Profile
	if (credentials.profile) {
		logger.debugLog('Creating client with AWS Profile:', credentials.profile);
		clientConfig.credentials = fromIni({ profile: credentials.profile });
	}
	// Use explicit credentials
	else if (credentials.accessKeyId && credentials.secretAccessKey) {
		logger.debugLog('Creating client with explicit credentials');
		clientConfig.credentials = {
			accessKeyId: credentials.accessKeyId,
			secretAccessKey: credentials.secretAccessKey,
			...(credentials.sessionToken && {
				sessionToken: credentials.sessionToken,
			}),
		};
	}
	// Use environment variables
	else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
		logger.debugLog('Creating client with environment credentials');
		clientConfig.credentials = fromEnv();
	}
	// Otherwise, let AWS SDK use default chain

	return new SecretsManagerClient(clientConfig);
}

/**
 * Validate credentials by making a test AWS call
 */
export async function validateCredentials(
	client: SecretsManagerClient,
): Promise<{ accountId: string; arn: string }> {
	try {
		// Use STS GetCallerIdentity to validate
		const { STSClient, GetCallerIdentityCommand } =
			await import('@aws-sdk/client-sts');
		const stsClient = new STSClient({
			region: client.config.region as string,
			credentials: client.config.credentials,
		});

		const response = await stsClient.send(new GetCallerIdentityCommand({}));

		if (!response.Account || !response.Arn) {
			throw new Error('Invalid AWS credentials response');
		}

		logger.debugLog('Credentials validated for account:', response.Account);

		return {
			accountId: response.Account,
			arn: response.Arn,
		};
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		logger.error('Failed to validate AWS credentials:', err);
		throw new Error(
			'Invalid AWS credentials. Please check your configuration or environment variables.',
		);
	}
}

export default {
	resolveCredentials,
	createSecretsManagerClient,
	validateCredentials,
};
