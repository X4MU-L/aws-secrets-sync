import {
	resolveCredentials,
	createSecretsManagerClient,
} from '../credentials-resolver';
import { ConfigContext, AwsConfig } from '../types';

describe('credentials-resolver', () => {
	const originalEnv = process.env;

	beforeEach(() => {
		jest.resetModules();
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe('resolveCredentials', () => {
		describe('CI Mode', () => {
			it('should use environment variables in CI mode', () => {
				process.env.AWS_ACCESS_KEY_ID = 'AKIA_CI_KEY';
				process.env.AWS_SECRET_ACCESS_KEY = 'ci_secret';
				process.env.AWS_SESSION_TOKEN = 'ci_token';
				process.env.AWS_DEFAULT_REGION = 'us-west-2';

				const credentials = resolveCredentials(null, true);

				expect(credentials).toEqual({
					region: 'us-west-2',
					accessKeyId: 'AKIA_CI_KEY',
					secretAccessKey: 'ci_secret',
					sessionToken: 'ci_token',
				});
			});

			it('should use AWS_REGION if AWS_DEFAULT_REGION not set', () => {
				process.env.AWS_ACCESS_KEY_ID = 'AKIA_KEY';
				process.env.AWS_SECRET_ACCESS_KEY = 'secret';
				process.env.AWS_REGION = 'eu-west-1';

				const credentials = resolveCredentials(null, true);

				expect(credentials.region).toBe('eu-west-1');
			});

			it('should default to us-east-1 if no region set', () => {
				process.env.AWS_ACCESS_KEY_ID = 'AKIA_KEY';
				process.env.AWS_SECRET_ACCESS_KEY = 'secret';
				delete process.env.AWS_DEFAULT_REGION;
				delete process.env.AWS_REGION;

				const credentials = resolveCredentials(null, true);

				expect(credentials.region).toBe('us-east-1');
			});

			it('should throw error if credentials missing in CI', () => {
				delete process.env.AWS_ACCESS_KEY_ID;
				delete process.env.AWS_SECRET_ACCESS_KEY;

				expect(() => resolveCredentials(null, true)).toThrow(
					'CI mode requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY',
				);
			});
		});

		describe('Local Mode with Config', () => {
			it('should use AWS Profile from config', () => {
				const config: AwsConfig = {
					Name: 'test-project',
					Description: 'Test',
					Region: 'us-east-1',
					Profile: 'my-profile',
				};

				const context: ConfigContext = {
					projectRoot: '/project',
					configPath: '/project/.aws-config',
					orgConfigPath: '/project/.aws-org-config.json',
					secretsRcPath: '/project/.secretsrc',
					hasConfig: true,
					config,
					isCi: false,
				};

				const credentials = resolveCredentials(context, false);

				expect(credentials).toEqual({
					region: 'us-east-1',
					profile: 'my-profile',
					accountId: undefined,
				});
			});

			it('should use explicit credentials from config', () => {
				const config: AwsConfig = {
					Name: 'test-project',
					Description: 'Test',
					Region: 'us-east-1',
					AWS_ACCESS_KEY_ID: 'AKIA_FROM_CONFIG',
					AWS_SECRET_ACCESS_KEY: 'secret_from_config',
					AWS_SESSION_TOKEN: 'token_from_config',
					AWS_ACCOUNT_ID: '123456789012',
				};

				const context: ConfigContext = {
					projectRoot: '/project',
					configPath: '/project/.aws-config',
					orgConfigPath: '/project/.aws-org-config.json',
					secretsRcPath: '/project/.secretsrc',
					hasConfig: true,
					config,
					isCi: false,
				};

				const credentials = resolveCredentials(context, false);

				expect(credentials).toEqual({
					region: 'us-east-1',
					accessKeyId: 'AKIA_FROM_CONFIG',
					secretAccessKey: 'secret_from_config',
					sessionToken: 'token_from_config',
					accountId: '123456789012',
				});
			});

			it('should prefer Profile over explicit credentials', () => {
				const config: AwsConfig = {
					Name: 'test-project',
					Description: 'Test',
					Region: 'us-east-1',
					Profile: 'my-profile',
					AWS_ACCESS_KEY_ID: 'AKIA_IGNORED',
					AWS_SECRET_ACCESS_KEY: 'ignored',
				};

				const context: ConfigContext = {
					projectRoot: '/project',
					configPath: '/project/.aws-config',
					orgConfigPath: '/project/.aws-org-config.json',
					secretsRcPath: '/project/.secretsrc',
					hasConfig: true,
					config,
					isCi: false,
				};

				const credentials = resolveCredentials(context, false);

				expect(credentials.profile).toBe('my-profile');
				expect(credentials.accessKeyId).toBeUndefined();
			});
		});

		describe('Fallback to Environment Variables', () => {
			it('should use env vars when no config', () => {
				process.env.AWS_ACCESS_KEY_ID = 'AKIA_FROM_ENV';
				process.env.AWS_SECRET_ACCESS_KEY = 'secret_from_env';
				process.env.AWS_DEFAULT_REGION = 'ap-southeast-1';

				const credentials = resolveCredentials(null, false);

				expect(credentials).toEqual({
					region: 'ap-southeast-1',
					accessKeyId: 'AKIA_FROM_ENV',
					secretAccessKey: 'secret_from_env',
					sessionToken: undefined,
				});
			});

			it('should use env vars when config has no credentials', () => {
				process.env.AWS_ACCESS_KEY_ID = 'AKIA_FROM_ENV';
				process.env.AWS_SECRET_ACCESS_KEY = 'secret_from_env';

				const config: AwsConfig = {
					Name: 'test-project',
					Description: 'Test',
					Region: 'us-east-1',
				};

				const context: ConfigContext = {
					projectRoot: '/project',
					configPath: '/project/.aws-config',
					orgConfigPath: '/project/.aws-org-config.json',
					secretsRcPath: '/project/.secretsrc',
					hasConfig: true,
					config,
					isCi: false,
				};

				const credentials = resolveCredentials(context, false);

				expect(credentials.accessKeyId).toBe('AKIA_FROM_ENV');
				expect(credentials.secretAccessKey).toBe('secret_from_env');
			});
		});

		describe('AWS SDK Default Chain', () => {
			it('should use SDK default when no credentials available', () => {
				delete process.env.AWS_ACCESS_KEY_ID;
				delete process.env.AWS_SECRET_ACCESS_KEY;

				const config: AwsConfig = {
					Name: 'test-project',
					Description: 'Test',
					Region: 'us-east-1',
				};

				const context: ConfigContext = {
					projectRoot: '/project',
					configPath: '/project/.aws-config',
					orgConfigPath: '/project/.aws-org-config.json',
					secretsRcPath: '/project/.secretsrc',
					hasConfig: true,
					config,
					isCi: false,
				};

				const credentials = resolveCredentials(context, false);

				expect(credentials).toEqual({
					region: 'us-east-1',
				});
			});
		});
	});

	describe('createSecretsManagerClient', () => {
		it('should create client with region', async () => {
			const credentials = { region: 'us-east-1' };
			const client = createSecretsManagerClient(credentials);

			expect(client).toBeDefined();
			const region = await client.config.region();
			expect(region).toBe('us-east-1');
		});

		it('should create client with explicit credentials', async () => {
			const credentials = {
				region: 'us-west-2',
				accessKeyId: 'AKIA_TEST',
				secretAccessKey: 'test_secret',
				sessionToken: 'test_token',
			};

			const client = createSecretsManagerClient(credentials);

			expect(client).toBeDefined();
			const region = await client.config.region();
			expect(region).toBe('us-west-2');
		});

		it('should create client with profile', async () => {
			const credentials = {
				region: 'eu-west-1',
				profile: 'my-profile',
			};

			const client = createSecretsManagerClient(credentials);

			expect(client).toBeDefined();
			const region = await client.config.region();
			expect(region).toBe('eu-west-1');
		});
	});
});
