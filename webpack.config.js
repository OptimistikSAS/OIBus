const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  entry: ['babel-polyfill', './src/client/index.jsx'],
  output: {
    path: path.resolve(__dirname, 'build'),
    publicPath: '/',
    filename: 'bundle.js',
  },
  resolve: {
    alias: {
      'react-dom$': 'react-dom/profiling',
      'scheduler/tracing': 'scheduler/tracing-profiling',
    },
    fallback: { path: require.resolve('path-browserify') },
  },
  // devServer: { contentBase: './build' },
  devtool: 'source-map',
  performance: {
    maxEntrypointSize: 3200000,
    maxAssetSize: 3200000,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader', 'eslint-loader'],
      },
      {
        test: /\.(less|css)$/,
        use: [
          { loader: 'style-loader' }, // creates style nodes from JS strings
          { loader: 'css-loader' }, // translates CSS into CommonJS
          { loader: 'less-loader' }, // compiles Less to CSS
        ],
      },
      {
        test: /\.(png|jpg|gif)$/i,
        use: [
          {
            loader: 'url-loader',
            options: { limit: 40000 },
          },
        ],
      },
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: path.resolve('./src/client/index.html') })],
}
