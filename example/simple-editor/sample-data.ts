let sharedMore = [
  {name: 'num', type: 'number'},
  {name: 'str', type: 'string'},
  {name: 'tog1', type: 'toggle'},
  {name: 'tog2', type: 'toggle', options: ['no', 'yeeeeees']},
  {name: 'sel', type: 'select', options: ['red', 'blue', 'yellow']},
];
let len = sharedMore.length;
for (let i = 0; i < len; ++i) {
  let r = {...sharedMore[i], readonly: true};
  r.name = r.name.toUpperCase();
  sharedMore.push(r);
}
console.log(sharedMore);
export const sampleData = {
  add: {
    '#is': 'add',
    '~0': {'#is': 'add', '0': 1, '1': 2},
    '1': 4,
    '@b-xyw': [100, 100, 150],
    '@b-p': ['0', '1', 'output', '@b-p', '#is'],
    '#more': sharedMore
  },
  subtract: {
    '#is': 'subtract',
    '~0': '##.add.1',
    '~1': '##.add.output',
    '@hide': {v1: 3},
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
        '~1': '##.##.##.add.@b-p.1',
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
    '@b-p': ['0', '1', 'output'],
    '#more': sharedMore
  },
  join: {
    '#is': 'join',
    '0': 'a',
    '1': 4,
    '@b-xyw': [100, 300, 150],
    '@b-p': ['0', '1', 'output']
  },
};
