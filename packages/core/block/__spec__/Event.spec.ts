import {expect} from 'vitest';
import {Flow, Root} from '../Flow.js';
import {Event} from '../Event.js';
import {TestFunctionRunner} from './TestFunction.js';

describe('Event', function () {
  it('Event Uid Change in Root', function () {
    const uid = Event.uid;
    expect(uid).toBe(Event.uid);
    Root.run();
    expect(uid).not.toBe(Event.uid);
  });

  it('event life cycle', function () {
    TestFunctionRunner.clearLog();

    const flow = new Flow();

    const block = flow.createBlock('obj');
    block.setValue('#-log', 'obj');
    block.setValue('#is', 'test-runner');

    const event = new Event('');
    block.setValue('#call', event);
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['obj']);

    block.setValue('#call', new Event(''));
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['obj']);

    block.setValue('#call', event);
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual([]);
  });
});
