module.exports = {
  assumptions: {
    setPublicClassFields: true,
  },
  presets: [
    ['@babel/preset-env', {targets: {node: 'current'}}],
    ['@babel/preset-typescript', {allowDeclareFields: true}],
    '@babel/preset-react',
  ],
};
