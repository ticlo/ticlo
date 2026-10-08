import {useEffect, useState, type RefObject} from 'react';
import type {Block} from '@ticlo/core';
import type {ElementMap} from '@ticlo/react';

interface SelectionRect {
  element: Element;
  selected: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

export function useSelectionRects(
  stageRef: RefObject<HTMLDivElement | null>,
  elementMap: ElementMap,
  blocks: Block[],
  hover: Element | null
) {
  const [rects, setRects] = useState<SelectionRect[]>([]);

  useEffect(() => {
    const stage = stageRef.current;
    const hoverBlock = hover && elementMap.getBlock(hover);
    if (!blocks.length && !hoverBlock) {
      setRects([]);
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
      const origin = stage.getBoundingClientRect();
      const next: SelectionRect[] = [];
      if (origin.width && origin.height) {
        const scaleX = origin.width / stage.offsetWidth || 1;
        const scaleY = origin.height / stage.offsetHeight || 1;
        for (const [element, selected] of getTargets()) {
          const bounds = element.getBoundingClientRect();
          if (!bounds.width || !bounds.height) continue;
          next.push({
            element,
            selected,
            left: (bounds.left - origin.left) / scaleX,
            top: (bounds.top - origin.top) / scaleY,
            width: bounds.width / scaleX,
            height: bounds.height / scaleY,
          });
        }
      }
      setRects((previous) =>
        previous.length === next.length &&
        previous.every(
          (rect, i) =>
            rect.element === next[i].element &&
            rect.selected === next[i].selected &&
            rect.left === next[i].left &&
            rect.top === next[i].top &&
            rect.width === next[i].width &&
            rect.height === next[i].height
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
      observer.observe(stage);
      for (const element of getTargets().keys()) {
        observer.observe(element);
        mutations.observe(element, {attributes: true, attributeFilter: ['style', 'class']});
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

  return rects;
}
