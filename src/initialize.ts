/**
 * Initialization and validation logic
 * Handles config detection, CI mode, and auto-configure prompts
 */

import { ConfigContext } from './types';
import { logger } from './logger';
import { loadConfigContext, getProjectRoot } from './config-manager';
import { configureInteractive } from './configure';
import { promptYesNo, isNpmScript, isCiEnvironment } from './utils';

/**
 * Initialize configuration and ensure it exists
 * Handles auto-configure for non-CI environments
 */
export async function initializeConfig(
	startPath: string = process.cwd(),
	flags: { ci?: boolean; interactive?: boolean } = {},
): Promise<ConfigContext> {
	const ci = isCiEnvironment(flags);
	const projectRoot = getProjectRoot(startPath);
	const isNpm = isNpmScript();

	logger.debugLog('Initializing configuration', {
		projectRoot,
		ci,
		npm_script: isNpmScript(),
	});

	// Load existing config
	const context = await loadConfigContext(projectRoot, ci);

	// If config exists, return immediately
	if (isNpm && context.hasConfig) {
		logger.debugLog('Configuration found');
		return context;
	}

	logger.debugLog('Configuration not found');

	// If CI mode, require config to exist
	if (ci) {
		throw new Error(
			`Configuration required in CI mode. ` +
				`Please run 'aws-sync-dotenv configure' locally first, ` +
				`then commit .aws-config to your repository (or add via CI/CD secrets).`,
		);
	}

	// If not interactive flag explicitly set to false, don't prompt
	if (flags?.interactive === false) {
		throw new Error(
			`Configuration not found at ${context.configPath}. ` +
				`Run 'aws-sync-dotenv configure' to set up your project.`,
		);
	}

	// Prompt user to configure
	logger.warn('Configuration not found');
	const shouldConfigure = await promptYesNo(
		'Would you like to configure now?',
		true,
	);

	if (shouldConfigure) {
		await configureInteractive(projectRoot.path);
		// Reload config after configuration
		return loadConfigContext(projectRoot, ci);
	}

	throw new Error(
		`Cannot proceed without configuration. ` +
			`Run 'aws-sync-dotenv configure' when ready.`,
	);
}

/**
 * Ensure config exists, load it, and return context
 * Throws if config doesn't exist and can't be created
 */
export async function requireConfig(
	startPath: string = process.cwd(),
	flags: { ci?: boolean } = {},
): Promise<ConfigContext> {
	const ci = isCiEnvironment(flags);
	const projectRoot = getProjectRoot(startPath);
	const context = await loadConfigContext(projectRoot, ci);
	const isNpm = isNpmScript();

	if (!isNpm) {
		logger.debugLog(
			'Possiblely running outside of npm script. Skipping config existence check.',
		);
		return context;
	}

	if (!context.hasConfig) {
		if (ci) {
			return context; // Let CI handle missing config as needed
		}

		throw new Error(
			`Configuration not found. ` +
				`Run 'aws-sync-dotenv configure' to set up your project.`,
		);
	}

	return context;
}

/**
 * Get AWS credentials from context or environment
 */
export function getAwsCredentials(context: ConfigContext): {
	region: string;
	profile?: string;
} {
	if (!context.config) {
		throw new Error('No configuration loaded');
	}

	return {
		region: context.config.Region,
		profile: context.config.Profile,
	};
}

export default {
	initializeConfig,
	requireConfig,
	getAwsCredentials,
};
