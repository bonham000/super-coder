var path = require('path');
var webpack = require('webpack');
var ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
  entry: [
    'webpack-dev-server/client?http://localhost:3333',
    'webpack/hot/only-dev-server',
    './main.js'
    ],
  output: {
    path: __dirname + '/dist',
    filename: 'bundle.js'
  },
  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ],
  module: {
    loaders: [
       {
        test: /\.js$/,
        exclude: /node_modules/,
        loaders: ['react-hot', 'babel'],
        },
        { test: /\.scss$/,
          loader: ExtractTextPlugin.extract( 'style-loader', 'css-loader!sass-loader' )
        },
      ]
     },
     plugins: [
      new ExtractTextPlugin( 'bundle.css' )
    ]
};