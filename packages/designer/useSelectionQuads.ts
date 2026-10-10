import {useEffect, useState, type RefObject} from 'react';
import type {Block} from '@ticlo/core';
import type {ElementMap} from '@ticlo/react';
import {getElementBoxQuads} from '@ticlo/html';
import {createStagePointMapper, getFallbackQuad} from './StageGeometry.ts';

interface SelectionQuad {
  element: Element;
  selected: boolean;
  points: string;
}

export function useSelectionQuads(
  stageRef: RefObject<HTMLDivElement | null>,
  elementMap: ElementMap,
  blocks: Block[],
  hover: Element | null
) {
  const [quads, setQuads] = useState<SelectionQuad[]>([]);

  useEffect(() => {
    const stage = stageRef.current;
    const hoverBlock = hover && elementMap.getBlock(hover);
    if (!blocks.length && !hoverBlock) {
      setQuads([]);
      return;
    }

    function getTargets() {
      const targets = new Map<Element, boolean>();
      if (hoverBlock && stage.contains(hover) && elementMap.getBlock(hover) === hoverBlock) targets.set(hover, false);
      for (const block of blocks) {
        for (const element of elementMap.getElements(block) ?? []) {
          if (stage.contains(element)) targets.set(element, true);
        }
      }
      return targets;
    }

    let frame: number | null = null;
    const measure = () => {
      frame = null;
      const targets = getTargets();
      const measured = getElementBoxQuads([...targets.keys()], stage);
      let toStage: ReturnType<typeof createStagePointMapper>;
      const next: SelectionQuad[] = [];
      const offsetX = stage.scrollLeft - stage.clientLeft;
      const offsetY = stage.scrollTop - stage.clientTop;
      for (const [element, selected] of targets) {
        const quad = measured.get(element) ?? getFallbackQuad(element, (toStage ??= createStagePointMapper(stage)));
        if (!quad || !quad.getBounds().width || !quad.getBounds().height) continue;
        next.push({
          element,
          selected,
          points: [quad.p1, quad.p2, quad.p3, quad.p4]
            .map((point) => `${point.x + offsetX},${point.y + offsetY}`)
            .join(' '),
        });
      }
      setQuads((previous) =>
        previous.length === next.length &&
        previous.every(
          (rect, i) =>
            rect.element === next[i].element && rect.selected === next[i].selected && rect.points === next[i].points
        )
          ? previous
          : next
      );
    };
    const scheduleMeasure = () => {
      if (frame === null) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(scheduleMeasure);
    const mutations = new MutationObserver(scheduleMeasure);
    const observeTargets = () => {
      observer.disconnect();
      mutations.disconnect();
      const observed = new Set<Element>([stage]);
      for (const target of getTargets().keys()) {
        for (
          let element: Element | null = target;
          element && stage.contains(element);
          element = element.parentElement
        ) {
          if (observed.has(element)) break;
          observed.add(element);
        }
      }
      for (const element of observed) {
        observer.observe(element);
        mutations.observe(element, {attributes: true, attributeFilter: ['style', 'class'], childList: true});
      }
    };
    const unsubscribe = elementMap.subscribe((block) => {
      if (blocks.includes(block) || block === hoverBlock) {
        observeTargets();
        scheduleMeasure();
      }
    });
    stage.addEventListener('scroll', scheduleMeasure, true);
    observeTargets();
    scheduleMeasure();
    return () => {
      unsubscribe();
      observer.disconnect();
      mutations.disconnect();
      stage.removeEventListener('scroll', scheduleMeasure, true);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [stageRef, elementMap, blocks, hover]);

  return quads;
}
