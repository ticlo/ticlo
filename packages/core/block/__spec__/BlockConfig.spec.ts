import {expect} from 'vitest';
import {TestFunctionRunner} from './TestFunction.ts';
import {Flow, Root} from '../Flow.ts';

describe('BlockConfig', function () {
  it('readonly control', function () {
    const flow = new Flow();

    const block = flow.createBlock('obj');

    expect(block.getValue('##')).toBe(flow);
    expect(block.getValue('#flow')).toBe(flow);
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
    const flow = new Flow();

    const block = flow.createBlock('obj');

    expect(block.getValue('#is')).toBe('');

    block.setValue('@is', 'add');
    block.setBinding('#is', '@is');
    expect(block.getValue('#is')).toBe('add');
    expect(flow.save()).toEqual({'#is': '', 'obj': {'@is': 'add', '~#is': '@is'}});

    block.setBinding('#is', null);
    expect(block.getValue('#is')).toBe('');
    expect(flow.save()).toEqual({'#is': '', 'obj': {'@is': 'add', '#is': ''}});
  });

  it('saves and enumerates the #main component tree', function () {
    const data = {
      '#is': '',
      '#main': {'#is': '', 'title': {'#is': '', 'content': 'Hello'}},
    };
    const flow = new Flow();
    flow.load(data);

    const fields: string[] = [];
    flow.forEach((field) => fields.push(field));
    expect(fields).toEqual(['#main']);
    expect(flow.queryValue('#main.title.content')).toBe('Hello');
    expect(flow.save()).toEqual(data);

    const reloaded = new Flow();
    reloaded.load(flow.save());
    expect(reloaded.queryValue('#main.title.content')).toBe('Hello');
    reloaded.destroy();
    flow.destroy();
  });
});
