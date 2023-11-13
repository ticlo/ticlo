import type {Config} from 'jest';

const config: Config = {
  testRegex: 'src/(core|node)/.*spec.ts',
  collectCoverage: true,
  coverageReporters: ['lcov'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  coverageDirectory: 'coverage',
};

export default config;
