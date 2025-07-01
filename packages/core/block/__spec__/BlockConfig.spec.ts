import {expect} from 'vitest';
import {TestFunctionRunner} from './TestFunction';
import {Flow, Root} from '../Flow';

describe('BlockConfig', function () {
  it('readonly control', function () {
    let flow = new Flow();

    let block = flow.createBlock('obj');

    expect(block.getValue('##')).toBe(flow);
    expect(block.getValue('###')).toBe(flow);
    expect(block.getValue('#name')).toBe('obj');

    block.setValue('##', 1);
    expect(block.getValue('##')).toBe(flow);

    block.updateValue('##', 1);
    expect(block.getValue('##')).toBe(flow);

    block.setValue('a', 1);
    block.setBinding('##', 'a');
    expect(block.getValue('##')).toBe(flow);
  });

  it('#is', function () {
    let flow = new Flow();

    let block = flow.createBlock('obj');

    expect(block.getValue('#is')).toBe('');

    block.setValue('@is', 'add');
    block.setBinding('#is', '@is');
    expect(block.getValue('#is')).toBe('add');
    expect(flow.save()).toEqual({'#is': '', 'obj': {'@is': 'add', '~#is': '@is'}});

    block.setBinding('#is', null);
    expect(block.getValue('#is')).toBe('');
    expect(flow.save()).toEqual({'#is': '', 'obj': {'@is': 'add', '#is': ''}});
  });
});
