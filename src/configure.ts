/**
 * Interactive configuration setup for aws-sync-dotenv
 * Guides users through creating .aws-config, .aws-org-config.json, and .secretsrc
 */

import { AwsConfig, AwsOrgConfig, SecretsRcConfig } from './types';
import { logger } from './logger';
import {
	getProjectRoot,
	generateProjectName,
	isGitRepository,
	writeConfigToFile,
	updateGitignore,
} from './config-manager';
import { prompt, promptYesNo } from './utils';

/**
 * Interactive configure command
 */
export async function configureInteractive(
	startPath: string = process.cwd(),
): Promise<void> {
	try {
		logger.log('AWS Sync DotEnv Configuration Setup');
		logger.log('');

		// Determine project root
		const projectRoot = getProjectRoot(startPath);
		const isGit = isGitRepository(projectRoot.path);
		const defaultProjectName = generateProjectName(projectRoot.path);

		logger.info(`Project Root: ${projectRoot.path}`);
		logger.info(`Git Repository: ${isGit ? 'Yes' : 'No'}`);

		// Collect AWS configuration
		logger.info('AWS Configuration');
		const projectName = await prompt(
			'Project Name (used as secret prefix)',
			defaultProjectName,
		);

		const description = await prompt(
			'Project Description',
			`AWS secrets for ${projectName}`,
		);

		const region = await prompt('AWS Region', 'us-east-1');

		logger.log('');
		logger.log('Choose authentication method:');
		logger.log('  1. AWS Profile (recommended - uses ~/.aws/credentials)');
		logger.log('  2. Explicit credentials (store access keys in .aws-config)');
		logger.log('  3. Environment variables only (no config storage)');
		logger.log('');

		const authMethod = await prompt('Select method (1/2/3)', '1');

		let profile: string | undefined;
		let accessKeyId: string | undefined;
		let secretAccessKey: string | undefined;
		let sessionToken: string | undefined;
		let accountId: string | undefined;

		if (authMethod === '1') {
			// AWS Profile
			profile = await prompt(
				'AWS Profile name (leave blank for "default")',
				'default',
			);
			if (profile === 'default' || !profile) {
				profile = undefined; // Use default profile
			}
		} else if (authMethod === '2') {
			// Explicit credentials
			logger.warn('Credentials will be stored in .aws-config');
			logger.warn('Make sure .aws-config is in .gitignore!');
			logger.log('');

			accessKeyId = await prompt('AWS Access Key ID', '');
			secretAccessKey = await prompt('AWS Secret Access Key', '');

			const isTemporary = accessKeyId.startsWith('ASIA');
			if (isTemporary) {
				sessionToken = await prompt(
					'AWS Session Token (required for temporary creds)',
					'',
				);
			} else {
				sessionToken = await prompt(
					'AWS Session Token (optional, press Enter to skip)',
					'',
				);
			}

			accountId = await prompt('AWS Account ID (optional)', '');
		}
		// Method 3: Environment variables only - no storage needed

		logger.log('');

		// Create AWS config
		const awsConfig: AwsConfig = {
			Name: projectName,
			Description: description,
			Region: region,
			...(profile && { Profile: profile }),
			...(accessKeyId && { AWS_ACCESS_KEY_ID: accessKeyId }),
			...(secretAccessKey && { AWS_SECRET_ACCESS_KEY: secretAccessKey }),
			...(sessionToken && { AWS_SESSION_TOKEN: sessionToken }),
			...(accountId && { AWS_ACCOUNT_ID: accountId }),
			ProjectRoot: projectRoot.path,
		};

		// Optionally collect organization config
		logger.info('Organization Configuration (optional)');
		const addOrgConfig = await promptYesNo(
			'Add organization-level config?',
			false,
		);

		let orgConfig: AwsOrgConfig | undefined;
		if (addOrgConfig) {
			const orgName = await prompt('Organization Name', '');
			const defaultOrgRegion = await prompt('Default Org Region', region);
			const defaultOrgProfile = await prompt(
				'Default Org Profile',
				profile || '',
			);

			orgConfig = {
				OrganizationName: orgName || undefined,
				DefaultRegion: defaultOrgRegion,
				DefaultProfile: defaultOrgProfile || undefined,
			};
		}

		logger.log('');

		// Create secrets registry
		const secretsRc: SecretsRcConfig = {
			Name: projectName,
			Description: description,
			LIST_OF_SECRETS: [],
		};

		// Write config files
		logger.info('Writing configuration files...');
		const rcFileCreated = await writeConfigToFile(
			projectRoot.path,
			awsConfig,
			orgConfig,
			secretsRc,
		);

		// Update gitignore if git repo
		if (isGit) {
			logger.info('Updating .gitignore...');
			await updateGitignore(projectRoot.path);
		}

		logger.log('Files created:');
		logger.log('  • .aws-config - AWS credentials and region');
		if (addOrgConfig) {
			logger.log('  • .aws-org-config.json - Organization settings');
		}
		if (rcFileCreated) {
			logger.log('  • .secretsrc - Secrets registry');
		}

		if (isGit) {
			logger.info('Also added .aws-config to .gitignore');
		}
		logger.log('');
		logger.success('Configuration setup complete!');
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		logger.error('Configuration setup failed:', err);
		throw err;
	}
}

/**
 * Non-interactive configure (for scripting)
 */
export async function configureNonInteractive(
	projectRoot: string,
	awsConfig: AwsConfig,
	orgConfig?: AwsOrgConfig,
	secretsRc?: SecretsRcConfig,
	ci?: boolean,
): Promise<void> {
	try {
		logger.info('Writing configuration files...');
		await writeConfigToFile(projectRoot, awsConfig, orgConfig, secretsRc);

		if (isGitRepository(projectRoot) && !ci) {
			logger.info('Updating .gitignore...');
			await updateGitignore(projectRoot, ci);
		}

		logger.success('Configuration written successfully!');
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		logger.error('Failed to write configuration:', err);
		throw err;
	}
}

export default {
	configureInteractive,
	configureNonInteractive,
	prompt,
	promptYesNo,
};
