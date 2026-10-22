import React, {type RefObject} from 'react';
import {getDisplayName, type Block} from '@ticlo/core';
import {useValue, type ElementMap} from '@ticlo/react';
import {useSelectionQuads} from './useSelectionQuads.ts';
import type {MarqueeRect} from './useStageInput.ts';
import {resizeHandles, type ResizePreview, type ResizeStart} from './StageResize.ts';

function handlePoint(quad: DOMQuad, x: number, y: number) {
  x = (x + 1) / 2;
  y = (y + 1) / 2;
  const {p1, p2, p3, p4} = quad;
  return {
    x: (p1.x * (1 - x) + p2.x * x) * (1 - y) + (p4.x * (1 - x) + p3.x * x) * y,
    y: (p1.y * (1 - x) + p2.y * x) * (1 - y) + (p4.y * (1 - x) + p3.y * x) * y,
  };
}

function topEdgeRotation(quad: DOMQuad) {
  return (Math.atan2(quad.p2.y - quad.p1.y, quad.p2.x - quad.p1.x) * 180) / Math.PI;
}

function SelectionLabel({block, quad}: {block: Block; quad: DOMQuad}) {
  const displayName = useValue<string>(block, '#label');
  return (
    <div
      className="ticl-d-selection-label"
      style={{left: quad.p1.x, top: quad.p1.y, transform: `rotate(${topEdgeRotation(quad)}deg)`}}
    >
      {getDisplayName(block.getName(), displayName)}
    </div>
  );
}

export function DesignerSelectionLayer({
  stageRef,
  elementMap,
  main,
  blocks,
  hover,
  marquee,
  dropPoints,
  resizePreview,
  onResizeStart,
}: {
  stageRef: RefObject<HTMLDivElement | null>;
  elementMap: ElementMap;
  main: Block | null;
  blocks: Block[];
  hover: Element | null;
  marquee?: MarqueeRect | null;
  dropPoints?: string | null;
  resizePreview?: ResizePreview | null;
  onResizeStart?: ResizeStart;
}) {
  const quads = useSelectionQuads(stageRef, elementMap, blocks, hover);
  const outlines = resizePreview
    ? [
        ...quads.filter(({element}) => element !== resizePreview.element),
        {
          ...resizePreview,
          selected: true,
          points: [resizePreview.quad.p1, resizePreview.quad.p2, resizePreview.quad.p3, resizePreview.quad.p4]
            .map(({x, y}) => `${x},${y}`)
            .join(' '),
        },
      ]
    : quads;
  return (
    <div className="ticl-d-selection-layer">
      {marquee && <div className="ticl-d-marquee-rect" style={marquee} />}
      {outlines.map(({element, selected, quad}, i) => {
        const block = selected && elementMap.getBlock(element);
        return block && block !== main ? <SelectionLabel key={i} block={block} quad={quad} /> : null;
      })}
      <svg className="ticl-d-selection-outlines" width="100%" height="100%">
        {outlines.map(({element, selected, points, quad}, i) => (
          <g key={i} className={selected ? undefined : 'ticl-d-hover-outline'}>
            <polygon points={points} />
            <polygon className={selected ? 'ticl-d-selection-rect' : 'ticl-d-hover-rect'} points={points} />
            {selected &&
              elementMap.getBlock(element) !== main &&
              onResizeStart &&
              resizeHandles.map((handle) => {
                const point = handlePoint(quad, handle.x, handle.y);
                const rotation = topEdgeRotation(quad);
                const angle = Math.round(rotation / 45 + Math.atan2(handle.y, handle.x) / (Math.PI / 4));
                const cursor = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][((angle % 4) + 4) % 4];
                return (
                  <rect
                    key={handle.name}
                    className="ticl-d-resize-handle"
                    data-handle={handle.name}
                    x={point.x - 3.5}
                    y={point.y - 3.5}
                    width={7}
                    height={7}
                    transform={`rotate(${rotation} ${point.x} ${point.y})`}
                    style={{cursor}}
                    onPointerDown={(event) => onResizeStart(element, handle, event)}
                  />
                );
              })}
          </g>
        ))}
        {dropPoints && <polygon className="ticl-d-drop-rect" points={dropPoints} />}
      </svg>
    </div>
  );
}
