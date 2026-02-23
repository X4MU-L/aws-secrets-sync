import { execSync } from 'child_process';
import {
	getProjectRoot,
	getRepoRemoteName,
	isGitRepository,
	generateProjectName,
	validateAwsConfig,
} from '../config-manager';
import { AwsConfig } from '../types';

// Mock child_process for git commands
jest.mock('child_process', () => ({
	execSync: jest.fn(),
}));

describe('config-manager', () => {
	const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('getProjectRoot', () => {
		it('should return git root if in git repository', () => {
			mockExecSync.mockReturnValue('/path/to/git/root\n');

			const result = getProjectRoot('/path/to/git/root/subdir');

			expect(result).toEqual({ isGit: true, path: '/path/to/git/root' });
			expect(mockExecSync).toHaveBeenCalledWith(
				'git rev-parse --show-toplevel',
				expect.any(Object),
			);
		});

		it('should return current path if not git repository', () => {
			mockExecSync.mockImplementation(() => {
				throw new Error('Not a git repository');
			});

			const result = getProjectRoot('/path/to/project');

			expect(result).toEqual({ isGit: false, path: '/path/to/project' });
		});
	});

	describe('getRepoRemoteName', () => {
		it('should extract repo name from HTTPS URL', () => {
			mockExecSync.mockReturnValue('https://github.com/owner/repo-name.git\n');

			const result = getRepoRemoteName('/project');

			expect(result).toBe('repo-name');
		});

		it('should extract repo name from SSH URL', () => {
			mockExecSync.mockReturnValue('git@github.com:owner/repo-name.git\n');

			const result = getRepoRemoteName('/project');

			expect(result).toBe('repo-name');
		});

		it('should handle repo name without .git extension', () => {
			mockExecSync.mockReturnValue('https://github.com/owner/my-repo\n');

			const result = getRepoRemoteName('/project');

			expect(result).toBe('my-repo');
		});

		it('should return null if no remote', () => {
			mockExecSync.mockImplementation(() => {
				throw new Error('No remote');
			});

			const result = getRepoRemoteName('/project');

			expect(result).toBeNull();
		});
	});

	describe('isGitRepository', () => {
		it('should return true for git repository', () => {
			mockExecSync.mockReturnValue(Buffer.from('.git\n'));

			const result = isGitRepository('/project');

			expect(result).toBe(true);
		});

		it('should return false for non-git directory', () => {
			mockExecSync.mockImplementation(() => {
				throw new Error('Not a git repository');
			});

			const result = isGitRepository('/project');

			expect(result).toBe(false);
		});
	});

	describe('generateProjectName', () => {
		it('should use git remote name if available', () => {
			mockExecSync.mockReturnValue(
				Buffer.from('https://github.com/owner/my-project.git\n'),
			);

			const result = generateProjectName('/path/to/my-project');

			expect(result).toBe('my-project');
		});

		it('should use directory name if no git remote', () => {
			mockExecSync.mockImplementation(() => {
				throw new Error('No remote');
			});

			const result = generateProjectName('/path/to/my-local-project');

			expect(result).toBe('my-local-project');
		});
	});

	describe('validateAwsConfig', () => {
		it('should validate correct config', () => {
			const config: AwsConfig = {
				Name: 'test-project',
				Description: 'Test description',
				Region: 'us-east-1',
			};

			expect(validateAwsConfig(config)).toBe(true);
		});

		it('should validate config with optional Profile', () => {
			const config: AwsConfig = {
				Name: 'test-project',
				Description: 'Test description',
				Region: 'us-east-1',
				Profile: 'default',
			};

			expect(validateAwsConfig(config)).toBe(true);
		});

		it('should reject config missing Name', () => {
			const config = {
				Description: 'Test description',
				Region: 'us-east-1',
			};

			expect(validateAwsConfig(config)).toBe(false);
		});

		it('should reject config missing Description', () => {
			const config = {
				Name: 'test-project',
				Region: 'us-east-1',
			};

			expect(validateAwsConfig(config)).toBe(false);
		});

		it('should reject config missing Region', () => {
			const config = {
				Name: 'test-project',
				Description: 'Test description',
			};

			expect(validateAwsConfig(config)).toBe(false);
		});

		it('should reject non-object', () => {
			expect(validateAwsConfig(null)).toBe(false);
			expect(validateAwsConfig(undefined)).toBe(false);
			expect(validateAwsConfig('string')).toBe(false);
			expect(validateAwsConfig(123)).toBe(false);
		});
	});
});
