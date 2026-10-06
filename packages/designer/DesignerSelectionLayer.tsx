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
    <div
      className="ticl-designer-selection-layer"
      aria-hidden="true"
      style={{position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden'}}
    >
      {rects.map(({selected, left, top, width, height}, i) => (
        <div
          key={i}
          className={selected ? 'ticl-designer-selection-rect' : 'ticl-designer-hover-rect'}
          style={{
            position: 'absolute',
            left,
            top,
            width,
            height,
            boxSizing: 'border-box',
            border: `1px solid ${selected ? '#808080' : 'rgba(128, 128, 128, 0.35)'}`,
          }}
        />
      ))}
    </div>
  );
}
