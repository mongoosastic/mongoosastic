module.exports = {
  clearMocks: true,
  roots: [
    '<rootDir>/test'
  ],
  testEnvironment: 'node',
  preset: 'ts-jest',
  coverageReporters: ['text-summary', 'html', 'lcov']
}
