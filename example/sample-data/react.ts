const data = {
  '#is': '',
  'query-selector': {
    '#is': 'html:query-selector',
    'parent': 'document',
    '@b-p': ['parent', 'query', '#output'],
    '@b-xyw': [63, 168, 150],
    'query': '#main',
  },
  'jsx': {'#is': 'react:jsx', '@b-p': ['script', '#output'], '@b-xyw': [52.796875, 330, 150]},
  'render-dom': {
    '#is': 'react:render-dom',
    '@b-p': ['container', 'component'],
    '@b-xyw': [332, 254, 150],
    '~container': '##.query-selector.#output',
    '~component': '##.jsx.#output',
  },
  'schedule': {
    '#is': 'schedule',
    'config0': {
      repeat: 'weekly',
      start: [3, 30],
      days: [1, 2, 5],
      name: 'hello',
      duration: 600,
    },
    '@b-p': ['config0', 'value0', '#output'],
    '@b-xyw': [500, 254, 150],
  },
};

export default data;
