import {expect} from 'vitest';
import {Flow} from '../Flow.js';
import {BlockIO} from '../BlockProperty.js';

describe('Block Child Watch', function () {
  it('basic', function () {
    const flow = new Flow();

    let watchLog: any[] = [];
    const watch = {
      onChildChange(property: BlockIO, saved: boolean) {
        watchLog.push([property._name, property._value != null, Boolean(saved)]);
      },
    };
    flow.watch(watch);

    flow.createBlock('a');
    expect(watchLog).toEqual([['a', true, true]]);
    watchLog = [];

    flow.createOutputBlock('a');
    expect(watchLog).toEqual([['a', true, false]]);
    watchLog = [];

    flow.createBlock('a');
    expect(watchLog).toEqual([['a', true, true]]);
    watchLog = [];

    flow.setValue('a', null);
    expect(watchLog).toEqual([['a', false, true]]);
    watchLog = [];

    flow.createOutputBlock('a');
    expect(watchLog).toEqual([['a', true, false]]);
    watchLog = [];

    flow.setBinding('a', 'b');
    expect(watchLog).toEqual([['a', false, false]]);
    watchLog = [];
  });
});
