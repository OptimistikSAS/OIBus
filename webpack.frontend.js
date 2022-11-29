import path from 'node:path'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import ESLintPlugin from 'eslint-webpack-plugin'
import MonacoWebpackPlugin from 'monaco-editor-webpack-plugin'

const config = {
  entry: ['./src/frontend/index.jsx'],
  output: {
    path: path.resolve('./build/web-client'),
    publicPath: '/',
    filename: 'bundle.js',
  },
  resolve: {
    alias: {
      'react-dom$': 'react-dom/profiling',
      'scheduler/tracing': 'scheduler/tracing-profiling',
    },
    fallback: { path: 'path-browserify' },
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/i,
        exclude: /node_modules/,
        use: ['babel-loader'],
      },
      {
        test: /\.(css)$/i,
        // creates style nodes from JS strings and translates CSS into CommonJS
        use: ['style-loader', 'css-loader'],

      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/inline',
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve('./src/frontend/index.html'),
      favicon: path.resolve('./src/frontend/favicon.ico'),
    }),
    new ESLintPlugin(),
    new MonacoWebpackPlugin({ languages: ['json', 'sql'] }),
  ],
}

export default config
