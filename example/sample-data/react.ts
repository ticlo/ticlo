const data = {
  '#is': '',
  'query-selector': {
    '#is': 'dom:query-selector',
    'parent': 'document',
    '@b-p': ['parent', 'query', 'output'],
    '@b-xyw': [63.796875, 168, 150],
    'query': '#app'
  },
  'jsx': {'#is': 'react:jsx', '@b-p': ['script', 'output'], '@b-xyw': [52.796875, 330, 150]},
  'render-dom': {
    '#is': 'react:render-dom',
    '@b-p': ['container', 'component'],
    '@b-xyw': [332.796875, 254, 150],
    '~container': '##.query-selector.output',
    '~component': '##.jsx.output'
  }
};

export default data;
