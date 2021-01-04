import {Block} from '../core';

export enum TestState {
  REMOVED = -2,
  DISABLED = -1,
  NEW,
  RUNNING,
  PASSED,
  FAILED,
}

export interface TestsRunner {
  updateTestState(block: Block, state: TestState): void;
}
