process.env.TZ = 'UTC'
module.exports = {
  rootDir: '../',
  coverageDirectory: './tests/legacy-coverage',
  testEnvironment: 'node',
  testRegex: '.*\\.(spec)?\\.(js|jsx)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/node_modules/',
  ],
  moduleNameMapper: {
    '\\.(jpg|ico|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/tests/__mocks__/file.mock.js',
    'monaco-editor': '<rootDir>/tests/__mocks__/monaco-editor.mock.js',
    nanoid: '<rootDir>/tests/__mocks__/nanoid.mock.js',
    oracledb: '<rootDir>/tests/__mocks__/oracledb.mock.js',
  },
}
