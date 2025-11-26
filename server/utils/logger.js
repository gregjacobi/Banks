/**
 * Enhanced Logger Utility
 * Provides timestamped logging with optional bank context (RSSD)
 */

/**
 * Format timestamp in ISO format with milliseconds
 */
function getTimestamp() {
  const now = new Date();
  return now.toISOString();
}

/**
 * Format log message with timestamp and optional context
 * @param {string} message - The log message
 * @param {Object} options - Optional logging options
 * @param {string} options.idrssd - Bank IDRSSD for context
 * @param {string} options.level - Log level (INFO, WARN, ERROR, DEBUG)
 * @returns {string} Formatted log message
 */
function formatLog(message, options = {}) {
  const {
    idrssd = null,
    level = 'INFO'
  } = options;

  const timestamp = getTimestamp();
  const levelStr = level.padEnd(5);
  const idrssdStr = idrssd ? ` [RSSD:${idrssd}]` : '';

  return `[${timestamp}] ${levelStr}${idrssdStr} ${message}`;
}

/**
 * Log with INFO level
 */
function info(message, options = {}) {
  console.log(formatLog(message, { ...options, level: 'INFO' }));
}

/**
 * Log with WARN level
 */
function warn(message, options = {}) {
  console.warn(formatLog(message, { ...options, level: 'WARN' }));
}

/**
 * Log with ERROR level
 */
function error(message, options = {}) {
  console.error(formatLog(message, { ...options, level: 'ERROR' }));
}

/**
 * Log with DEBUG level
 */
function debug(message, options = {}) {
  if (process.env.LOG_LEVEL === 'DEBUG') {
    console.log(formatLog(message, { ...options, level: 'DEBUG' }));
  }
}

/**
 * Create a logger instance with persistent context (e.g., RSSD)
 * @param {Object} context - Persistent context for all logs
 * @returns {Object} Logger instance with methods
 */
function createLogger(context = {}) {
  return {
    info: (message, opts = {}) => info(message, { ...context, ...opts }),
    warn: (message, opts = {}) => warn(message, { ...context, ...opts }),
    error: (message, opts = {}) => error(message, { ...context, ...opts }),
    debug: (message, opts = {}) => debug(message, { ...context, ...opts })
  };
}

module.exports = {
  formatLog,
  info,
  warn,
  error,
  debug,
  createLogger
};
