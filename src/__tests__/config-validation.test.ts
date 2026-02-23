import { validateAwsConfig } from '../config-manager';
import { AwsConfig } from '../types';

describe('config-manager file validation', () => {
	const testConfig: AwsConfig = {
		Name: 'test-project',
		Description: 'Test description',
		Region: 'us-east-1',
		Profile: 'default',
	};

	describe('validateAwsConfig', () => {
		it('should validate config with required fields', () => {
			const result = validateAwsConfig(testConfig);
			expect(result).toBe(true);
		});

		it('should accept config with explicit credentials', () => {
			const configWithCreds: AwsConfig = {
				Name: 'test',
				Description: 'test',
				Region: 'us-east-1',
				AWS_ACCESS_KEY_ID: 'AKIA_123',
				AWS_SECRET_ACCESS_KEY: 'secret',
			};
			expect(validateAwsConfig(configWithCreds)).toBe(true);
		});

		it('should accept config with session token', () => {
			const configWithToken: AwsConfig = {
				Name: 'test',
				Description: 'test',
				Region: 'us-east-1',
				AWS_ACCESS_KEY_ID: 'ASIA_123',
				AWS_SECRET_ACCESS_KEY: 'secret',
				AWS_SESSION_TOKEN: 'token',
			};
			expect(validateAwsConfig(configWithToken)).toBe(true);
		});

		it('should reject invalid objects', () => {
			expect(validateAwsConfig(null)).toBe(false);
			expect(validateAwsConfig(undefined)).toBe(false);
			expect(validateAwsConfig({})).toBe(false);
			expect(validateAwsConfig('string')).toBe(false);
			expect(validateAwsConfig(123)).toBe(false);
		});

		it('should reject config missing required Name', () => {
			const invalid = {
				Description: 'test',
				Region: 'us-east-1',
			};
			expect(validateAwsConfig(invalid)).toBe(false);
		});

		it('should reject config missing required Description', () => {
			const invalid = {
				Name: 'test',
				Region: 'us-east-1',
			};
			expect(validateAwsConfig(invalid)).toBe(false);
		});

		it('should reject config missing required Region', () => {
			const invalid = {
				Name: 'test',
				Description: 'test',
			};
			expect(validateAwsConfig(invalid)).toBe(false);
		});
	});
});
