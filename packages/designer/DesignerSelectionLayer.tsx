import React, {type RefObject} from 'react';
import type {Block} from '@ticlo/core';
import type {ElementMap} from '@ticlo/react';
import {useSelectionRects} from './useSelectionRects.ts';
import type {MarqueeRect} from './useStageInput.ts';

export function DesignerSelectionLayer({
  stageRef,
  elementMap,
  blocks,
  hover,
  marquee,
}: {
  stageRef: RefObject<HTMLDivElement | null>;
  elementMap: ElementMap;
  blocks: Block[];
  hover: Element | null;
  marquee?: MarqueeRect | null;
}) {
  const rects = useSelectionRects(stageRef, elementMap, blocks, hover);
  return (
    <div className="ticl-d-selection-layer">
      {marquee && <div className="ticl-d-marquee-rect" style={marquee} />}
      {rects.map(({selected, left, top, width, height}, i) => (
        <div
          key={i}
          className={selected ? 'ticl-d-selection-rect' : 'ticl-d-hover-rect'}
          style={{
            left,
            top,
            width,
            height,
          }}
        />
      ))}
    </div>
  );
}
