import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const isProduction = env.NODE_ENV === 'production';

const devFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  return `${ts} [${level}]: ${stack ?? message} ${
    Object.keys(meta).length ? JSON.stringify(meta) : ''
  }`;
});

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction ? combine(timestamp(), json()) : combine(colorize(), devFormat),
  }),
];

if (!isProduction) {
  transports.push(
    new winston.transports.File({ filename: 'logs/app.log' }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' })
  );
}

export const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: combine(timestamp(), errors({ stack: true })),
  transports,
});
