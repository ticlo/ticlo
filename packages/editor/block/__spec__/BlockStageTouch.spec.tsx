import React from 'react';
import {flushSync} from 'react-dom';
import {Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {initEditor} from '../../index.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {BlockStage} from '../BlockStage.tsx';

describe('BlockStage touch gestures', function () {
  let stage: BlockStage;
  let scroll: HTMLElement;
  let background: HTMLElement;

  function touch(identifier: number, x: number, y: number, target: HTMLElement = background) {
    const rect = scroll.getBoundingClientRect();
    return new Touch({
      identifier,
      target,
      clientX: rect.left + x,
      clientY: rect.top + y,
      pageX: rect.left + x + window.scrollX,
      pageY: rect.top + y + window.scrollY,
    });
  }

  function dispatch(type: string, touches: Touch[], changedTouches = touches, target: EventTarget = background) {
    const event = new TouchEvent(type, {touches, changedTouches, bubbles: true, cancelable: true});
    flushSync(() => target.dispatchEvent(event));
    return event;
  }

  beforeEach(async function () {
    await initEditor();
    const flow = Root.instance.addFlow('stageTouch');
    flow.load({add: {'#is': 'add', '@b-xyw': [2400, 1800, 200]}});
    const [, client] = makeLocalConnection(Root.instance);
    const [, div] = loadTemplate(
      <BlockStage
        ref={(instance) => {
          stage = instance;
        }}
        conn={client}
        basePath="stageTouch"
        style={{position: 'relative', width: 600, height: 400}}
      />,
      'editor'
    );
    await shouldHappen(() => stage?.state.stageWidth > 0 && stage.state.contentWidth > 2400, 2000, 'stage measured');
    scroll = div.querySelector('.ticl-stage-scroll');
    background = div.querySelector('.ticl-stage-bg');
    scroll.scrollLeft = 400;
    scroll.scrollTop = 300;
    flushSync(() => scroll.dispatchEvent(new Event('scroll')));
  });

  afterEach(function () {
    removeLastTemplate();
    destroyLastLocalConnection();
    Root.instance.deleteValue('stageTouch');
  });

  it('pans with two fingers and cancels a single-finger selection', async function () {
    expect(getComputedStyle(scroll).touchAction).toBe('none');
    dispatch('touchstart', [touch(1, 200, 100)]);
    expect(stage._dragingSelect).toBeTruthy();
    expect(dispatch('touchstart', [touch(1, 200, 100), touch(2, 400, 100)]).defaultPrevented).toBe(true);
    expect(stage._dragingSelect).toBeNull();
    dispatch('touchmove', [touch(1, 250, 130), touch(2, 450, 130)]);
    await shouldHappen(() => scroll.scrollLeft === 350 && scroll.scrollTop === 270);
    expect(stage.state.zoom).toBe(1);
    dispatch('touchend', [], [touch(1, 250, 130), touch(2, 450, 130)]);
  });

  it('keeps the content under the midpoint while panning and pinching', async function () {
    dispatch('touchstart', [touch(1, 200, 100), touch(2, 400, 100)]);
    dispatch('touchmove', [touch(1, 150, 140), touch(2, 550, 140)]);
    await shouldHappen(() => stage.state.zoom === 2 && scroll.scrollLeft === 1050 && scroll.scrollTop === 660);
    dispatch('touchmove', [touch(1, 140, 130), touch(2, 740, 130)]);
    await shouldHappen(() => stage.state.zoom === 3 && scroll.scrollLeft === 1660 && scroll.scrollTop === 1070);
    dispatch('touchend', [], [touch(1, 140, 130), touch(2, 740, 130)]);
  });

  it('only pans while the pinch stays within 25% of its starting distance', async function () {
    dispatch('touchstart', [touch(1, 200, 100), touch(2, 400, 100)]);
    for (const [distance, x, y] of [
      [220, 350, 130],
      [180, 320, 110],
      [250, 360, 140],
      [150, 340, 120],
    ]) {
      dispatch('touchmove', [touch(1, x - distance / 2, y), touch(2, x + distance / 2, y)]);
      await shouldHappen(() => scroll.scrollLeft === 700 - x && scroll.scrollTop === 400 - y);
      expect(stage.state.zoom).toBe(1);
    }
    dispatch('touchend', [], [touch(1, 265, 120), touch(2, 415, 120)]);
  });

  it.each([260, 140])('keeps zoom enabled after the pinch distance crosses 25% to %i', async function (distance) {
    dispatch('touchstart', [touch(1, 200, 100), touch(2, 400, 100)]);
    const withinThreshold = distance > 200 ? 220 : 180;
    dispatch('touchmove', [touch(1, 300 - withinThreshold / 2, 100), touch(2, 300 + withinThreshold / 2, 100)]);
    expect(stage.state.zoom).toBe(1);
    for (const nextDistance of [distance, 220, 200, 180]) {
      dispatch('touchmove', [touch(1, 300 - nextDistance / 2, 100), touch(2, 300 + nextDistance / 2, 100)]);
      await shouldHappen(() => stage.state.zoom === nextDistance / 200);
      expect(scroll.scrollLeft).toBeCloseTo(700 * stage.state.zoom - 300, 0);
      expect(scroll.scrollTop).toBeCloseTo(400 * stage.state.zoom - 100, 0);
    }
    dispatch('touchend', [], [touch(1, 210, 100), touch(2, 390, 100)]);
  });

  it.each(['touchend', 'touchcancel'])('resets the zoom threshold after %s', async function (type) {
    dispatch('touchstart', [touch(1, 200, 100), touch(2, 400, 100)]);
    dispatch('touchmove', [touch(1, 150, 100), touch(2, 450, 100)]);
    await shouldHappen(() => stage.state.zoom === 1.5);
    dispatch(type, [], [touch(1, 150, 100), touch(2, 450, 100)]);

    dispatch('touchstart', [touch(3, 200, 100), touch(4, 400, 100)]);
    dispatch('touchmove', [touch(3, 240, 130), touch(4, 460, 130)]);
    await shouldHappen(() => scroll.scrollLeft === 700 && scroll.scrollTop === 470);
    expect(stage.state.zoom).toBe(1.5);
    dispatch('touchend', [], [touch(3, 240, 130), touch(4, 460, 130)]);
  });

  it('cancels a block drag and does not drag with the remaining finger', async function () {
    const block = scroll.querySelector('.ticl-block-head-label') as HTMLElement;
    expect(block).toBeTruthy();
    dispatch('touchstart', [touch(1, 200, 100, block)], undefined, block);
    expect(stage.isDraggingBlock()).toBe(true);
    dispatch('touchstart', [touch(1, 200, 100, block), touch(2, 400, 100)]);
    dispatch('touchmove', [touch(1, 220, 120, block), touch(2, 420, 120)]);
    await shouldHappen(() => scroll.scrollLeft === 380 && scroll.scrollTop === 280);
    expect(stage.isDraggingBlock()).toBe(false);
    expect(stage.getBlock('stageTouch.add').x).toBe(2400);
    dispatch('touchend', [touch(1, 220, 120, block)], [touch(2, 420, 120)]);
    dispatch('touchmove', [touch(1, 300, 200, block)]);
    expect(stage.isDraggingBlock()).toBe(false);
    expect(scroll.scrollLeft).toBe(380);
    dispatch('touchend', [], [touch(1, 300, 200, block)]);
  });

  it('clamps pinch zoom and scroll at their limits', async function () {
    dispatch('touchstart', [touch(1, 200, 100), touch(2, 400, 100)]);
    dispatch('touchmove', [touch(1, -300, 100), touch(2, 900, 100)]);
    await shouldHappen(() => stage.state.zoom === 4);
    dispatch('touchmove', [touch(1, 295, 100), touch(2, 305, 100)]);
    await shouldHappen(() => stage.state.zoom === 0.25 && scroll.scrollLeft === 0 && scroll.scrollTop === 0);
    dispatch('touchend', [], [touch(1, 295, 100), touch(2, 305, 100)]);
  });

  it('cleans up cancellation and allows a fresh gesture', async function () {
    dispatch('touchstart', [touch(1, 200, 100), touch(2, 400, 100)]);
    dispatch('touchcancel', [], [touch(1, 200, 100), touch(2, 400, 100)]);
    expect(dispatch('touchmove', [touch(1, 100, 100), touch(2, 500, 100)]).defaultPrevented).toBe(false);
    expect(stage.state.zoom).toBe(1);
    dispatch('touchstart', [touch(3, 200, 100), touch(4, 400, 100)]);
    dispatch('touchmove', [touch(3, 100, 100), touch(4, 500, 100)]);
    await shouldHappen(() => stage.state.zoom === 2);
    removeLastTemplate();
    expect(dispatch('touchmove', [touch(3, 50, 100), touch(4, 550, 100)], undefined, document).defaultPrevented).toBe(
      false
    );
  });
});
