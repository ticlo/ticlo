export const sampleData = {
  add: {
    '#is': 'add',
    '~0': {'#is': 'add', '0': 1, '1': 2},
    '1': 4,
    '@b-xyw': [100, 100, 150],
    '@b-p': ['0', '1', 'output', '@b-p', '#is']
  },
  subtract: {
    '#is': 'subtract',
    '~0': '##.add.1',
    '~1': '##.add.output',
    '@hide': 3,
    '@b-xyw': [300, 200, 0],
    '@b-p': ['0', '1', 'output']
  },
  multiply: {
    '#is': 'multiply',
    '~0': '##.subtract.output',
    '~1': {
      '#is': 'multiply',
      '~0': {
        '#is': 'add',
        '0': 2,
        '1': '3',
        '@b-p': ['0', '1']
      },
      '~1': {
        '#is': 'divide',
        '0': 2,
        '1': '3',
        '@b-p': ['0', '1'],
        '@b-hide': true
      },
      '@b-p': ['0', '1']
    },
    '#length': 2,
    '@b-xyw': [400, 200, 150],
    '@b-p': ['0', '1', 'output']
  }
};
