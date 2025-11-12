export default {
  rootDir: '../',
  coverageDirectory: './tests/coverage',
  transform: { '^.+\\.(ts|js)?$': 'ts-jest' },
  testEnvironment: 'node',
  testRegex: '.*\\.(test|spec)?\\.(ts|tsx)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
  coveragePathIgnorePatterns: ['src/tests/'],
  maxWorkers: 1,
  silent: true,
  forceExit: true
};
