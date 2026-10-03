import {expect} from 'vitest';
import {TestFunctionRunner} from './TestFunction.ts';
import {Flow, Root} from '../Flow.ts';
import '../../functions/data/State.ts';

describe('executeCommand', function () {
  it('execute Command', function () {
    const flow = new Flow();

    const block = flow.createBlock('obj');
    block.setValue('#is', 'test-runner');

    block.executeCommand('test', {});
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['command']);
  });

  it('lets command handlers skip writes in readonly calls', () => {
    const flow = new Flow();
    try {
      const block = flow.createBlock('state');
      block._load({'#is': 'set-state', 'input0': 1, 'target0': 2});
      block.executeCommand('saveSnapshot', {}, true);
      expect(block.getValue('target0')).toBe(2);
      block.executeCommand('saveSnapshot', {});
      expect(block.getValue('target0')).toBe(1);
      const runner = flow.createBlock('runner');
      runner.setValue('#is', 'test-runner');
      runner.executeCommand('test', {}, true);
      expect(runner.getValue('#-log')).toBeUndefined();
    } finally {
      flow.destroy();
    }
  });
});
