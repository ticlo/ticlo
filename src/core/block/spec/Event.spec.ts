import {expect} from 'vitest';
import {Flow, Root} from '../Flow';
import {Event} from '../Event';
import {TestFunctionRunner} from './TestFunction';

describe('Event', function () {
  it('Event Uid Change in Root', function () {
    let uid = Event.uid;
    expect(uid).toBe(Event.uid);
    Root.run();
    expect(uid).not.toBe(Event.uid);
  });

  it('event life cycle', function () {
    TestFunctionRunner.clearLog();

    let flow = new Flow();

    let block = flow.createBlock('obj');
    block.setValue('#-log', 'obj');
    block.setValue('#is', 'test-runner');

    let event = new Event('');
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
