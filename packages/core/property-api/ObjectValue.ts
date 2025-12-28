import {Block, BlockProperty, DataMap} from '../index.js';

export function updateObjectValue(block: Block, field: string, value: DataMap) {
  const prop = block.getProperty(field);
  if (prop._value?.constructor === Object) {
    const newValue = {...prop._value};
    let changed = false;
    for (const key in value) {
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
