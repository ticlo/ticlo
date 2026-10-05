import {expect, it} from 'vitest';
import {Root} from '@ticlo/core';
import {getFuncLibPath} from '../FunctionLib.ts';

it('gets function lib path from serialized #lib value', function () {
  expect(getFuncLibPath('FlowPath')).toBe('FlowPath');
  expect(getFuncLibPath({title: 'Block:FlowPath', type: 'Block', value: 'FlowPath'})).toBe('FlowPath');
  expect(getFuncLibPath(undefined, 'FallbackPath')).toBe('FallbackPath');
});

it('gets function lib path from a local Block value', () => {
  const root = new Root();
  try {
    const flow = root.addFlow('FlowPath');
    expect(getFuncLibPath(flow, 'FallbackPath')).toBe('FlowPath');
  } finally {
    root.destroy();
  }
});
