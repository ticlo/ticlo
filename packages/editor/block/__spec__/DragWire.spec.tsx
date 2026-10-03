import React from 'react';
import {flushSync} from 'react-dom';
import {simulate} from 'simulate-event';
import {Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../index.ts';
import {fakeMouseEvent, loadTemplate, querySingle, removeLastTemplate} from '../../util/test-util.ts';
import {BlockStage} from '../BlockStage.tsx';

describe('binding drag wire', function () {
  let stage: BlockStage;
  let div: HTMLElement;
  let source: HTMLElement;

  function startDrag() {
    const rect = source.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    simulate(source, 'mousedown', fakeMouseEvent(x, y));
    simulate(document.body, 'mousemove', fakeMouseEvent(x + 30, y + 20));
    return document.querySelector('.ticl-drag-wire') as SVGSVGElement;
  }

  beforeEach(async function () {
    await initEditor();
    Root.instance.addFlow('dragWire', {
      source: {'#is': '', 'a': 7, 'b': 0, '@b-xyw': [100, 100, 143], '@b-p': ['a', 'b']},
      target: {'#is': '', '~a': '##.source.a', '@b-xyw': [700, 500, 143], '@b-p': ['a']},
    });
    const [, client] = makeLocalConnection(Root.instance);
    [, div] = loadTemplate(
      <BlockStage
        ref={(instance) => {
          stage = instance;
        }}
        conn={client}
        basePath="dragWire"
        style={{position: 'relative', left: 20, top: 20, width: 500, height: 400}}
      />,
      'editor'
    );
    await shouldHappen(() => stage?.state.contentWidth > 700 && div.querySelector('.ticl-block-wire'));
    source = div.querySelector('.ticl-field');
  });

  afterEach(function () {
    simulate(document.body, 'mouseup');
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue('dragWire');
  });

  it.each([0.5, 1, 2])('tracks the source and pointer outside a stage at zoom %s', async function (zoom) {
    flushSync(() => stage.setState({zoom}));
    const markers = div.querySelectorAll('.ticl-inbound, .ticl-inbound-right, .ticl-outbound').length;
    const wire = startDrag();
    expect(wire).not.toBeNull();
    expect(wire.parentElement).toBe(document.body);
    const preview = document.querySelector('.dragging-layer');
    expect(Number(getComputedStyle(wire).zIndex)).toBeLessThan(Number(getComputedStyle(preview).zIndex));
    expect(getComputedStyle(wire).pointerEvents).toBe('none');
    expect(div.querySelectorAll('.ticl-inbound, .ticl-inbound-right, .ticl-outbound').length).toBe(markers);

    const rect = stage.getRootElement().getBoundingClientRect();
    const pointer = fakeMouseEvent(rect.right + 60, rect.bottom + 20);
    simulate(document.body, 'mousemove', pointer);
    const path = wire.querySelector('path');
    const checkEndpoints = () => {
      const existing = div.querySelector('.ticl-block-wire path') as SVGPathElement;
      const sourcePoint = existing.getPointAtLength(0).matrixTransform(existing.getScreenCTM());
      const start = path.getPointAtLength(0);
      const end = path.getPointAtLength(path.getTotalLength());
      expect(start.x).toBeCloseTo(sourcePoint.x, 2);
      expect(start.y).toBeCloseTo(sourcePoint.y, 2);
      expect(end.x).toBeCloseTo(pointer.clientX, 2);
      expect(end.y).toBeCloseTo(pointer.clientY, 2);
    };
    checkEndpoints();

    const scroll = div.querySelector('.ticl-stage-scroll');
    scroll.scrollLeft = 20;
    scroll.scrollTop = 15;
    flushSync(() => scroll.dispatchEvent(new Event('scroll')));
    checkEndpoints();

    const target = querySingle("//div.ticl-field-name/span[text()='b']/../..", div);
    const to = target.getBoundingClientRect();
    const drop = fakeMouseEvent(to.left + to.width / 2, to.top + to.height / 2);
    simulate(target, 'mousemove', drop);
    simulate(target, 'mouseup', drop);
    expect(document.querySelector('.ticl-drag-wire')).toBeNull();
    await shouldHappen(() => Root.instance.queryValue('dragWire.source.b') === 7);
  });

  it('shows the outbound marker while dragging an unbound property', async function () {
    source = querySingle("//div.ticl-field-name/span[text()='b']/../..", div);
    expect(source.querySelector('.ticl-outbound')).toBeNull();
    expect(startDrag()).not.toBeNull();
    await shouldHappen(() => source.querySelector('.ticl-outbound'));
    simulate(document.body, 'keydown', {key: 'Escape'});
    await shouldHappen(() => !source.querySelector('.ticl-outbound'));
  });

  it.each(['escape', 'unmount'])('removes the wire on %s', function (end) {
    expect(startDrag()).not.toBeNull();
    if (end === 'escape') {
      simulate(document.body, 'keydown', {key: 'Escape'});
    } else {
      removeLastTemplate();
    }
    expect(document.querySelector('.ticl-drag-wire')).toBeNull();
    expect(document.querySelector('.dragging-layer')).toBeNull();
    expect(Root.instance.queryValue('dragWire.source.b')).toBe(0);
    document.dispatchEvent(new Event('scroll'));
  });
});
