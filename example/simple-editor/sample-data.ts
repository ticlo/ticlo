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
    '~0': '##.add.1',
    '~1': '##.add.output',
    '@hide': 3,
    '@b-xyw': [300, 200, 0],
    '@b-p': ['0', '1', 'output']
  },
  multiply: {
    '#is': 'multiply',
    '~0': '##.add.1',
    '~1': '##.subtract.output',
    '~2': '##.subtract.@hide',
    '#length': 3,
    '@b-xyw': [400, 100, 150],
    '@b-p': ['0', '1', '2', 'output', '#is']
  }
};
