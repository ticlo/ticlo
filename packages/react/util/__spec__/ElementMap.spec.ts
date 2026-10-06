import {Flow} from '@ticlo/core';
import {vi} from 'vitest';
import {ElementMap} from '../ElementMap.ts';

describe('ElementMap', function () {
  const flow = new Flow();
  afterAll(() => flow.destroy());

  it('finds the nearest registered root within the page scope', function () {
    const map = new ElementMap();
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);

    const block = flow.createBlock('mapped');
    const disconnect = map.connect(block, parent);
    expect(map.findElementFromParent(child, document.body)).toBe(parent);
    expect(map.getBlock(parent)).toBe(block);
    expect(map.findElementFromParent(child, parent)).toBeNull();
    disconnect();
    expect(map.findElementFromParent(child, document.body)).toBeNull();
  });

  it('keeps multiple mounted instances and different page registries independent', () => {
    const first = new ElementMap();
    const second = new ElementMap();
    const block = flow.createBlock('shared');
    const a = document.createElement('div');
    const b = document.createElement('div');
    const c = document.createElement('div');
    const disconnectA = first.connect(block, a);
    first.connect(block, b);
    second.connect(block, c);
    expect(first.getElements(block)).toEqual([a, b]);
    expect(second.getElements(block)).toEqual([c]);
    disconnectA();
    expect(first.getBlock(a)).toBeUndefined();
    expect(first.getElements(block)).toEqual([b]);
    expect(second.getElements(block)).toEqual([c]);
  });

  it('notifies root attachment and removal until unsubscribed', () => {
    const map = new ElementMap();
    const block = flow.createBlock('replacement');
    const element = document.createElement('div');
    const listener = vi.fn();
    const unsubscribe = map.subscribe(listener);
    const cleanup = map.connect(block, element);
    expect(listener).toHaveBeenCalledWith(block);
    cleanup();
    expect(map.getBlock(element)).toBeUndefined();
    expect(map.getElements(block).length).toBe(0);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    map.connect(block, element);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
