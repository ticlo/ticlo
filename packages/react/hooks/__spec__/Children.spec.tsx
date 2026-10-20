import React from 'react';
import {BlockOrder, Flow} from '@ticlo/core';
import {getChildren} from '../useTicloComp.ts';

describe('container children', () => {
  it('expands content at its ordered position or appends it by default', () => {
    const flow = new Flow();
    try {
      const first = flow.createBlock('first');
      const second = flow.createBlock('second');
      const repeated = flow.createBlock('repeated');
      const element = <span key="content">Content</span>;
      const content = [repeated, null, false, {}, 'Text', 0, element, undefined];
      const expanded = [repeated, 'Text', 0, element];
      expect(getChildren(flow, undefined, content)).toEqual(expanded);
      expect(getChildren(flow, ['first', 'second'], content)).toEqual([first, second, ...expanded]);
      expect(getChildren(flow, ['content', 'first', 'second'], content)).toEqual([...expanded, first, second]);
      expect(getChildren(flow, ['first', 'content', 'second'], content)).toEqual([first, ...expanded, second]);
      expect(getChildren(flow, ['first', 'second', 'content'], content)).toEqual([first, second, ...expanded]);
      expect(getChildren(flow, ['first', 'content', 'second'], [])).toEqual([first, second]);
      expect(getChildren(flow, ['first', 'content', 'second'], 'Text')).toEqual([first, 'Text', second]);
    } finally {
      flow.destroy();
    }
  });

  it('expands forwarded content without consuming the receiving container content', () => {
    const flow = new Flow();
    try {
      const owner = flow.createBlock('owner');
      const first = owner.createBlock('first');
      const last = owner.createBlock('last');
      const repeated = flow.createBlock('repeated');
      owner.updateValue('content', [repeated, 'Forwarded']);
      const container = flow.createBlock('container');
      const order = new BlockOrder(owner, ['first', 'content', 'last']);
      expect(getChildren(container, order, ['Local'])).toEqual([first, repeated, 'Forwarded', last, 'Local']);
    } finally {
      flow.destroy();
    }
  });
});
