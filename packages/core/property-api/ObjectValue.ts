import {Block, BlockProperty, DataMap} from '../index.js';

export function updateObjectValue(block: Block, field: string, value: DataMap) {
  let prop = block.getProperty(field);
  if (prop._value?.constructor === Object) {
    let newValue = {...prop._value};
    let changed = false;
    for (let key in value) {
      if (!Object.is(newValue[key], value[key])) {
        newValue[key] = value[key];
        changed = true;
      }
    }
    if (changed) {
      prop.updateValue(newValue);
    }
  } else {
    prop.updateValue(value);
  }
}
