const { createLogger, format, transports } = require('winston')

const { combine, timestamp, printf } = format

const fileFormat = printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
const consoleFormat = printf(info => `${info.level}: ${info.message}`)

const logger = createLogger({
  format: combine(timestamp(), fileFormat),
  transports: [
    new transports.Console({ format: consoleFormat }),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' }),
  ],
})
logger.info('hahaha')
