import {useCallback, useLayoutEffect, useRef, useState, type RefObject} from 'react';
import {Block, getBlockOrder, type Flow} from '@ticlo/core';
import {Namespace} from '@ticlo/core/block/Namespace.ts';
import type {ComponentContextValue} from '@ticlo/react';
import {getChildren} from '@ticlo/react/hooks/useTicloComp.ts';
import type {DesignerSelection} from './DesignerContext.tsx';
import {createStageMove} from './StageMove.ts';
import {createStageResize, type ResizePreview, type ResizeStart} from './StageResize.ts';
import {getElementBoxQuads} from '@ticlo/html';
import {createStagePointMapper, getFallbackQuad, quadIntersectsRect} from './StageGeometry.ts';
import {findStageDropTarget} from './StageDrop.ts';

export interface MarqueeRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Hit {
  element: Element;
  block: Block;
}

interface Gesture extends Hit {
  mode: 'pending' | 'ready' | 'marquee' | 'moving' | 'resizing' | 'blocked';
  canMarquee: boolean;
  clickChild?: Block;
  clickCycle?: Block;
  moved?: boolean;
  pointerId: number | null;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  move?: ReturnType<typeof createStageMove>;
  resize?: ReturnType<typeof createStageResize>;
  toStage?: ReturnType<typeof createStagePointMapper>;
}

function supportsChildren(block: Block) {
  const id = block.getValue('#is') as string;
  if (!id) return false;
  return Namespace.getFunctions(id, block._flow)
    ?.listen(id, null)
    ?.getValue()
    ?.desc.childrenTags?.includes('react-comp');
}

function canSelectChildren(block: Block) {
  return !block.getValue('@d-seal') && (getBlockOrder(block)?.order.length ?? 0) > 0;
}

const inputEvents = [
  'pointerdown',
  'pointerup',
  'pointermove',
  'pointerover',
  'pointerout',
  'pointerenter',
  'pointerleave',
  'pointercancel',
  'gotpointercapture',
  'lostpointercapture',
  'mousedown',
  'mouseup',
  'mousemove',
  'mouseover',
  'mouseout',
  'mouseenter',
  'mouseleave',
  'click',
  'auxclick',
  'dblclick',
  'contextmenu',
  'wheel',
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'keydown',
  'focus',
  'blur',
  'focusin',
  'focusout',
  // A drag can enter from outside the stage even though its own drag initiation is blocked.
  'dragenter',
  'dragover',
  'dragleave',
  'drop',
];

/** Retarget page input to the stage before React dispatches component handlers. */
export function useStageInput(
  stageRef: RefObject<HTMLDivElement | null>,
  {designMode, elementMap, select, addSelection}: ComponentContextValue<Block | string>,
  activate: () => void,
  selectionRef: RefObject<DesignerSelection>,
  flow: Flow | null
) {
  const [hover, setHover] = useState<Element | null>(null);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const [resizePreview, setResizePreview] = useState<ResizePreview | null>(null);
  const resizeStartRef = useRef<ResizeStart | null>(null);
  const startResize = useCallback<ResizeStart>((element, handle, event) => {
    resizeStartRef.current?.(element, handle, event);
  }, []);

  useLayoutEffect(() => {
    setHover(null);
    setMarquee(null);
    setResizePreview(null);
    if (!designMode) return;
    const stage = stageRef.current;
    const document = stage.ownerDocument;
    const view = document.defaultView;
    const inputLayer = stage.querySelector<HTMLElement>('.ticl-d-input-layer');
    const updateInputHeight = () => {
      inputLayer?.style.setProperty('--ticl-d-input-height', `${inputLayer.parentElement.clientHeight}px`);
    };
    const resizeObserver = new ResizeObserver(updateInputHeight);
    if (inputLayer) {
      updateInputHeight();
      resizeObserver.observe(inputLayer.parentElement);
    }
    let gesture: Gesture | null = null;
    let lastClick: {block: Block; x: number; y: number; pointer: boolean} | null = null;
    let frame: number | null = null;
    const forwardedEvents = new WeakMap<Event, Event>();
    const focusStage = () => stage.focus({preventScroll: true});
    const findHit = (target: EventTarget | null): Hit | null => {
      if (!(target instanceof Element) || !stage.contains(target)) return null;
      let hit: Hit | null = null;
      for (let element: Element | null = target; element && element !== stage; element = element.parentElement) {
        const block = elementMap.getBlock(element);
        if (block && (!hit || !canSelectChildren(block))) hit = {block, element};
      }
      return hit;
    };
    const findCycleBlock = (block: Block, target: EventTarget | null) => {
      const main = flow?.getValue('#main');
      for (
        let parent = block.getParent();
        parent && parent !== main && parent._flow === flow;
        parent = parent.getParent()
      ) {
        if (!parent.getValue('@d-lock') && elementMap.getElements(parent)?.some((element) => stage.contains(element)))
          return parent;
      }
      const inner = findHit(target)?.block;
      return inner && inner !== main && !inner.getValue('@d-lock') ? inner : undefined;
    };
    const findSelectedHit = (mouse: MouseEvent): Hit | null => {
      const selected = new Set(selectionRef.current.blocks);
      if (!selected.size) return null;
      // The browser orders these by paint order, including CSS stacking contexts.
      for (const element of document.elementsFromPoint(mouse.clientX, mouse.clientY)) {
        const block = elementMap.getBlock(element);
        if (!block || !selected.has(block)) continue;
        const hit = findHit(element);
        if (hit?.block === block && !block.getValue('@d-lock')) return hit;
      }
      return null;
    };
    const findClickChild = (container: Hit, mouse: MouseEvent): Block | undefined => {
      for (const target of document.elementsFromPoint(mouse.clientX, mouse.clientY)) {
        if (!container.element.contains(target)) continue;
        const block = findHit(target)?.block;
        return block && block !== container.block && !block.getValue('@d-lock') ? block : undefined;
      }
    };
    const findHover = (target: EventTarget | null) => {
      const hit = findHit(target);
      return hit && !hit.block.getValue('@d-lock') ? hit.element : null;
    };
    const cancelFrame = () => {
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
    };
    const cancel = () => {
      cancelFrame();
      lastClick = null;
      gesture?.move?.cancel();
      gesture?.resize?.cancel();
      if (gesture?.pointerId != null && stage.hasPointerCapture(gesture.pointerId))
        stage.releasePointerCapture(gesture.pointerId);
      gesture = null;
      setMarquee(null);
      setResizePreview(null);
    };
    resizeStartRef.current = (element, handle, event) => {
      if (event.button !== 0 || !event.isPrimary) return;
      event.preventDefault();
      event.stopPropagation();
      cancel();
      const block = elementMap.getBlock(element);
      if (!block || !selectionRef.current.blocks.includes(block) || !stage.contains(element)) return;
      const resize = createStageResize(block, element, stage, handle, event.clientX, event.clientY);
      if (!resize) return;
      activate();
      focusStage();
      setHover(null);
      gesture = {
        element,
        block,
        resize,
        mode: 'resizing',
        canMarquee: false,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      setResizePreview(resize.preview());
      if (event.nativeEvent.isTrusted) stage.setPointerCapture(event.pointerId);
    };
    const bounds = (current: Gesture) => {
      const toStage = (current.toStage ??= createStagePointMapper(stage));
      const start = toStage(current.startX, current.startY);
      const end = toStage(current.clientX, current.clientY);
      return (
        start &&
        end && {
          left: Math.min(start.x, end.x),
          top: Math.min(start.y, end.y),
          right: Math.max(start.x, end.x),
          bottom: Math.max(start.y, end.y),
        }
      );
    };
    const preview = () => {
      frame = null;
      if (!gesture) return;
      if (gesture.block._destroyed || !gesture.element.isConnected) {
        cancel();
        return;
      }
      if (gesture.mode === 'moving') {
        gesture.move.update(gesture.clientX - gesture.startX, gesture.clientY - gesture.startY);
      } else if (gesture.mode === 'resizing') {
        const next = gesture.resize.update(gesture.clientX - gesture.startX, gesture.clientY - gesture.startY);
        if (!next) cancel();
        else setResizePreview(next);
      } else if (gesture.mode === 'marquee') {
        const rect = bounds(gesture);
        if (!rect) {
          cancel();
          return;
        }
        setMarquee({
          left: rect.left + stage.scrollLeft - stage.clientLeft,
          top: rect.top + stage.scrollTop - stage.clientTop,
          width: rect.right - rect.left,
          height: rect.bottom - rect.top,
        });
      }
    };
    const finish = (mouse: MouseEvent) => {
      gesture.clientX = mouse.clientX;
      gesture.clientY = mouse.clientY;
      cancelFrame();
      preview();
      if (!gesture) return;
      const {block, mode} = gesture;
      const stationary = !gesture.moved && mouse.clientX === gesture.startX && mouse.clientY === gesture.startY;
      if (mode === 'moving') {
        if (gesture.move.commit()) flow?.trackChange();
      } else if (mode === 'resizing') {
        if (gesture.resize.commit()) flow?.trackChange();
      } else if (mode === 'marquee') {
        const rect = bounds(gesture);
        const order = block.getValue('#order');
        const owner = getBlockOrder(block, order)?.owner ?? block;
        const children = getChildren(block, order, block.getValue('content'));
        const targets = new Map<Block, Element[]>();
        for (const child of children) {
          if (child instanceof Block && child.getParent() === owner && !child.getValue('@d-lock'))
            targets.set(
              child,
              (elementMap.getElements(child) ?? []).filter((element) => gesture.element.contains(element))
            );
        }
        const quads = getElementBoxQuads([...targets.values()].flat(), stage);
        const selected = [...targets]
          .filter(([, elements]) =>
            elements.some((element) => {
              const quad = quads.get(element) ?? getFallbackQuad(element, gesture.toStage);
              return quad && quadIntersectsRect(quad, rect);
            })
          )
          .map(([child]) => child);
        if (mouse.ctrlKey) {
          select([...selectionRef.current.blocks.filter((item) => item.getParent() === owner), ...selected]);
        } else select(selected);
      } else if (mode === 'pending' && !block.getValue('@d-lock')) {
        if (mouse.ctrlKey) addSelection([block]);
        else select([block]);
      } else if (mode === 'ready' && stationary && gesture.clickCycle && !mouse.ctrlKey) {
        const next = gesture.clickCycle;
        if (!next._destroyed && !next.getValue('@d-lock')) select([next]);
      } else if (mode === 'ready' && gesture.clickChild && !mouse.ctrlKey && canSelectChildren(block)) {
        const child = gesture.clickChild;
        if (!child._destroyed && !child.getValue('@d-lock')) select([child]);
      }
      lastClick =
        stationary &&
        !mouse.ctrlKey &&
        (mode === 'pending' || mode === 'ready') &&
        selectionRef.current.blocks.length === 1
          ? {
              block: selectionRef.current.blocks[0],
              x: mouse.clientX,
              y: mouse.clientY,
              pointer: gesture.pointerId !== null,
            }
          : null;
      if (gesture.pointerId != null && stage.hasPointerCapture(gesture.pointerId))
        stage.releasePointerCapture(gesture.pointerId);
      gesture = null;
      setMarquee(null);
      setResizePreview(null);
    };
    const handleInput = (event: Event) => {
      const source = forwardedEvents.get(event) ?? event;
      const sourceTarget = source.target;
      if (
        source === event &&
        sourceTarget instanceof Element &&
        sourceTarget !== stage &&
        stage.contains(sourceTarget) &&
        !sourceTarget.closest('.ticl-d-selection-layer')
      ) {
        event.stopImmediatePropagation();
        const forwarded = new (event.constructor as typeof Event)(event.type, event);
        if (event.defaultPrevented) forwarded.preventDefault();
        forwardedEvents.set(forwarded, event);
        stage.dispatchEvent(forwarded);
        // Preserve native scrolling, while preventing page focus and other default input.
        if (event.type !== 'wheel' || forwarded.defaultPrevented) event.preventDefault();
        return;
      }
      const target =
        sourceTarget instanceof Element && sourceTarget.closest('.ticl-d-input-layer') && source instanceof MouseEvent
          ? findStageDropTarget(stage, elementMap, source.clientX, source.clientY)?.element
          : sourceTarget;
      if (lastClick && event.type === (lastClick.pointer ? 'pointermove' : 'mousemove')) {
        const mouse = event as MouseEvent;
        if (mouse.clientX !== lastClick.x || mouse.clientY !== lastClick.y) lastClick = null;
      }
      if (gesture) {
        if (
          (event.type === 'keydown' && (event as KeyboardEvent).key === 'Escape') ||
          ((event.type === 'pointercancel' || event.type === 'lostpointercapture') &&
            (event as PointerEvent).pointerId === gesture.pointerId)
        ) {
          event.preventDefault();
          cancel();
          return;
        }
        const pointer = gesture.pointerId !== null;
        const mouse = event as PointerEvent;
        if (
          (!pointer || mouse.pointerId === gesture.pointerId) &&
          (event.type === (pointer ? 'pointermove' : 'mousemove') || event.type === (pointer ? 'pointerup' : 'mouseup'))
        ) {
          event.preventDefault();
          if (event.type.endsWith('up')) finish(mouse);
          else {
            if (mouse.clientX !== gesture.startX || mouse.clientY !== gesture.startY) gesture.moved = true;
            gesture.clientX = mouse.clientX;
            gesture.clientY = mouse.clientY;
            if (gesture.mode === 'pending' || gesture.mode === 'ready') {
              const dx = mouse.clientX - gesture.startX;
              const dy = mouse.clientY - gesture.startY;
              if (dx * dx + dy * dy >= 16) {
                if (gesture.mode === 'pending') gesture.mode = 'marquee';
                else {
                  gesture.move = createStageMove(
                    gesture.block,
                    gesture.element,
                    selectionRef.current.blocks,
                    elementMap,
                    gesture.startX,
                    gesture.startY
                  );
                  gesture.mode = gesture.move ? 'moving' : gesture.canMarquee ? 'marquee' : 'blocked';
                }
              }
            }
            if (
              frame === null &&
              (gesture.mode === 'moving' || gesture.mode === 'resizing' || gesture.mode === 'marquee')
            ) {
              frame = view.requestAnimationFrame(preview);
            }
          }
          return;
        }
      }
      if (!(target instanceof Element) || !stage.contains(target)) return;
      // Selection handles own their input; the page never receives it.
      if (target.closest('.ticl-d-selection-layer')) return;
      // Stage keyboard commands reach the app, but Tab must not focus a page component.
      if (target === stage && event instanceof KeyboardEvent) {
        if (event.key === 'Tab') event.preventDefault();
        return;
      }

      if (event.type === 'pointerdown' || event.type === 'mousedown') {
        if (gesture) return;
        activate();
        focusStage();
        const mouse = event as MouseEvent;
        const hit = findSelectedHit(mouse) ?? findHit(target);
        if (mouse.button !== 0 || !hit || (event instanceof PointerEvent && !event.isPrimary)) return;
        const {block} = hit;
        const locked = block.getValue('@d-lock');
        const canMarquee = canSelectChildren(block) && supportsChildren(block);
        const selected = !locked && selectionRef.current.blocks.includes(block);
        const clickCycle =
          selected &&
          !mouse.ctrlKey &&
          selectionRef.current.blocks.length === 1 &&
          lastClick?.block === block &&
          lastClick.x === mouse.clientX &&
          lastClick.y === mouse.clientY
            ? findCycleBlock(block, target)
            : undefined;
        lastClick = null;
        let mode: Gesture['mode'] = canMarquee ? 'pending' : 'ready';
        if (selected) {
          if (mouse.ctrlKey) {
            select(selectionRef.current.blocks.filter((item) => item !== block));
            mode = 'blocked';
          } else {
            select(selectionRef.current.blocks.filter((item) => item.getParent() === block.getParent()));
            mode = 'ready';
          }
        } else if (!canMarquee) {
          if (locked) mode = 'blocked';
          else if (mouse.ctrlKey) addSelection([block]);
          else select([block]);
        }
        gesture = {
          ...hit,
          mode,
          canMarquee,
          clickCycle,
          clickChild: selected && canMarquee && !mouse.ctrlKey ? findClickChild(hit, mouse) : undefined,
          pointerId: event instanceof PointerEvent ? event.pointerId : null,
          startX: mouse.clientX,
          startY: mouse.clientY,
          clientX: mouse.clientX,
          clientY: mouse.clientY,
        };
        if (source instanceof PointerEvent && source.isTrusted) stage.setPointerCapture(source.pointerId);
      } else if (event.type === 'focus' || event.type === 'focusin') {
        activate();
        if (target !== stage) focusStage();
      } else if (event.type === 'pointerover' || event.type === 'pointermove') {
        setHover(findHover(target));
      } else if (event.type === 'pointerout') {
        setHover(findHover((event as PointerEvent).relatedTarget));
      } else if (event.type === 'pointerleave' && target === stage) {
        setHover(null);
      }
    };
    const options = {capture: true, passive: false};
    for (const type of inputEvents) document.addEventListener(type, handleInput, options);
    view.addEventListener('blur', cancel);
    // A preview input may still own focus when switching back to design mode.
    if (stage.contains(document.activeElement)) focusStage();
    return () => {
      resizeStartRef.current = null;
      resizeObserver.disconnect();
      cancel();
      view.removeEventListener('blur', cancel);
      for (const type of inputEvents) document.removeEventListener(type, handleInput, true);
    };
  }, [stageRef, designMode, elementMap, select, addSelection, activate, selectionRef, flow]);

  return {hover, marquee, resizePreview, startResize};
}
