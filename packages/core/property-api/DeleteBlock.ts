import {Block} from '../block/Block.ts';
import {isStringArray} from '../util/DataTypes.ts';

/** Deletes a child block and removes its name from the parent's #order and #addon. */
export function deleteBlock(parent: Block, name: string): void {
  parent.setValue(name, undefined);
  const property = parent.getProperty('#order', false);
  const order = property?.getValue();
  if (!property?._bindingSource && isStringArray(order) && order.includes(name)) {
    parent.setValue(
      '#order',
      order.filter((child) => child !== name)
    );
  }
  const addonProp = parent.getProperty('#addon', false);
  const addons = addonProp?.getValue();
  if (!addonProp?._bindingSource && isStringArray(addons) && addons.includes(name)) {
    const nextAddons = addons.filter((child) => child !== name);
    parent.setValue('#addon', nextAddons.length ? nextAddons : undefined);
  }
}
