import {Block, type BlockProperty} from '@ticlo/core';
import {getChildrenScreenCTM} from '@ticlo/html';
import type {ElementMap} from '@ticlo/react';

interface MoveTarget {
  block: Block;
  helper: Block | null;
  createHelper: boolean;
  style: Record<string, unknown>;
  x: 'left' | 'right';
  y: 'top' | 'bottom';
  left: number;
  top: number;
  optional: string[];
  addOptional: boolean;
  zoom: number;
}

function restore(property: BlockProperty | undefined) {
  if (!property) return;
  if (property._saved !== undefined || property._bindingSource) property.revertUpdate();
  else property.updateValue(undefined);
}

function getMoveTarget(block: Block, element: Element): MoveTarget | null {
  if (block._destroyed || !element.isConnected) return null;
  const computed = element.ownerDocument.defaultView.getComputedStyle(element);
  if (computed.position !== 'absolute') return null;
  const property = block.getProperty('style', false);
  const helper = property?._helperProperty?.getValue();
  const ownHelper =
    helper instanceof Block && helper.getParent() === block && helper.getValue('#is') === 'html:create-style';
  if (!ownHelper && (property?._bindingPath != null || property?._bindingSource)) return null;
  const saved = property?._saved;
  if (!ownHelper && saved != null && (typeof saved !== 'object' || Array.isArray(saved) || saved instanceof Block))
    return null;
  const value = block.getValue('style');
  const style: Record<string, unknown> = value && typeof value === 'object' ? {...value} : {};
  const defined = (name: string) => {
    const prop = ownHelper && helper.getProperty(name, false);
    return style[name] != null || (prop && (prop._saved !== undefined || prop._bindingPath != null));
  };
  const x = !defined('left') && defined('right') ? 'right' : 'left';
  const y = !defined('top') && defined('bottom') ? 'bottom' : 'top';
  const optionalValue = ownHelper && helper.getValue('#optional');
  const optional: string[] = Array.isArray(optionalValue) ? optionalValue.slice() : [];
  const addOptional = !optional.includes(x) || !optional.includes(y);
  if (!optional.includes(x)) optional.push(x);
  if (!optional.includes(y)) optional.push(y);
  return {
    block,
    helper: ownHelper ? helper : null,
    createHelper: !ownHelper && saved == null,
    style,
    x,
    y,
    left: parseFloat(computed[x]) || 0,
    top: parseFloat(computed[y]) || 0,
    optional,
    addOptional,
    zoom: parseFloat(computed.zoom) || 1,
  };
}

/** A gesture previews runtime values, then either saves them or restores their sources. */
export function createStageMove(block: Block, element: Element, selected: Block[], elementMap: ElementMap) {
  const reference = getMoveTarget(block, element);
  if (!reference || !element.parentElement) return null;
  const matrix = getChildrenScreenCTM(element.parentElement)?.inverse();
  if (!matrix || ![matrix.a, matrix.b, matrix.c, matrix.d].every(Number.isFinite)) return null;
  const targets = [reference];
  for (const other of selected) {
    if (other === block) continue;
    const otherElement = elementMap.getElements(other)?.find((item) => item.isConnected);
    const target = otherElement && getMoveTarget(other, otherElement);
    if (target) targets.push(target);
  }
  let dx = 0;
  let dy = 0;
  const positions = (target: MoveTarget) => ({
    [target.x]: target.left + (target.x === 'right' ? -dx : dx),
    [target.y]: target.top + (target.y === 'bottom' ? -dy : dy),
  });
  const cancel = () => {
    for (const {block, helper, x, y, addOptional} of targets) {
      if (block._destroyed || helper?._destroyed) continue;
      if (helper) {
        if (addOptional) restore(helper.getProperty('#optional', false));
        restore(helper.getProperty(x, false));
        restore(helper.getProperty(y, false));
      } else {
        restore(block.getProperty('style', false));
      }
    }
  };
  return {
    update(screenX: number, screenY: number) {
      dx = (matrix.a * screenX + matrix.c * screenY) / reference.zoom;
      dy = (matrix.b * screenX + matrix.d * screenY) / reference.zoom;
      for (const target of targets) {
        const {block, helper, optional, addOptional} = target;
        if (block._destroyed || helper?._destroyed) continue;
        const values = positions(target);
        if (helper) {
          if (addOptional) helper.updateValue('#optional', optional);
          for (const [name, value] of Object.entries(values)) helper.updateValue(name, value);
        } else {
          block.updateValue('style', {...target.style, ...values});
        }
      }
    },
    commit() {
      if (dx === 0 && dy === 0) {
        cancel();
        return false;
      }
      let changed = false;
      for (const target of targets) {
        const {block, style, optional, addOptional} = target;
        let {helper} = target;
        if (block._destroyed || helper?._destroyed) continue;
        const values = positions(target);
        if (target.createHelper) {
          helper = block.createHelperBlock('style');
          helper.setValue('#is', 'html:create-style');
        }
        if (helper) {
          if (addOptional) helper.setValue('#optional', optional);
          for (const [name, value] of Object.entries(values)) helper.setValue(name, value);
        } else {
          block.setValue('style', {...style, ...values});
        }
        changed = true;
      }
      return changed;
    },
    cancel,
  };
}
