import {afterEach, describe, expect, it, vi} from 'vitest';
import {Root} from '@ticlo/core';
import {FlowTestCase} from '../FlowTestCase.ts';
import {TestState} from '../Interface.ts';

describe('FlowTestCase', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resets a previous timeout when restarted', () => {
    const root = new Root();
    const testCase = new FlowTestCase(root, root.getProperty('case'), 0);
    testCase._timeouted = true;

    testCase.start();

    expect(testCase._timeouted).toBe(false);
    testCase.destroy();
    root.destroy();
  });

  it('does not start test cases from readonly commands', () => {
    const root = new Root();
    const testCase = new FlowTestCase(root, root.getProperty('case'), 0);
    try {
      const start = vi.spyOn(testCase, 'start');
      testCase.executeCommand('start', {}, true);
      expect(start).not.toHaveBeenCalled();
      testCase.executeCommand('start', {});
      expect(start).toHaveBeenCalledOnce();
    } finally {
      testCase.destroy();
      root.destroy();
    }
  });

  it('cancels a pending state update when destroyed', () => {
    vi.useFakeTimers();
    const root = new Root();
    const testCase = new FlowTestCase(root, root.getProperty('case'), 0);
    const queueSpy = vi.spyOn(testCase as any, '_queueFunction');
    testCase.updateTestState(root, TestState.RUNNING);

    testCase.destroy();
    vi.runAllTimers();

    expect(queueSpy).not.toHaveBeenCalled();
    root.destroy();
  });
});
