let sharedMore: any[] = [
  {name: 'num', type: 'number'},
  {name: 'str', type: 'string'},
  {name: 'tog1', type: 'toggle'},
  {name: 'tog2', type: 'toggle', options: ['no', 1234567]},
  {name: 'sel', type: 'select', options: ['red', 'blue', 'yellow', 123]},
  {name: 'radio', type: 'radio-button', options: ['on', 'off', 'auto']},
  {name: 'pas', type: 'password'},
  {name: 'color', type: 'color'},
  {name: 'date', type: 'date', showTime: true},
  {name: 'range', type: 'date-range'},
];
let len = sharedMore.length;
for (let i = 0; i < len; ++i) {
  let r = {...sharedMore[i], readonly: true};
  r.name = r.name.toUpperCase();
  sharedMore.push(r);
}

sharedMore.push({name: 'group', type: 'group', defaultLen: 2, properties: []});

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
  '~tito': 'multiply.~0',
  multiply: {
    '#is': 'multiply',
    '~0': {'#is': 'add', '0': 1, '1': 3},
    '~1': {
      '#is': 'multiply',
      '~0': {
        '#is': 'add',
        '0': 2,
        '~1': {
          '#is': 'divide',
          '0': 2,
          '1': '3',
          '@b-p': ['0', '1']
        },
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
  note: {
    '#is': 'note',
    '@b-xyw': [340, 100, 150],
    'text': 'hello'
  }
};
