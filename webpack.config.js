var path = require("path");
module.exports = {
  entry: "./app/main.js",
  output: {
    path: path.resolve(__dirname, "build"),
    publicPath: "/build/",
    filename: "bundle.js"
  },
  module: {
    loaders: [
       {
        test: /\.js$/,
        exclude: /node_modules/,
        loaders: ['babel-loader'],
        },
        {
          test: /\.css/,
          include: path.join(__dirname, "app"),
          loaders: ['style-loader', 'css-loader']
        }
      ]
     },
};