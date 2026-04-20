const { createLogger, format, transports } = require('winston');
require('winston-daily-rotate-file');
const path = require('path');

const logDir = process.env.LOG_DIR || 'logs';
const logLevel = process.env.LOG_LEVEL || 'info';

const activeTransports = [
  new transports.Console({
    format: format.combine(
      format.colorize(),
      format.printf(({ timestamp, level, message, ...meta }) => {
        const extra = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `${timestamp} [${level}]: ${message}${extra}`;
      })
    ),
  }),
];

// Only add file transports when the filesystem is writable (not on Vercel)
if (process.env.VERCEL !== '1') {
  activeTransports.push(
    new transports.DailyRotateFile({
      filename:     path.join(logDir, 'combined-%DATE%.log'),
      datePattern:  'YYYY-MM-DD',
      zippedArchive: true,
      maxSize:      '20m',
      maxFiles:     '30d',
    }),
    new transports.DailyRotateFile({
      level:        'error',
      filename:     path.join(logDir, 'error-%DATE%.log'),
      datePattern:  'YYYY-MM-DD',
      zippedArchive: true,
      maxSize:      '20m',
      maxFiles:     '30d',
    })
  );
}

const logger = createLogger({
  level: logLevel,
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: activeTransports,
});

module.exports = logger;
