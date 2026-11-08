import {expect, it} from 'vitest';
import {Root} from '@ticlo/core';
import {getFuncModulePath} from '../FunctionModule.ts';

it('gets function module path from serialized #module value', function () {
  expect(getFuncModulePath('FlowPath')).toBe('FlowPath');
  expect(getFuncModulePath({title: 'Block:FlowPath', type: 'Block', value: 'FlowPath'})).toBe('FlowPath');
  expect(getFuncModulePath(undefined, 'FallbackPath')).toBe('FallbackPath');
});

it('gets function module path from a local Block value', () => {
  const root = new Root();
  try {
    const flow = root.addFlow('FlowPath');
    expect(getFuncModulePath(flow, 'FallbackPath')).toBe('FlowPath');
  } finally {
    root.destroy();
  }
});
