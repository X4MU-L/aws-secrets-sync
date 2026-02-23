import { logger, Color, withLogging } from '../logger';

describe('Logger', () => {
	let consoleSpy: jest.SpyInstance;
	let consoleErrorSpy: jest.SpyInstance;
	let consoleWarnSpy: jest.SpyInstance;

	beforeEach(() => {
		consoleSpy = jest.spyOn(console, 'log').mockImplementation();
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
		consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		consoleWarnSpy.mockRestore();
	});

	describe('success', () => {
		it('should log success message with green color', () => {
			logger.success('Operation completed');
			expect(consoleSpy).toHaveBeenCalled();
			const callArgs = consoleSpy.mock.calls[0][0] as string;
			expect(callArgs).toContain('✓');
		});
	});

	describe('error', () => {
		it('should log error message with red color', () => {
			const err = new Error('Test error');
			logger.error('Something failed', err);
			expect(consoleErrorSpy).toHaveBeenCalled();
		});

		it('should not log when silent mode is on', () => {
			logger.setSilent(true);
			logger.error('This should not appear');
			expect(consoleErrorSpy).not.toHaveBeenCalled();
			logger.setSilent(false);
		});
	});

	describe('warn', () => {
		it('should log warning message with yellow color', () => {
			logger.warn('Warning message');
			expect(consoleWarnSpy).toHaveBeenCalled();
		});

		it('should not log when silent mode is on', () => {
			logger.setSilent(true);
			logger.warn('This should not appear');
			expect(consoleWarnSpy).not.toHaveBeenCalled();
			logger.setSilent(false);
		});
	});

	describe('info', () => {
		it('should log info message with blue color', () => {
			logger.info('Information');
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe('debugLog', () => {
		it('should not log when debug mode is off', () => {
			logger.setDebug(false);
			logger.debugLog('Debug message');
			expect(consoleSpy).not.toHaveBeenCalled();
		});

		it('should log when debug mode is on', () => {
			logger.setDebug(true);
			logger.debugLog('Debug message');
			expect(consoleSpy).toHaveBeenCalled();
			logger.setDebug(false);
		});
	});

	describe('setSilent', () => {
		it('should toggle silent mode', () => {
			logger.setSilent(true);
			logger.success('This should not appear');
			expect(consoleSpy).not.toHaveBeenCalled();

			logger.setSilent(false);
			logger.success('This should appear');
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe('setDebug', () => {
		it('should toggle debug mode', () => {
			logger.setDebug(false);
			logger.debugLog('Not shown');
			expect(consoleSpy).not.toHaveBeenCalled();

			logger.setDebug(true);
			logger.debugLog('Now shown');
			expect(consoleSpy).toHaveBeenCalled();
			logger.setDebug(false);
		});
	});

	describe('withLogging', () => {
		it('should execute function and log success', async () => {
			const result = await withLogging(
				async () => 'success',
				'Operation',
				'Completed'
			);

			expect(result).toBe('success');
			expect(consoleSpy).toHaveBeenCalled();
		});
	});

	describe('Color enum', () => {
		it('should have ANSI color codes', () => {
			expect(Color.Red).toBeDefined();
			expect(Color.Green).toBeDefined();
			expect(Color.Yellow).toBeDefined();
			expect(Color.Blue).toBeDefined();
			expect(Color.Gray).toBeDefined();
			expect(Color.Cyan).toBeDefined();
			expect(Color.Reset).toBeDefined();
		});
	});
});
