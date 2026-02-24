/**
 * Cross-platform colored logging utility
 * Uses ANSI color codes for colorization (works on macOS, Linux, Windows with proper terminal)
 *
 * Verbosity model
 * ───────────────
 * success / warn / error  → always shown (unless silent). These are the only
 *                            signals a library consumer needs to see.
 * info / log              → verbose mode only. The CLI enables verbose so the
 *                            user gets progress feedback; programmatic / library
 *                            use stays quiet.
 * debugLog                → debug mode only (--debug flag).
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
	/** Enable info() and log(). Off by default so library use stays quiet. */
	verbose?: boolean;
}

class Logger {
	private debug: boolean;

	private silent: boolean;

	private verbose: boolean;

	constructor(config: LoggerConfig = {}) {
		this.debug = config.debug ?? false;
		this.silent = config.silent ?? false;
		this.verbose = config.verbose ?? false;
	}

	/**
	 * Log success message in green
	 */
	success(message: string): void {
		if (this.silent) return;
		console.log(`${Color.Green}✓ ${message}${Color.Reset} `);
	}

	/**
	 * Log error message in red
	 */
	error(message: string, err?: Error): void {
		if (this.silent) return;
		console.error(`${Color.Red}✗ ${message}${Color.Reset}`);
		if (err && this.debug) {
			console.error(`${Color.Gray}${err.stack}${Color.Reset}`);
		}
	}

	/**
	 * Log warning message in yellow
	 */
	warn(message: string): void {
		if (this.silent) return;
		console.warn(`${Color.Yellow}⚠ ${message}${Color.Reset}`);
	}

	/**
	 * Log info message in blue
	 */
	info(message: string): void {
		if (this.silent || !this.verbose) return;
		console.log(`${Color.Blue}ℹ ${message}${Color.Reset}`);
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
	 * Verbose only: raw message without formatting.
	 * Suppressed in library/programmatic use; enabled by the CLI.
	 */
	log(message: string): void {
		if (this.silent) return;
		console.log(`${Color.Cyan}${message}${Color.Reset}`);
	}

	/** Enable/disable debug output (--debug flag) */
	setDebug(enabled: boolean): void {
		this.debug = enabled;
	}

	/** Enable/disable verbose output (info + log). Called by the CLI on startup. */
	setVerbose(enabled: boolean): void {
		this.verbose = enabled;
	}

	/** Suppress all output */
	setSilent(enabled: boolean): void {
		this.silent = enabled;
	}
}

// Singleton: verbose off by default (library-safe).
// The CLI calls logger.setVerbose(true) before doing anything else.
export const logger = new Logger();

/**
 * Create a new logger instance with custom config.
 */
export function createLogger(config: LoggerConfig): Logger {
	return new Logger(config);
}

/**
 * Wrap async operations with error handling and logging.
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
		logger.error(errorMessage ?? err.message, err);
		throw err;
	}
}

export default logger;
