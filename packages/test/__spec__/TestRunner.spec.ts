import {describe, expect, it, vi} from 'vitest';
import {BlockProperty, Root} from '@ticlo/core';
import {FlowTestCase} from '../FlowTestCase.ts';
import {FlowTestGroup} from '../FlowTestGroup.ts';
import {matchTestFilter, normalizeTestFilter, TestRunner} from '../TestRunner.ts';
import '../Assert.ts';

function createTestTree(root: Root) {
  const groupLoader = {
    createFolder: (_path: string, prop: BlockProperty) =>
      new FlowTestGroup(prop._block, prop, 500, prop._block instanceof FlowTestGroup ? prop._block : null),
  };
  const rootGroup = root.addFlowFolder('tests', groupLoader) as FlowTestGroup;

  const addCase = (path: string, data: Record<string, unknown>) => {
    const testCase = root.addFlow(path, data, {
      createFlow: (_p: string, prop: BlockProperty) => {
        const flow = new FlowTestCase(prop._block, prop, 500, prop._block as FlowTestGroup);
        flow.updateValue('#disabled', true);
        return flow;
      },
    }) as FlowTestCase;
    return testCase;
  };

  root.addFlowFolder('tests.math', groupLoader);
  addCase('tests.math.not', {
    '#is': '',
    'op': {'#is': 'not'},
    'assert': {'#is': 'test:assert', '~actual0': '##.op.#output', 'expect0': true},
  });
  addCase('tests.math.not-equal', {
    '#is': '',
    'op': {'#is': 'not'},
    'assert': {'#is': 'test:assert', '~actual0': '##.op.#output', 'expect0': false},
  });
  addCase('tests.date', {
    '#is': '',
    'op': {'#is': 'add', '0': 1, '1': 2},
    'assert': {'#is': 'test:assert', '~actual0': '##.op.#output', 'expect0': 3},
  });

  return rootGroup;
}

describe('TestRunner filters', () => {
  it('normalizes paths, .ticlo file paths, and tests. prefixes', () => {
    expect(normalizeTestFilter('core.functions.date.create-date')).toBe('core.functions.date.create-date');
    expect(normalizeTestFilter('tests.core.functions.date.create-date')).toBe('core.functions.date.create-date');
    expect(normalizeTestFilter('packages/core/functions/date/tests/create-date.ticlo')).toBe(
      'core.functions.date.create-date'
    );
    expect(normalizeTestFilter('./packages/web-server/tests/basic.ticlo')).toBe('web-server.basic');
  });

  it('matches exact path, group prefix, exact leaf name, and wildcards', () => {
    expect(matchTestFilter('core.functions.math.not', 'not')).toBe(true);
    expect(matchTestFilter('core.functions.math.not-equal', 'not')).toBe(false);
    expect(matchTestFilter('core.functions.math.not-equal', 'core.functions.math')).toBe(true);
    expect(matchTestFilter('core.functions.math.not-equal', 'core.functions.math.not-equal')).toBe(true);
    expect(
      matchTestFilter('core.functions.date.create-date', 'packages/core/functions/date/tests/create-date.ticlo')
    ).toBe(true);
    expect(matchTestFilter('core.functions.date.create-date', '*date*')).toBe(true);
    expect(matchTestFilter('core.functions.math.not', '*date*')).toBe(false);
  });
});

describe('TestRunner execution', () => {
  it('runs filtered subset and prints mismatch details on failed tests', async () => {
    const root = new Root();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const rootGroup = createTestTree(root);

      let runner!: TestRunner;
      await new Promise<void>((resolve) => {
        runner = new TestRunner(rootGroup, resolve, false, ['math.not']);
        runner.run();
      });
      expect(runner.passed).toBe(1);
      expect(runner.failed).toBe(0);

      let failRunner!: TestRunner;
      await new Promise<void>((resolve) => {
        failRunner = new TestRunner(rootGroup, resolve, false, ['not-equal']);
        failRunner.run();
      });
      expect(failRunner.passed).toBe(0);
      expect(failRunner.failed).toBe(1);
      expect(failRunner.failedTests).toEqual(['math.not-equal']);

      const errors = errorSpy.mock.calls.map((c) => String(c[0]));
      expect(errors.some((line) => line.includes('math.not-equal'))).toBe(true);
      expect(errors.some((line) => line.includes('assert[0]: expected false, actual true'))).toBe(true);
      expect(errors.some((line) => line === 'failed tests:')).toBe(true);
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
      root.destroy();
    }
  });

  it('reports when no tests match the filter', () => {
    const root = new Root();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const rootGroup = createTestTree(root);
      const onDone = vi.fn();
      const runner = new TestRunner(rootGroup, onDone, false, ['does-not-exist']);
      runner.run();
      expect(onDone).toHaveBeenCalledOnce();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('no tests matched filter'));
    } finally {
      errorSpy.mockRestore();
      logSpy.mockRestore();
      root.destroy();
    }
  });
});
