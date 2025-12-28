import {expect} from 'vitest';

import {addOptionalProperty, moveOptionalProperty, removeOptionalProperty} from '../OptionalProperty.js';
import {Flow} from '../../block/Flow.js';

describe('Optional Property', function () {
  it('add remove OptionalProperty', function () {
    const flow = new Flow();

    // remove should do nothing when #optional is undefined
    removeOptionalProperty(flow, 'a');
    expect(flow.getValue('#optional')).not.toBeDefined();

    addOptionalProperty(flow, 'a');
    expect(flow.getValue('#optional')).toEqual(['a']);
    expect(flow.getValue('@b-p')).toEqual(['a']);

    addOptionalProperty(flow, 'b');
    expect(flow.getValue('#optional')).toEqual(['a', 'b']);
    expect(flow.getValue('@b-p')).toEqual(['a', 'b']);

    // when prop name is same
    addOptionalProperty(flow, 'a');
    expect(flow.getValue('#optional')).toEqual(['a', 'b']);

    removeOptionalProperty(flow, 'b');
    expect(flow.getValue('#optional')).toEqual(['a']);
    expect(flow.getValue('@b-p')).toEqual(['a']);

    flow.setValue('a', 1);
    removeOptionalProperty(flow, 'a');
    expect(flow.getValue('#optional')).not.toBeDefined();
    expect(flow.getValue('a')).not.toBeDefined();
  });

  it('move OptionalProperty', function () {
    const flow = new Flow();

    moveOptionalProperty(flow, 'a', 'b');
    expect(flow.getValue('#optional')).not.toBeDefined();

    moveOptionalProperty(flow, 'a', 'a');
    expect(flow.getValue('#optional')).not.toBeDefined();

    flow.setValue('#optional', ['a', 'b']);

    moveOptionalProperty(flow, 'a', 'b');
    expect(flow.getValue('#optional')).toEqual(['b', 'a']);

    moveOptionalProperty(flow, 'a', 'b');
    expect(flow.getValue('#optional')).toEqual(['a', 'b']);

    moveOptionalProperty(flow, 'c', 'a');
    expect(flow.getValue('#optional')).toEqual(['c', 'a', 'b']);
    expect(flow.getValue('@b-p')).toEqual(['c']);
  });
});
