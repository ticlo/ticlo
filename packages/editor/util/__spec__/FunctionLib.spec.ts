import {expect, it} from 'vitest';
import {getFuncLibPath} from '../FunctionLib.js';

it('gets function lib path from serialized #lib value', function () {
  expect(getFuncLibPath('FlowPath')).toBe('FlowPath');
  expect(getFuncLibPath({title: 'Block:FlowPath', type: 'Block', value: 'FlowPath'})).toBe('FlowPath');
  expect(getFuncLibPath(undefined, 'FallbackPath')).toBe('FallbackPath');
});
