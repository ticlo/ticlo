import {Block} from '@ticlo/core';

const elementToBlockMap: WeakMap<Element, Block> = new WeakMap();
const blockToElementMap: WeakMap<Block, Element> = new WeakMap();

export function connectElementToBlock(block: Block, element: Element) {
  blockToElementMap.set(block, element);
  elementToBlockMap.set(element, block);
}

export function findElementByBlock(block: Block) {
  return blockToElementMap.get(block);
}

export function findBlockByElement(element: Element) {
  return elementToBlockMap.get(element);
}

export function findBlockFromParent(element: Element, scope: Element | null = null) {
  for (let target: Element | null = element; target && target !== scope; target = target.parentElement) {
    const block = elementToBlockMap.get(element);
    if (block) {
      return block;
    }
  }
  return null;
}
