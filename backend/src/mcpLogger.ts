/* Credit to hideya from: https://github.com/hideya/langchain-mcp-tools-ts/tree/main

MIT License

Copyright (c) 2025 hideya

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Simple logger

type LogLevelString = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

const LOG_COLORS = {
  [LogLevel.TRACE]: '\x1b[90m',   // Gray
  [LogLevel.DEBUG]: '\x1b[90m',   // Gray
  [LogLevel.INFO]: '\x1b[90m',    // Gray
  [LogLevel.WARN]: '\x1b[1;93m',  // Bold bright yellow
  [LogLevel.ERROR]: '\x1b[1;91m', // Bold bright red
  [LogLevel.FATAL]: '\x1b[1;101m',// Red background, Bold text
} as const;

const LOG_LEVEL_MAP: Record<LogLevelString, LogLevel> = {
  trace: LogLevel.TRACE,
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
  fatal: LogLevel.FATAL
} as const;

class Logger {
  private readonly level: LogLevel;
  private static readonly RESET = '\x1b[0m';

  constructor({ level = LogLevel.INFO }: { level?: LogLevelString | LogLevel } = {}) {
    this.level = this.parseLogLevel(level);
  }

  private parseLogLevel(level: LogLevel | LogLevelString): LogLevel {
    if (typeof level === 'number') return level;
    return LOG_LEVEL_MAP[level.toLowerCase() as LogLevelString];
  }

  private log(level: LogLevel, ...args: unknown[]): void {
    if (level < this.level) return;

    const color = LOG_COLORS[level];
    const levelStr = `[${LogLevel[level].toLowerCase()}]`;

    console.log(`${color}${levelStr}${Logger.RESET}`, ...args.map(this.formatValue));
  }

  private formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  }

  public trace(...args: unknown[]) { this.log(LogLevel.TRACE, ...args); }
  public debug(...args: unknown[]) { this.log(LogLevel.DEBUG, ...args); }
  public info(...args: unknown[]) { this.log(LogLevel.INFO, ...args); }
  public warn(...args: unknown[]) { this.log(LogLevel.WARN, ...args); }
  public error(...args: unknown[]) { this.log(LogLevel.ERROR, ...args); }
  public fatal(...args: unknown[]) { this.log(LogLevel.FATAL, ...args); }
}

export { Logger, LogLevel, LogLevelString };