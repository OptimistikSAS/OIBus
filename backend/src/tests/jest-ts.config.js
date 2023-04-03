module.exports = {
  rootDir: '../',
  coverageDirectory: './tests/coverage',
  transform: { '^.+\\.(ts|js)?$': 'ts-jest' },
  testEnvironment: 'node',
  testRegex: '.*\\.(test|spec)?\\.(ts|tsx)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
  "moduleNameMapper": {
    "oracledb": "<rootDir>/tests/__mocks__/oracledb.mock.ts"
  }
}
