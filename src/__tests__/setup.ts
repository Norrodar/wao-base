// Test setup file
import { config } from '../config';

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATA_DIR = './test-data';
process.env.LOG_LEVEL = 'error';
