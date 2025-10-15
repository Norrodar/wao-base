import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.logLevel,
  ...(config.nodeEnv === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname'
      }
    }
  }),
  formatters: {
    level: (label) => {
      return { level: label };
    }
  }
});
