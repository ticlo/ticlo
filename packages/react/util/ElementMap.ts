import type {Block} from '@ticlo/core';

function removeElement(elements: Element[] | undefined, element: Element) {
  const index = elements?.indexOf(element) ?? -1;
  if (index >= 0) elements.splice(index, 1);
}

/** DOM registrations belong to one rendered page, including in preview mode. */
export class ElementMap {
  private elements = new WeakMap<Block, Element[]>();
  private blocks = new WeakMap<Element, Block>();
  private listeners = new Set<(block: Block) => void>();

  connect(block: Block, element: Element): () => void {
    const previous = this.getBlock(element);
    if (previous) removeElement(this.elements.get(previous), element);
    let elements = this.elements.get(block);
    if (!elements) {
      elements = [];
      this.elements.set(block, elements);
    }
    if (!elements.includes(element)) elements.push(element);
    this.blocks.set(element, block);
    if (previous && previous !== block) this.notify(previous);
    this.notify(block);
    return () => {
      this.blocks.delete(element);
      removeElement(elements, element);
      this.notify(block);
    };
  }

  getElements(block: Block): readonly Element[] | undefined {
    return this.elements.get(block);
  }

  getBlock(element: Element): Block | undefined {
    return this.blocks.get(element);
  }

  findElementFromParent(element: Element, scope: Element): Element | null {
    for (let target: Element | null = element; target && target !== scope; target = target.parentElement) {
      if (this.blocks.has(target)) return target;
    }
    return null;
  }

  subscribe(listener: (block: Block) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(block: Block) {
    for (const listener of this.listeners) listener(block);
  }
}
