import {Block} from '../block/Block.ts';

/** Deletes a child block and removes its name from the parent's #order. */
export function deleteBlock(parent: Block, name: string): void {
  parent.setValue(name, undefined);
  const order = parent.getValue('#order');
  if (Array.isArray(order) && order.includes(name)) {
    parent.setValue(
      '#order',
      order.filter((child) => child !== name)
    );
  }
}
