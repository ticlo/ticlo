import {Block} from "../block/Block";
import {BlockProperty} from "../block/BlockProperty";

function isPropertyEmpty(prop: BlockProperty) {
  return prop._value === undefined && prop._bindingPath === undefined;
}

let trailingNumberReg = /\d+$/;

export function anyChildProperty(block: Block, baseName: string): BlockProperty {
  let p = block.getProperty(baseName, true);
  if (isPropertyEmpty(p)) {
    return p;
  }
  baseName = baseName.replace(trailingNumberReg, '');
  for (let i = 0; ; ++i) {
    p = block.getProperty(`${baseName}${i}`, true);
    if (isPropertyEmpty(p)) {
      return p;
    }
  }
}