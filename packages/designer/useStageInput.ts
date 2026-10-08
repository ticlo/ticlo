import {useLayoutEffect, useState, type RefObject} from 'react';
import type {Block} from '@ticlo/core';
import type {ComponentContextValue} from '@ticlo/react';

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

/** Capture before React's root listeners; only input inside this stage is intercepted. */
export function useStageInput(
  stageRef: RefObject<HTMLDivElement | null>,
  {designMode, elementMap, select, addSelection}: ComponentContextValue<Block | string>,
  activate: () => void
) {
  const [hover, setHover] = useState<Element | null>(null);

  useLayoutEffect(() => {
    setHover(null);
    if (!designMode) return;
    const stage = stageRef.current;
    const document = stage.ownerDocument;
    const focusStage = () => stage.focus({preventScroll: true});
    const findElement = (target: EventTarget | null) =>
      target instanceof Element && stage.contains(target) ? elementMap.findElementFromParent(target, stage) : null;
    const handleInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element) || !stage.contains(target)) return;
      // Future selection handles own their input; the page never receives it.
      if (target.closest('.ticl-d-selection-layer')) return;
      // Stage keyboard commands reach the app, but Tab must not focus a page component.
      if (target === stage && event instanceof KeyboardEvent) {
        if (event.key === 'Tab') event.preventDefault();
        return;
      }

      event.stopImmediatePropagation();
      // Preserve native canvas scrolling, as DGLux does; component wheel handlers stay blocked.
      if (event.type !== 'wheel') event.preventDefault();

      if (event.type === 'pointerdown' || event.type === 'mousedown') {
        activate();
        focusStage();
        const mouse = event as MouseEvent;
        const element = findElement(target);
        const block = element && elementMap.getBlock(element);
        if (mouse.button === 0 && block) {
          if (mouse.ctrlKey) addSelection([block]);
          else select([block]);
        }
      } else if (event.type === 'focus' || event.type === 'focusin') {
        activate();
        if (target !== stage) focusStage();
      } else if (event.type === 'pointerover') {
        setHover(findElement(target));
      } else if (event.type === 'pointerout') {
        setHover(findElement((event as PointerEvent).relatedTarget));
      } else if (event.type === 'pointerleave' && target === stage) {
        setHover(null);
      }
    };
    const options = {capture: true, passive: false};
    for (const type of inputEvents) document.addEventListener(type, handleInput, options);
    // A preview input may still own focus when switching back to design mode.
    if (stage.contains(document.activeElement)) focusStage();
    return () => {
      for (const type of inputEvents) document.removeEventListener(type, handleInput, true);
    };
  }, [stageRef, designMode, elementMap, select, addSelection, activate]);

  return hover;
}
