import {Block} from '../block/Block.js';
import {configDescs, PropDesc, PropGroupDesc} from '../block/Descriptor.js';
import {Functions} from '../block/Functions.js';
import {getPreNumber} from '../util/String.js';
import {getInputsLength, MAX_GROUP_LENGTH} from '../block/FunctonData.js';

const configList = Object.keys(configDescs).filter((str: string) => !str.endsWith(')'));

export function buildPropertiesOrder(block: Block): string[] {
  const orders = [...configList];

  function addProps(props: (PropDesc | PropGroupDesc)[]) {
    for (const propDesc of props) {
      if (propDesc.type === 'group') {
        const lenField = `${propDesc.name}[]`;
        orders.push(lenField);
        const groupLength = getInputsLength(block, propDesc.name, propDesc.defaultLen, propDesc.maxLen);
        for (let i = 0; i < groupLength; ++i) {
          for (const childDesc of (propDesc as PropGroupDesc).properties) {
            orders.push(`${childDesc.name}${i}`);
          }
        }
      } else {
        orders.push(propDesc.name);
      }
    }
  }

  const [desc, size] = Functions.getDescToSend(block.getValue('#is')?.toString());
  if (desc) {
    addProps(desc.properties);
  }

  const optionalFields = block.getValue('+optional') as string[];
  if (Array.isArray(optionalFields)) {
    for (const field of optionalFields) {
      if (!orders.includes(field)) {
        orders.push(field);
      }
    }
  }

  const customProps = block.getValue('#custom');
  if (Array.isArray(customProps)) {
    addProps(customProps);
  }
  return orders;
}

/** show one or more properties in the block
 * automatically adjust the order
 */
export function showProperties(block: Block, fields: string[]) {
  const bp = block.getValue('@b-p');
  let changeNeeded = false;
  let blockProps: string[];
  if (!Array.isArray(bp)) {
    if (fields.length <= 1) {
      block.setValue('@b-p', fields);
      return;
    }
    blockProps = [];
    changeNeeded = true;
  } else {
    blockProps = [...bp];
  }
  const searchForOrder: string[] = [];
  for (const field of fields) {
    if (!blockProps.includes(field)) {
      changeNeeded = true;
      if (field.startsWith('@')) {
        // attributes doesn't care about order
        blockProps.push(field);
      } else {
        searchForOrder.push(field);
      }
    }
  }
  if (searchForOrder.length) {
    const orders = buildPropertiesOrder(block);
    addField: for (const field of searchForOrder) {
      const idx = orders.indexOf(field);
      if (idx < 0) {
        blockProps.push(field);
      } else {
        const d = Math.max(idx, orders.length - 1 - idx);
        for (let i = 1; i <= d; ++i) {
          // insert after a reference field before it
          const left = idx - i;
          if (left >= 0) {
            const refpos = blockProps.indexOf(orders[left]);
            if (refpos > -1) {
              blockProps.splice(refpos + 1, 0, field);
              continue addField;
            }
          }

          // insert before a reference field after it
          const right = idx + i;
          if (right < orders.length) {
            const refpos = blockProps.indexOf(orders[right]);
            if (refpos > -1) {
              blockProps.splice(refpos, 0, field);
              continue addField;
            }
          }
        }
        // not found? just insert in the end
        blockProps.push(field);
      }
    }
  } else if (!changeNeeded) {
    return;
  }
  block.setValue('@b-p', blockProps);
}

export function showGroupProperties(block: Block, desc: PropGroupDesc, field?: string) {
  if (desc.type !== 'group') {
    return;
  }
  const groupLength = getInputsLength(block, desc.name, desc.defaultLen, desc.maxLen);
  const fields: string[] = [];
  if (field != null) {
    for (let i = 0; i < groupLength; ++i) {
      fields.push(`${field}${i}`);
    }
  } else {
    for (const prop of desc.properties) {
      if (prop.pinned) {
        for (let i = 0; i < groupLength; ++i) {
          fields.push(`${prop.name}${i}`);
        }
      }
    }
  }
  showProperties(block, fields);
}

export function hideProperties(block: Block, fields: string[]) {
  const bp = block.getValue('@b-p');
  if (!Array.isArray(bp)) {
    return;
  }
  const blockProps: string[] = [...bp];
  let changeNeeded = false;
  for (const field of fields) {
    const idx = blockProps.indexOf(field);
    if (idx > -1) {
      blockProps.splice(idx, 1);
      changeNeeded = true;
    }
  }
  if (changeNeeded) {
    if (blockProps.length === 0) {
      block.deleteValue('@b-p');
    } else {
      block.setValue('@b-p', blockProps);
    }
  }
}

export function hideGroupProperties(block: Block, desc: PropGroupDesc, field?: string) {
  if (desc.type !== 'group') {
    return;
  }
  const bp = block.getValue('@b-p');
  if (!Array.isArray(bp)) {
    return;
  }

  const fieldsToRemove = [];
  if (field != null) {
    fieldsToRemove.push(field);
  } else {
    for (const prop of desc.properties) {
      fieldsToRemove.push(prop.name);
    }
  }

  const blockProps: string[] = [...bp];
  let changeNeeded = false;
  for (const field of fieldsToRemove) {
    for (let i = 0; i < blockProps.length; ++i) {
      const prop = blockProps[i];
      if (getPreNumber(prop) === field) {
        blockProps.splice(i, 1);
        --i;
        changeNeeded = true;
      }
    }
  }

  if (changeNeeded) {
    if (blockProps.length === 0) {
      block.deleteValue('@b-p');
    } else {
      block.setValue('@b-p', blockProps);
    }
  }
}

export function moveShownProperty(block: Block, fieldFrom: string, fieldTo: string) {
  let bp = block.getValue('@b-p') as unknown[];
  if (!Array.isArray(bp) || fieldFrom === fieldTo) {
    return;
  }
  const idxFrom = bp.indexOf(fieldFrom);
  const idxTo = bp.indexOf(fieldTo);

  if (idxFrom > -1 && idxTo > -1) {
    bp = bp.concat(); // make a copy
    bp.splice(idxFrom, 1);
    bp.splice(idxTo, 0, fieldFrom);
    block.setValue('@b-p', bp);
  }
}
