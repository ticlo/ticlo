export const sampleData = {
  add: {
    '#is': 'add',
    '0': 3,
    '1': 4,
    '@b-xyw': [100, 100, 150],
    '@b-p': ['0', '1', 'output', '@b-p', '#is']
  },
  subtract: {
    '#is': 'subtract',
    '~0': '##.add.output',
    '1': 2,
    '@b-xyw': [300, 200, 150],
    '@b-p': ['0', '1', 'output']
  }
};
