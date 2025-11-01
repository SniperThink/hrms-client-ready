/**
 * Custom Logger System
 * 
 * Features:
 * - Silences non-error logs in production
 * - Prefixes logs with [timestamp][level]
 * - Colored output in development
 * - Works on client and server
 * - Easy integration with Sentry/remote collectors
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LoggerConfig {
  enabledInProduction: boolean;
  remoteLogger?: (level: LogLevel, message: string, ...args: any[]) => void;
}

class Logger {
  private config: LoggerConfig = {
    enabledInProduction: false,
  };

  private isProduction = process.env.NODE_ENV === 'production';
  private isBrowser = typeof window !== 'undefined';

  /**
   * ANSI color codes for terminal output (server-side only)
   */
  private colors = {
    info: '\x1b[34m',    // Blue
    warn: '\x1b[33m',    // Yellow
    error: '\x1b[31m',   // Red
    debug: '\x1b[35m',   // Magenta
    reset: '\x1b[0m',
  };

  /**
   * CSS styles for browser console (client-side only)
   */
  private browserStyles = {
    info: 'color: #3b82f6; font-weight: bold',
    warn: 'color: #f59e0b; font-weight: bold',
    error: 'color: #ef4444; font-weight: bold',
    debug: 'color: #a855f7; font-weight: bold',
  };

  /**
   * Configure the logger (e.g., add remote logging)
   */
  configure(config: Partial<LoggerConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get formatted timestamp
   */
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Get colored prefix for terminal
   */
  private getColoredPrefix(level: LogLevel): string {
    if (this.isBrowser) {
      return `[${this.getTimestamp()}][${level.toUpperCase()}]`;
    }
    
    // Server-side: use ANSI colors in development
    if (!this.isProduction) {
      const color = this.colors[level];
      return `${color}[${this.getTimestamp()}][${level.toUpperCase()}]${this.colors.reset}`;
    }
    
    return `[${this.getTimestamp()}][${level.toUpperCase()}]`;
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, ...args: any[]) {
    // In production, only log errors unless explicitly enabled
    if (this.isProduction && level !== 'error' && !this.config.enabledInProduction) {
      return;
    }

    const prefix = this.getColoredPrefix(level);

    // Browser: use CSS styling in development
    if (this.isBrowser && !this.isProduction) {
      console[level === 'info' ? 'log' : level](
        `%c${prefix}`,
        this.browserStyles[level],
        message,
        ...args
      );
    } else {
      // Server or production: simple output
      console[level === 'info' ? 'log' : level](prefix, message, ...args);
    }

    // Send to remote logger if configured
    if (this.config.remoteLogger) {
      this.config.remoteLogger(level, message, ...args);
    }
  }

  /**
   * Public logging methods
   */
  info(message: string, ...args: any[]) {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.log('error', message, ...args);
  }

  debug(message: string, ...args: any[]) {
    this.log('debug', message, ...args);
  }
}

// Export singleton instance
export const logger = new Logger();

// Example integration with Sentry (uncomment when ready):
// import * as Sentry from '@sentry/nextjs';
// 
// logger.configure({
//   remoteLogger: (level, message, ...args) => {
//     if (level === 'error') {
//       Sentry.captureException(new Error(message), {
//         extra: { args },
//       });
//     } else {
//       Sentry.addBreadcrumb({
//         level: level as any,
//         message,
//         data: { args },
//       });
//     }
//   },
// });
