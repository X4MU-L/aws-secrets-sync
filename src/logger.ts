/**
 * Cross-platform colored logging utility
 * Uses ANSI color codes for colorization (works on macOS, Linux, Windows with proper terminal)
 */

export enum Color {
	Reset = '\x1b[0m',
	Red = '\x1b[31m',
	Green = '\x1b[32m',
	Yellow = '\x1b[33m',
	Blue = '\x1b[34m',
	Gray = '\x1b[90m',
	Cyan = '\x1b[36m',
}

interface LoggerConfig {
	debug?: boolean;
	silent?: boolean;
}

class Logger {
	private debug: boolean;

	private silent: boolean;

	constructor(config: LoggerConfig = {}) {
		this.debug = config.debug || false;
		this.silent = config.silent || false;
	}

	/**
	 * Log success message in green
	 */
	success(message: string): void {
		if (this.silent) return;
		console.log(`${Color.Green}✓${Color.Reset} ${message}`);
	}

	/**
	 * Log error message in red
	 */
	error(message: string, err?: Error): void {
		if (this.silent) return;
		console.error(`${Color.Red}✗${Color.Reset} ${message}`);
		if (err && this.debug) {
			console.error(`${Color.Gray}${err.stack}${Color.Reset}`);
		}
	}

	/**
	 * Log warning message in yellow
	 */
	warn(message: string): void {
		if (this.silent) return;
		console.warn(`${Color.Yellow}⚠${Color.Reset} ${message}`);
	}

	/**
	 * Log info message in blue
	 */
	info(message: string): void {
		if (this.silent) return;
		console.log(`${Color.Blue}ℹ${Color.Reset} ${message}`);
	}

	/**
	 * Log debug message in gray (only if debug enabled)
	 */
	debugLog(message: string, data?: unknown): void {
		if (!this.debug || this.silent) return;
		if (data) {
			console.log(
				`${Color.Gray}[DEBUG] ${message}${Color.Reset}`,
				JSON.stringify(data, null, 2),
			);
		} else {
			console.log(`${Color.Gray}[DEBUG] ${message}${Color.Reset}`);
		}
	}

	/**
	 * Log raw message without formatting
	 */
	log(message: string): void {
		if (this.silent) return;
		console.log(message);
	}

	/**
	 * Set debug mode
	 */
	setDebug(debug: boolean): void {
		this.debug = debug;
	}

	/**
	 * Set silent mode
	 */
	setSilent(silent: boolean): void {
		this.silent = silent;
	}
}

// Export singleton instance
export const logger = new Logger();

/**
 * Create new logger instance with custom config
 */
export function createLogger(config: LoggerConfig): Logger {
	return new Logger(config);
}

/**
 * Wrap async operations with error handling and logging
 */
export async function withLogging<T>(
	operation: () => Promise<T>,
	successMessage?: string,
	errorMessage?: string,
): Promise<T> {
	try {
		const result = await operation();
		if (successMessage) {
			logger.success(successMessage);
		}
		return result;
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		if (errorMessage) {
			logger.error(errorMessage, err);
		} else {
			logger.error(err.message, err);
		}
		throw err;
	}
}

export default logger;
