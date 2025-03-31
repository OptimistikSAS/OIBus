export default {
  rootDir: '../',
  coverageDirectory: './tests/coverage',
  transform: { '^.+\\.(ts|js)?$': 'ts-jest' },
  testEnvironment: 'node',
  testRegex: '.*\\.(test|spec)?\\.(ts|tsx)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
  moduleNameMapper: {
    oracledb: '<rootDir>/tests/__mocks__/oracledb.mock.ts'
  },
  coveragePathIgnorePatterns: ['src/migration/', 'src/tests/utils/', 'src/south/south-odbc/odbc-loader.ts']
};
