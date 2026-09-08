import './Assert.ts';
import './LogTime.ts';
import {globalFunctions} from '@ticlo/core';

export {FlowTestGroup} from './FlowTestGroup.ts';
export {FlowTestCase} from './FlowTestCase.ts';

globalFunctions.addCategory({
  id: 'test:',
  name: 'test',
  icon: 'fas:vial',
  color: 'fa1',
  ns: 'test',
});

// green 4b2
// red f44
