const path = require('path');
const Dotenv = require('dotenv-webpack');


module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
    chunkFilename: '[name].bundle.js',
    publicPath: '/frontend/dist/'
  },
  plugins: [
    new Dotenv()
  ]
};