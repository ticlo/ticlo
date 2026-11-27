import {afterEach, describe, expect, it, vi} from 'vitest';
import {DateTime, Root} from '@ticlo/core';
import {FlowTestCase} from '../FlowTestCase.ts';
import {TestState} from '../Interface.ts';
import '../Assert.ts';

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

  it('collects mismatch details for failed asserts', () => {
    const root = new Root();
    try {
      const testCase = new FlowTestCase(root, root.getProperty('case'), 0);
      testCase.load({
        '#is': '',
        'assert0': {
          '#is': 'test:assert',
          '[]': 1,
          'expect0': DateTime.invalid('unsupported zone'),
          'actual0': DateTime.fromISO('2000-01-01T00:00:00', {zone: 'UTC'}),
        },
      });
      const assertBlock = testCase.getValue('assert0') as any;
      testCase.results.set(assertBlock, TestState.FAILED);

      const details = testCase.getFailureDetails();
      expect(details).toEqual([
        expect.stringContaining('assert0[0]: expected DateTime.invalid("unsupported zone"), actual DateTime('),
      ]);
      testCase.destroy();
    } finally {
      root.destroy();
    }
  });

  it('collects timeout, incomplete assert, and waiting block details', () => {
    const root = new Root();
    try {
      const testCase = new FlowTestCase(root, root.getProperty('case'), 5000);
      testCase.load({
        '#is': '',
        'assert0': {
          '#is': 'test:assert',
          '[]': 2,
          'expect0': 1,
          'actual0': 1,
          'expect1': 2,
        },
        'blocker': {
          '#is': 'add',
        },
      });
      const assertBlock = testCase.getValue('assert0') as any;
      const blocker = testCase.getValue('blocker') as any;
      blocker._waiting = true;
      testCase.results.set(assertBlock, TestState.RUNNING);
      testCase._timeouted = true;

      const details = testCase.getFailureDetails();
      expect(details).toEqual([
        'timed out after 5000ms',
        'assert0: incomplete (actual1 undefined)',
        'waiting blocks: blocker',
      ]);
      testCase.destroy();
    } finally {
      root.destroy();
    }
  });
});
