/**
 * AWS Secrets Manager configuration stored in .aws-config
 */
export interface AwsConfig {
	Name: string;
	Description: string;
	Region: string;
	Profile?: string;
	AWS_ACCESS_KEY_ID?: string;
	AWS_SECRET_ACCESS_KEY?: string;
	AWS_SESSION_TOKEN?: string;
	AWS_ACCOUNT_ID?: string;
	ProjectRoot?: string;
	CreatedAt?: string;
	UpdatedAt?: string;
}

/**
 * Organization-level AWS configuration stored in .aws-org-config.json
 */
export interface AwsOrgConfig {
	OrganizationName?: string;
	DefaultRegion?: string;
	DefaultProfile?: string;
	CreatedAt?: string;
}

/**
 * Secrets registry stored in .secretsrc
 */
export interface SecretsRcConfig {
	Name?: string;
	Description?: string;
	LIST_OF_SECRETS: string[];
	CreatedAt?: string;
}

/**
 * Secret payload for creation/update
 */
export interface Config {
	Name: string;
	Description: string;
	SecretString: string;
}

/**
 * Parsed secret values (typically from JSON string)
 */
export interface SecretValues {
	[key: string]: string | number | boolean;
}

/**
 * Merge strategy for secret updates
 * 'partial': preserve existing fields not in incoming payload (default, safe)
 * 'override': replace entire secret with incoming payload (destructive)
 */
export type MergeStrategy = 'partial' | 'override';

/**
 * CLI flags and options
 */
export interface CLIFlags {
	ci?: boolean;
	override?: boolean;
	stage?: string;
	help?: boolean;
	debug?: boolean;
	interactive?: boolean;
	[key: string]: string | boolean | undefined;
}

/**
 * Parsed CLI command and arguments
 */
export interface ParsedCLI {
	command?: string;
	args: string[];
	flags: CLIFlags;
}

/**
 * Configuration context - where configs are located and which is active
 */
export interface ConfigContext {
	projectRoot: string;
	configPath: string;
	orgConfigPath: string;
	secretsRcPath: string;
	hasConfig: boolean;
	config?: AwsConfig;
	orgConfig?: AwsOrgConfig;
	secretsRc?: SecretsRcConfig;
	isCi: boolean;
	isGit?: boolean;
}

/**
 * Secret manager function factory - core operations
 */
export interface SecretManagerFunctionFactory {
	createOrUpdateSecret: (
		stage?: string,
		mergeStrategy?: MergeStrategy,
	) => Promise<void>;
	createLocalEnvironment: (stage?: string) => Promise<void>;
	getSecretValues?: (secretId: string) => Promise<SecretValues>;
	mergeSecretValues?: (
		existing: SecretValues,
		incoming: SecretValues,
		strategy?: MergeStrategy,
	) => SecretValues;
}
