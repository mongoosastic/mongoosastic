module.exports = {
  testTimeout: 10000,
  clearMocks: true,
  roots: [
    '<rootDir>/test'
  ],
  testEnvironment: 'node',
  preset: 'ts-jest',
  coverageReporters: ['text-summary', 'html', 'lcov']
}
