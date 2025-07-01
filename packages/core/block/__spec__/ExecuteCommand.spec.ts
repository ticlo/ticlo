import {expect} from 'vitest';
import {TestFunctionRunner} from './TestFunction';
import {Flow, Root} from '../Flow';

describe('executeCommand', function () {
  it('execute Command', function () {
    let flow = new Flow();

    let block = flow.createBlock('obj');
    block.setValue('#is', 'test-runner');

    block.executeCommand('test', {});
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['command']);
  });
});
