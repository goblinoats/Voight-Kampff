const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = env => {
  let envFile;
  if (!env) {
    env = {
      development: true,
    }
  }
  if (env.staging) {
    envFile = './.env.staging';
  }
  if (env.production) {
    envFile = './.env.production';
  }
  if (env.development) {
    envFile = './.env.development';
  }

  return {
    mode: env.development ? 'development' : 'production',
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.js',
      publicPath: '/',
    },
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
      alias: {
        react: path.resolve('./node_modules/react'),
        'react-dom': path.resolve('./node_modules/react-dom'),
      },
      fallback: {
        path: false,
        os: false,
        crypto: false,
      },
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          exclude: /node_modules/,
          loader: 'esbuild-loader',
          options: {
            loader: 'tsx',
            target: 'es2022',
            jsx: 'automatic',
          },
        },
        {
          test: /\.module\.css$/,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                modules: {
                  namedExport: false,
                },
              },
            },
          ],
        },
        {
          test: /\.css$/,
          exclude: /\.module\.css$/,
          use: ['style-loader', 'css-loader'],
          sideEffects: true,
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/,
          type: 'asset/resource',
          generator: {
            filename: 'public/fonts/[name][ext]',
          },
        },
        {
          test: /\.svg$/,
          type: 'asset/resource',
          generator: {
            filename: 'public/images/[name][ext]',
          },
        },
        {
          test: /\.(png|jpg|jpeg|gif|ico)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'public/images/[name][ext]',
          },
        },
      ],
    },
    devtool: 'source-map',
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        favicon: './src/assets/favicon/favicon.ico',
      }),
      // Docs: https://www.npmjs.com/package/dotenv-webpack#about-path-settings
      new Dotenv({
        path: envFile,
      }),
    ],
    devServer: {
      static: [
        {
          directory: path.join(__dirname, 'dist'),
          publicPath: '/',
        },
        {
          directory: path.join(__dirname, 'public'),
          publicPath: '/public',
        },
      ],
      historyApiFallback: true,
      compress: true,
      port: 3000,
    },
  };
};
