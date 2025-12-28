import {expect} from 'vitest';
import {TestFunctionRunner} from './TestFunction.js';
import {Flow, Root} from '../Flow.js';

describe('executeCommand', function () {
  it('execute Command', function () {
    const flow = new Flow();

    const block = flow.createBlock('obj');
    block.setValue('#is', 'test-runner');

    block.executeCommand('test', {});
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['command']);
  });
});
