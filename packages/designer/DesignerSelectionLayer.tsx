import React, {type RefObject} from 'react';
import type {Block} from '@ticlo/core';
import type {ElementMap} from '@ticlo/react';
import {useSelectionQuads} from './useSelectionQuads.ts';
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
  const quads = useSelectionQuads(stageRef, elementMap, blocks, hover);
  return (
    <div className="ticl-d-selection-layer">
      {marquee && <div className="ticl-d-marquee-rect" style={marquee} />}
      <svg className="ticl-d-selection-outlines" width="100%" height="100%">
        {quads.map(({selected, points}, i) => (
          <g key={i} className={selected ? undefined : 'ticl-d-hover-outline'}>
            <polygon points={points} />
            <polygon className={selected ? 'ticl-d-selection-rect' : 'ticl-d-hover-rect'} points={points} />
          </g>
        ))}
      </svg>
    </div>
  );
}
