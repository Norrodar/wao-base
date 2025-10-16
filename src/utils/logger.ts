import pino from 'pino';
import { config } from '../config';

// Custom formatter for better log output
const customFormatter = {
  write: (obj: any) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const level = obj.level === 30 ? 'info' : obj.level === 40 ? 'warn' : obj.level === 50 ? 'error' : 'debug';
    const message = obj.msg || '';
    
    // Format: wao-base | 2025-10-16 00:44:23 | <Message>
    return `wao-base | ${timestamp} | ${message}\n`;
  }
};

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

// Add startup banner
export const logStartupBanner = () => {
  const banner = `
wao-base | ${new Date().toISOString().replace('T', ' ').substring(0, 19)} | ================================
wao-base | ${new Date().toISOString().replace('T', ' ').substring(0, 19)} | ============ Start ================
wao-base | ${new Date().toISOString().replace('T', ' ').substring(0, 19)} | ================================
wao-base | ${new Date().toISOString().replace('T', ' ').substring(0, 19)} | WAO-Base Service Starting...
wao-base | ${new Date().toISOString().replace('T', ' ').substring(0, 19)} | ================================
`;
  console.log(banner);
};
