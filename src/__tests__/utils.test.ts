import * as readline from 'readline';
import { prompt, promptYesNo, showHelp } from '../utils';

jest.mock('readline');

describe('utils', () => {
	const mockReadline = readline as jest.Mocked<typeof readline>;
	let mockQuestion: jest.Mock;
	let mockClose: jest.Mock;

	beforeEach(() => {
		mockQuestion = jest.fn((q: string, callback: (answer: string) => void) => {
			callback('test-answer');
		});
		mockClose = jest.fn();

		mockReadline.createInterface.mockReturnValue({
			question: mockQuestion,
			close: mockClose,
		} as unknown as readline.Interface);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('prompt', () => {
		it('should prompt user and return answer', async () => {
			mockQuestion.mockImplementation((q: string, callback: (answer: string) => void) => {
				callback('user-input');
			});

			const answer = await prompt('What is your name?');

			expect(answer).toBe('user-input');
		});

		it('should use default value if no answer provided', async () => {
			mockQuestion.mockImplementation((q: string, callback: (answer: string) => void) => {
				callback('');
			});

			const answer = await prompt('Enter value', 'default-value');

			expect(answer).toBe('default-value');
		});

		it('should include default in question text', async () => {
			await prompt('Enter config', 'my-default');

			expect(mockQuestion).toHaveBeenCalledWith(
				expect.stringContaining('my-default'),
				expect.any(Function)
			);
		});

		it('should handle empty string as answer', async () => {
			mockQuestion.mockImplementation((q: string, callback: (answer: string) => void) => {
				callback('some-value');
			});

			const answer = await prompt('Enter something');

			expect(answer).toBe('some-value');
		});
	});

	describe('promptYesNo', () => {
		it('should return true for yes answer', async () => {
			mockQuestion.mockImplementation((q: string, callback: (answer: string) => void) => {
				callback('y');
			});

			const result = await promptYesNo('Continue?', true);

			expect(result).toBe(true);
		});

		it('should return false for no answer', async () => {
			mockQuestion.mockImplementation((q: string, callback: (answer: string) => void) => {
				callback('n');
			});

			const result = await promptYesNo('Continue?', true);

			expect(result).toBe(false);
		});

		it('should use default when no answer provided', async () => {
			mockQuestion.mockImplementation((q: string, callback: (answer: string) => void) => {
				callback('');
			});

			const result = await promptYesNo('Continue?', true);

			expect(result).toBe(true);
		});

		it('should show [Y/n] for default yes', async () => {
			await promptYesNo('Continue?', true);

			expect(mockQuestion).toHaveBeenCalledWith(
				expect.stringContaining('[Y/n]'),
				expect.any(Function)
			);
		});

		it('should show [y/N] for default no', async () => {
			await promptYesNo('Continue?', false);

			expect(mockQuestion).toHaveBeenCalledWith(
				expect.stringContaining('[y/N]'),
				expect.any(Function)
			);
		});
	});

	describe('showHelp', () => {
		let consoleSpy: jest.SpyInstance;

		beforeEach(() => {
			consoleSpy = jest.spyOn(console, 'log').mockImplementation();
		});

		afterEach(() => {
			consoleSpy.mockRestore();
		});

		it('should display help message', () => {
			showHelp();

			expect(consoleSpy).toHaveBeenCalled();
			const output = consoleSpy.mock.calls
				.map((call) => call[0])
				.join('\n');

			expect(output).toMatch(/USAGE|COMMANDS/i);
		});

		it('should describe all available commands', () => {
			showHelp();

			const output = consoleSpy.mock.calls
				.map((call) => call[0])
				.join('\n');

			expect(output).toMatch(/configure|secrets|env/i);
		});
	});
});
