import './Assert';
import './LogTime';
import {Functions} from '@ticlo/core';

export {FlowTestGroup} from './FlowTestGroup';
export {FlowTestCase} from './FlowTestCase';

Functions.addCategory({
  id: 'test:',
  name: 'test',
  icon: 'fas:vial',
  color: 'fa1',
  ns: 'test',
});

// green 4b2
// red f44
