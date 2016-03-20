module.exports = {
	devtool: 'source-map',
	entry: {
		main: './src/main.js',
	},
	output: {
		path: __dirname + '/bin',
		filename: '[name].js'
	},
	module: {
		loaders: [{
			test: /\.js$/,
			exclude: /node_modules/,
			loader: "babel-loader"
		}]
	}
};