import type {Config} from 'jest';

const config: Config = {
  globalSetup: './puppeteer/setup.js',
  globalTeardown: './puppeteer/teardown.js',
  testEnvironment: './puppeteer/environment.js',
  collectCoverage: true,
};

export default config;
