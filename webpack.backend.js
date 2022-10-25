const path = require('node:path')
const ESLintPlugin = require('eslint-webpack-plugin')
const { NormalModuleReplacementPlugin } = require('webpack')

module.exports = {
  entry: ['./src/index.js'],
  output: {
    path: path.resolve(__dirname, 'build', 'backend'),
    publicPath: '/',
    filename: 'backend.js',
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.mjs$/i,
        exclude: /node_modules|frontend/,
        loader: 'babel-loader',
      },
    ],
  },
  plugins: [
    new NormalModuleReplacementPlugin(
      /^node:/,
      (resource) => {
        resource.request = resource.request.replace(/^node:/, '')
      },
    ),
    new ESLintPlugin(),
  ],
}
