const sharedCustom: any[] = [
  {name: 'num', type: 'number'},
  {name: 'str', type: 'string'},
  {name: 'tog1', type: 'toggle'},
  {name: 'tog2', type: 'toggle', options: ['no', 1234567]},
  {name: 'sel', type: 'select', options: ['red', 'blue', 'yellow', 123]},
  {name: 'msel', type: 'multi-select', options: ['red', 'blue', 'yellow', 123]},
  {name: 'combo', type: 'combo-box', options: ['red', 'blue', 'yellow', 123]},
  {name: 'radio', type: 'radio-button', options: ['on', 'off', 'auto']},
  {name: 'pas', type: 'password'},
  {name: 'color', type: 'color'},
  {name: 'date', type: 'date', showTime: true},
  {name: 'range', type: 'date-range'},
  {name: 'group', type: 'group', defaultLen: 2, properties: []},
  {name: 'service', type: 'service', options: ['math-n'], create: 'add'},
  {
    name: 'worker',
    type: 'worker',
    inputs: [{name: 'name', type: 'string'}],
    outputs: [{name: 'result', type: 'string'}],
  },
];
const len = sharedCustom.length;
for (let i = 0; i < len; ++i) {
  const r = {...sharedCustom[i], readonly: true};
  r.name = r.name.toUpperCase();
  sharedCustom.push(r);
}

export const data: any = {
  add: {
    '#is': 'add',
    '~0': {'#is': 'add', '0': 1, '1': 2},
    '1': 4,
    '@b-xyw': [100, 100, 150],
    '@b-p': ['0', '1', '#output', '@b-p', '#is'],
    '#custom': sharedCustom,
  },
  subtract: {
    '#is': 'subtract',
    '~0': '##.add.1',
    '~1': '##.add.#output',
    '@hide': {v1: 3},
    '@b-xyw': [300, 200, 0],
    '@b-p': ['0', '1', '#output'],
  },
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
          '@b-p': ['0', '1'],
        },
        '@b-p': ['0', '1'],
      },
      '~1': {
        '#is': 'divide',
        '0': 2,
        '1': '3',
        '@b-p': ['0', '1'],
        '@b-hide': true,
      },
      '@b-p': ['0', '1'],
    },
    '@b-xyw': [400, 200, 150],
    '@b-p': ['0', '1', '#output'],
    '#custom': sharedCustom,
  },
  equal: {
    '#is': 'equal',
    '0': 'a',
    '1': 4,
    '@b-xyw': [100, 300, 150],
    '@b-p': ['0', '1', '#output', '@big'],
  },
  note: {
    '#is': 'note',
    '@b-xyw': [340, 100, 150],
    'text': 'hello',
  },
  css: {
    '#is': 'html:create-style',
    '@b-xyw': [100, 500, 150],
    '+optional': ['width', 'height'],
  },
};

data.equal['@big'] = JSON.parse(JSON.stringify(data));
