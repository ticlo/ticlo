import expect from 'expect';
import {TestFunctionRunner} from './TestFunction';
import {Flow, Root} from '../Flow';

describe('BlockConfig', function () {
  it('readonly control', function () {
    let flow = new Flow();

    let block = flow.createBlock('obj');

    expect(block.getValue('##')).toEqual(flow);
    expect(block.getValue('###')).toEqual(flow);

    block.setValue('##', 1);
    expect(block.getValue('##')).toEqual(flow);

    block.updateValue('##', 1);
    expect(block.getValue('##')).toEqual(flow);

    block.setValue('a', 1);
    block.setBinding('##', 'a');
    expect(block.getValue('##')).toEqual(flow);
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
