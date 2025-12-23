import {expect} from 'vitest';
import {TestFunctionRunner} from './TestFunction.js';
import {Flow, Root} from '../Flow.js';

describe('BlockPriority', function () {
  beforeEach(() => {
    TestFunctionRunner.clearLog();
  });

  afterEach(() => {
    TestFunctionRunner.clearLog();
  });

  it('basic function order', function () {
    let flow = new Flow();

    let p0 = flow.createBlock('p0');
    let p1 = flow.createBlock('p1');
    let p2 = flow.createBlock('p2');
    let p3 = flow.createBlock('p3');

    p0.setValue('#-log', 'p0');
    p1.setValue('#-log', 'p1');
    p2.setValue('#-log', 'p2');
    p3.setValue('#-log', 'p3');

    p3.setValue('#is', 'test-runner');
    p0.setValue('#is', 'test-runner');
    p1.setValue('#is', 'test-runner');
    p2.setValue('#is', 'test-runner');
    Root.run();

    expect(TestFunctionRunner.popLogs()).toEqual(['p3', 'p0', 'p1', 'p2']);

    expect(TestFunctionRunner.popLogs()).toEqual([]);

    p3.updateValue('#call', {});
    p1.updateValue('#call', {});
    p2.updateValue('#call', {});
    p0.updateValue('#call', {});
    Root.run();

    expect(TestFunctionRunner.popLogs()).toEqual(['p3', 'p1', 'p2', 'p0']);

    p1.setValue('#priority', 1);
    p3.setValue('#priority', 3);
    p0.setValue('#priority', 0);
    p2.setValue('#priority', 2);

    p3.updateValue('#call', {});
    p1.updateValue('#call', {});
    p2.updateValue('#call', {});
    p0.updateValue('#call', {});
    Root.run();

    expect(TestFunctionRunner.popLogs()).toEqual(['p0', 'p1', 'p2', 'p3']);
  });

  it('order from binding', function () {
    let flow = new Flow();

    let p2 = flow.createBlock('p2');
    let p0 = flow.createBlock('p0');
    let p1 = flow.createBlock('p1');
    let p3 = flow.createBlock('p3');

    p3.setValue('#mode', 'onChange');
    p0.setValue('#mode', 'onChange');
    p2.setValue('#mode', 'onChange');
    p1.setValue('#mode', 'onChange');

    p3.setValue('#-log', 'p3');
    p0.setValue('#-log', 'p0');
    p2.setValue('#-log', 'p2');
    p1.setValue('#-log', 'p1');

    p1.setBinding('input', '##.p0.input');
    p2.setBinding('input', '##.p1.input');
    p3.setBinding('input', '##.p2.input');

    p3.setValue('#is', 'test-runner');
    p0.setValue('#is', 'test-runner');
    p1.setValue('#is', 'test-runner');
    p2.setValue('#is', 'test-runner');
    Root.run();

    p0.updateValue('input', {});
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['p0', 'p1', 'p2', 'p3']);
  });

  it('priority change during resolving', function () {
    let flow = new Flow();

    let p0 = flow.createBlock('p0');
    let p1 = flow.createBlock('p1');
    let p2 = flow.createBlock('p2');

    p0.setValue('#-log', 'p0');
    p1.setValue('#-log', 'p1');
    p2.setValue('#-log', 'p2');

    p0.setValue('#mode', 'onChange');
    p1.setValue('#mode', 'onChange');
    p2.setValue('#mode', 'onChange');

    p0.setBinding('#call', '##.p2.#call');
    p2.setBinding('#call', '##.p1.#emit');

    p0.setValue('#is', 'test-runner');
    p1.setValue('#is', 'test-runner');
    p2.setValue('#is', 'test-runner');

    p0.setValue('#priority', 0);
    p1.setValue('#priority', 1);
    p2.setValue('#priority', 2);

    p1.setValue('#call', {});
    Root.run();
    expect(TestFunctionRunner.popLogs()).toEqual(['p1', 'p0', 'p2']);
  });
});
