import {Block} from '@ticlo/core';
import type {FlowTestCase} from './FlowTestCase.js';
import type {FlowTestGroup} from './FlowTestGroup.js';

export enum TestState {
  REMOVED = -2,
  DISABLED = -1,
  NEW,
  RUNNING,
  FAILED,
  PASSED,
}

export interface TestsRunner {
  updateTestState(block: Block, state: TestState): void;
}
