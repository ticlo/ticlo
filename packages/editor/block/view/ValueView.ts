import {ClientConnection} from '@ticlo/core';

ClientConnection.addEditorDescriptor('value', {
  name: 'value',
  id: 'value',
  view: 'value',
  icon: 'svg:circle-dot',
  configs: [],
  properties: [{name: '#hideLabels', type: 'toggle', default: false}],
  init: {
    '#custom': [{name: 'value', type: 'any'}],
    '@b-p': ['value'],
  },
});
