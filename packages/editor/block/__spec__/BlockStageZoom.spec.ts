import {BlockStage} from '../BlockStage.js';

describe('BlockStage zoom', function () {
  it('keeps the vertical and horizontal viewport centers fixed', function () {
    const stage = Object.create(BlockStage.prototype) as BlockStage;
    stage.state = {
      zoom: 1,
      stageWidth: 1000,
      stageHeight: 600,
      contentWidth: 0,
      contentHeight: 0,
    };
    Object.assign(stage, {_scrollX: 0, _scrollY: 0});

    stage.changeZoom(2);

    expect((stage as any)._pendingScroll).toEqual([500, 300]);
  });
});
