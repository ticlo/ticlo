import React, {type RefObject} from 'react';
import type {Block} from '@ticlo/core';
import type {ElementMap} from '@ticlo/react';
import {useSelectionRects} from './useSelectionRects.ts';

export function DesignerSelectionLayer({
  stageRef,
  elementMap,
  blocks,
}: {
  stageRef: RefObject<HTMLDivElement | null>;
  elementMap: ElementMap;
  blocks: Block[];
}) {
  const rects = useSelectionRects(stageRef, elementMap, blocks);
  return (
    <div className="ticl-designer-selection-layer">
      {rects.map(({selected, left, top, width, height}, i) => (
        <div
          key={i}
          className={selected ? 'ticl-designer-selection-rect' : 'ticl-designer-hover-rect'}
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
