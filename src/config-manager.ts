/**
 * Configuration management for aws-sync-dotenv
 * Handles creation, reading, validation, and persistence of project configs
 */

import * as fs from 'fs/promises';
import rc from 'rc';
import * as path from 'path';
import { execSync } from 'child_process';
import {
	AwsConfig,
	AwsOrgConfig,
	SecretsRcConfig,
	ConfigContext,
} from './types';
import { logger } from './logger';
import { isCiEnvironment } from './utils';

/**
 * Get the project root directory
 * Priority: git root > current working directory
 */
export function getProjectRoot(startPath: string = process.cwd()): {
	isGit: boolean;
	path: string;
} {
	try {
		const gitRoot = execSync('git rev-parse --show-toplevel', {
			cwd: startPath,
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'ignore'],
		}).trim();

		if (gitRoot) {
			logger.debugLog('Found git root:', gitRoot);
			return { isGit: true, path: gitRoot };
		}
	} catch (error) {
		logger.debugLog('Not a git repository, using cwd');
	}

	return { isGit: false, path: startPath };
}

/**
 * Get repository name from git remote
 * Priority: origin/main > origin/master > first remote > null
 */
export function getRepoRemoteName(projectRoot: string): string | null {
	try {
		// Try to get remote URL
		const remoteUrl = execSync('git config --get remote.origin.url', {
			cwd: projectRoot,
			encoding: 'utf-8',
			stdio: ['pipe', 'pipe', 'ignore'],
		}).trim();

		if (!remoteUrl) {
			logger.debugLog('No git remote found');
			return null;
		}

		// Extract repo name from URL
		// Handles: https://github.com/owner/repo.git or git@github.com:owner/repo.git
		const match = remoteUrl.match(/(?:\/|:)([^/]+)\/([^/]+?)(\.git)?$/);
		if (match && match[2]) {
			const repoName = match[2].replace(/\.git$/, '');
			logger.debugLog('Extracted repo name:', repoName);
			return repoName;
		}
	} catch (error) {
		logger.debugLog('Error getting git remote');
	}

	return null;
}

/**
 * Check if path is a git repository
 */
export function isGitRepository(projectRoot: string): boolean {
	try {
		execSync('git rev-parse --git-dir', {
			cwd: projectRoot,
			stdio: 'ignore',
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Generate project name based on git remote or directory name
 * Priority: git remote name > directory name
 */
export function generateProjectName(projectRoot: string): string {
	// Try to get from git remote
	const remoteName = getRepoRemoteName(projectRoot);
	if (remoteName) {
		return remoteName;
	}

	// Fallback to directory name
	const dirName = path.basename(projectRoot);
	logger.debugLog('Using directory name as project name:', dirName);
	return dirName;
}

/**
 * Find existing AWS config in project root
 */
export async function findExistingConfig(
	projectRoot: string,
): Promise<AwsConfig | null> {
	const configPath = path.join(projectRoot, '.aws-config');

	try {
		const content = await fs.readFile(configPath, 'utf-8');
		const config = JSON.parse(content);
		logger.debugLog('Found existing config at:', configPath);
		return config;
	} catch (error) {
		logger.debugLog('No existing config found');
		return null;
	}
}

/**
 * Validate AWS config structure
 */
export function validateAwsConfig(config: unknown): config is AwsConfig {
	if (typeof config !== 'object' || config === null) {
		return false;
	}

	const cfg = config as Record<string, unknown>;
	return (
		typeof cfg.Name === 'string' &&
		typeof cfg.Description === 'string' &&
		typeof cfg.Region === 'string' &&
		(typeof cfg.Profile === 'string' || cfg.Profile === undefined)
	);
}

/**
 * Write config files to project root
 */
export async function writeConfigToFile(
	projectRoot: string,
	awsConfig: AwsConfig,
	orgConfig?: AwsOrgConfig,
	secretsRc?: SecretsRcConfig,
): Promise<boolean> {
	const timestamp = new Date().toISOString();
	let rcFileCreated = false;
	try {
		// Write .aws-config
		const configPath = path.join(projectRoot, '.aws-config');
		const configWithTimestamp = {
			...awsConfig,
			CreatedAt: awsConfig.CreatedAt || timestamp,
			UpdatedAt: timestamp,
		};
		await fs.writeFile(
			configPath,
			JSON.stringify(configWithTimestamp, null, 2),
		);
		logger.debugLog('Wrote config to:', configPath);

		// Write .aws-org-config.json
		if (orgConfig) {
			const orgConfigPath = path.join(projectRoot, '.aws-org-config.json');
			const orgConfigWithTimestamp = {
				...orgConfig,
				CreatedAt: orgConfig.CreatedAt || timestamp,
			};
			await fs.writeFile(
				orgConfigPath,
				JSON.stringify(orgConfigWithTimestamp, null, 2),
			);
			logger.debugLog('Wrote org config to:', orgConfigPath);
		}

		// Write .secretsrc
		if (secretsRc) {
			const secretsRcPath = path.join(projectRoot, '.secretsrc');
			const config = rc('secrets');

			const secretsRcWithTimestamp = {
				...secretsRc,
				CreatedAt: secretsRc.CreatedAt || timestamp,
			};

			if (typeof config?.LIST_OF_SECRETS !== 'object') {
				await fs.writeFile(
					secretsRcPath,
					JSON.stringify(secretsRcWithTimestamp, null, 2),
				);
				rcFileCreated = true;
				logger.debugLog('Wrote secrets rc to:', secretsRcPath);
			}
		}
		return rcFileCreated;
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		logger.error('Failed to write config files:', err);
		throw err;
	}
}

/**
 * Update .gitignore to include .aws-config
 */
export async function updateGitignore(
	projectRoot: string,
	ci: boolean = false,
): Promise<void> {
	if (!isGitRepository(projectRoot)) {
		logger.debugLog('Not a git repo, skipping .gitignore update');
		return;
	}
	if (ci || isCiEnvironment()) {
		logger.debugLog('CI environment, skipping .gitignore update');
		return;
	}

	const gitignorePath = path.join(projectRoot, '.gitignore');
	const entryToAdd = '.aws-config';

	try {
		let content = '';

		// Try to read existing .gitignore
		try {
			content = await fs.readFile(gitignorePath, 'utf-8');
		} catch {
			// File doesn't exist, start with empty content
			content = '';
		}

		// Check if entry already exists
		if (content.includes(entryToAdd)) {
			logger.debugLog('.aws-config already in .gitignore');
			return;
		}

		// Append entry
		const newContent = content.endsWith('\n')
			? `${content}${entryToAdd}\n`
			: `${content}\n${entryToAdd}\n`;

		await fs.writeFile(gitignorePath, newContent);
		logger.debugLog('Added .aws-config to .gitignore');
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		logger.warn(`Failed to update .gitignore: ${err.message}`);
		// Don't throw - this is not critical
	}
}

/**
 * Load configuration context for a project
 */
export async function loadConfigContext(
	projectRoot: { isGit: boolean; path: string },
	isCi: boolean = false,
): Promise<ConfigContext> {
	const configPath = path.join(projectRoot.path, '.aws-config');
	const orgConfigPath = path.join(projectRoot.path, '.aws-org-config.json');
	const secretsRcPath = path.join(projectRoot.path, '.secretsrc');

	let config: AwsConfig | undefined;
	let orgConfig: AwsOrgConfig | undefined;
	let secretsRc: SecretsRcConfig | undefined;

	// Load config files if they exist
	try {
		const configContent = await fs.readFile(configPath, 'utf-8');
		config = JSON.parse(configContent);
	} catch {
		// Config doesn't exist
	}

	try {
		const orgConfigContent = await fs.readFile(orgConfigPath, 'utf-8');
		orgConfig = JSON.parse(orgConfigContent);
	} catch {
		// Org config doesn't exist
	}

	try {
		const secretsRcContent = await fs.readFile(secretsRcPath, 'utf-8');
		secretsRc = JSON.parse(secretsRcContent);
	} catch {
		// Secrets rc doesn't exist
	}

	return {
		projectRoot: projectRoot.path,
		configPath,
		orgConfigPath,
		secretsRcPath,
		hasConfig: config !== undefined,
		config,
		orgConfig,
		secretsRc,
		isCi,
		isGit: projectRoot.isGit,
	};
}

export default {
	getProjectRoot,
	getRepoRemoteName,
	isGitRepository,
	generateProjectName,
	findExistingConfig,
	validateAwsConfig,
	writeConfigToFile,
	updateGitignore,
	loadConfigContext,
};
