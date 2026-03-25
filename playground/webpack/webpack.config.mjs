import path from 'node:path'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import Unplugin from 'unplugin-console/webpack'

export default {
  mode: 'development',
  entry: './src/index.ts',
  output: {
    path: path.resolve(import.meta.dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: { transpileOnly: true },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './index.html' }),
    Unplugin({
      serverPort: 8787,
    }),
  ],
  devServer: {
    port: 8081,
    hot: true,
  },
}
