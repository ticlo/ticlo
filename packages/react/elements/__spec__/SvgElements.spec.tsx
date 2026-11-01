import React from 'react';
import {Flow, globalFunctions} from '@ticlo/core';
import {TicloComp} from '../../comp/Component.tsx';
import {creatReactRoot, type ReactRoot} from '../../functions/__spec__/render.ts';
import {optionalSvgProperties} from '../SvgAttributes.ts';
import '../SvgElements.tsx';
import '../../index.ts';

describe('react svg elements', () => {
  let root: ReactRoot;

  beforeEach(() => {
    root = creatReactRoot();
  });

  afterEach(() => {
    root.remove();
  });

  it('renders SVG children, updates optional attributes, and embeds HTML', async () => {
    const flow = new Flow();
    const svg = flow.createBlock('svg');
    svg.setValue('#is', 'react:svg');
    svg.setValue('#order', ['circle', 'foreign', 'text']);
    const circle = svg.createBlock('circle');
    circle.setValue('#is', 'react:circle');
    circle.setValue('#optional', ['cx', 'r', 'fill']);
    circle.setValue('cx', 25);
    circle.setValue('r', 10);
    circle.setValue('fill', 'red');
    const foreign = svg.createBlock('foreign');
    foreign.setValue('#is', 'react:foreignObject');
    foreign.setValue('#optional', ['width', 'height']);
    foreign.setValue('width', 100);
    foreign.setValue('height', 50);
    foreign.setValue('#order', ['label']);
    const label = foreign.createBlock('label');
    label.setValue('#is', 'react:div');
    label.setValue('content', 'HTML');
    const text = svg.createBlock('text');
    text.setValue('#is', 'react:text');
    text.setValue('content', 'SVG text');

    await root.waitRender(<TicloComp block={svg} />);

    const svgElement = root.div.querySelector('svg');
    const circleElement = svgElement.querySelector('circle');
    const htmlElement = svgElement.querySelector('foreignObject > div');
    expect(svgElement.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(circleElement.namespaceURI).toBe(svgElement.namespaceURI);
    expect(circleElement.getAttribute('r')).toBe('10');
    expect(htmlElement.namespaceURI).toBe('http://www.w3.org/1999/xhtml');
    expect(htmlElement.textContent).toBe('HTML');
    expect(svgElement.querySelector('text').textContent).toBe('SVG text');

    circle.updateValue('r', 20);
    await root.waitRender();
    expect(circleElement.getAttribute('r')).toBe('20');
    flow.destroy();
  });

  it('uses distinct placement tags and SVG optional properties', () => {
    const getDesc = (id: string) => globalFunctions.getDescToSend(id)[0];
    expect(getDesc('react:svg').tags).toEqual(['react-comp', 'react-svg']);
    expect(getDesc('react:svg').childrenTags).toEqual(['react-svg']);
    for (const name of ['absolute', 'horizontal', 'vertical', 'view-deck', 'svg', 'jsx', 'markdown']) {
      expect(getDesc(`react:${name}`).category).toBeUndefined();
    }
    expect(getDesc('react:rect').tags).toEqual(['react-svg']);
    expect(getDesc('react:rect').childrenTags).toBeUndefined();
    expect(getDesc('react:rect').category).toBe('react:svg');
    expect(getDesc('react:foreignObject').childrenTags).toEqual(['react-comp']);
    expect(optionalSvgProperties).toMatchObject({
      cx: {type: 'any', types: ['number', 'string']},
      fill: {type: 'string'},
      onClick: {readonly: true},
    });
  });
});
