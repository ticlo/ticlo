import './Assert.js';
import './LogTime.js';
import {globalFunctions} from '@ticlo/core';

export {FlowTestGroup} from './FlowTestGroup.js';
export {FlowTestCase} from './FlowTestCase.js';

globalFunctions.addCategory({
  id: 'test:',
  name: 'test',
  icon: 'fas:vial',
  color: 'fa1',
  ns: 'test',
});

// green 4b2
// red f44
