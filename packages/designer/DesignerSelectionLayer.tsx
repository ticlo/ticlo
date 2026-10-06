import React, {type RefObject} from 'react';
import type {Block} from '@ticlo/core';
import type {ElementMap} from '@ticlo/react';
import {useSelectionRects} from './useSelectionRects.ts';

export function DesignerSelectionLayer({
  stageRef,
  elementMap,
  blocks,
  hover,
}: {
  stageRef: RefObject<HTMLDivElement | null>;
  elementMap: ElementMap;
  blocks: Block[];
  hover: Element | null;
}) {
  const rects = useSelectionRects(stageRef, elementMap, blocks, hover);
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
