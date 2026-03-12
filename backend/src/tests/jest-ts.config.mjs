export default {
  rootDir: '../',
  coverageDirectory: './tests/coverage',
  transform: { '^.+\\.(ts|js)?$': 'ts-jest' },
  transformIgnorePatterns: ['/node_modules/(?!hexy|https-proxy-agent|agent-base)/'],
  testEnvironment: 'node',
  testRegex: '.*\\.(test|spec)?\\.(ts|tsx)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
  moduleNameMapper: {
    oracledb: '<rootDir>/tests/__mocks__/oracledb.mock.ts',
    '^https-proxy-agent/dist$': '<rootDir>/../node_modules/https-proxy-agent/dist/index.js',
    '^agent-base$': '<rootDir>/../node_modules/agent-base/dist/index.js'
  },
  coveragePathIgnorePatterns: ['src/migration/', 'src/tests/utils/', 'src/south/south-odbc/odbc-loader.ts']
};
