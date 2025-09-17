const babelJest = require('babel-jest').default;

const transformer = babelJest.createTransformer({
  presets: ['babel-preset-expo'],
  plugins: [
    '@babel/plugin-transform-modules-commonjs'
  ]
});

module.exports = transformer;