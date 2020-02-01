import {Block} from '../block/Block';
import {configDescs, PropDesc, PropGroupDesc, shouldShowProperty} from '../block/Descriptor';
import {Functions} from '../block/Functions';
import {HelperProperty} from '../block/BlockProperty';
import {getPreNumber} from '../util/String';
import {getGroupLength} from './GroupProperty';

const configList = Object.keys(configDescs);

export function buildPropertiesOrder(block: Block): string[] {
  let orders = [...configList];

  function addProps(props: (PropDesc | PropGroupDesc)[]) {
    for (let propDesc of props) {
      if (propDesc.type === 'group') {
        let lenField = `${propDesc.name}#len`;
        orders.push(lenField);
        let groupLength =  getGroupLength(block, propDesc);
        for (let i = 0; i < groupLength; ++i) {
          for (let childDesc of (propDesc as PropGroupDesc).properties) {
            orders.push(`${childDesc.name}${i}`);
          }
        }
      } else {
        orders.push(propDesc.name);
      }
    }
  }

  let [desc, size] = Functions.getDescToSend(block.getValue('#is'));
  if (desc) {
    addProps(desc.properties);
  }

  let optionalFields: string[] = block.getValue('#optional');
  if (Array.isArray(optionalFields)) {
    for (let field of optionalFields) {
      if (!orders.includes(field)) {
        orders.push(field);
      }
    }
  }

  let customProps = block.getValue('#custom');
  if (Array.isArray(customProps)) {
    addProps(customProps);
  }
  return orders;
}

/** show one or more properties in the block
 * automatically adjust the order
 */
export function showProperties(block: Block, fields: string[]) {
  let bp = block.getValue('@b-p');
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
  let searchForOrder: string[] = [];
  for (let field of fields) {
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
    let orders = buildPropertiesOrder(block);
    addField: for (let field of searchForOrder) {
      let idx = orders.indexOf(field);
      if (idx < 0) {
        blockProps.push(field);
      } else {
        let d = Math.max(idx, orders.length - 1 - idx);
        for (let i = 1; i <= d; ++i) {
          // insert after a reference field before it
          let left = idx - i;
          if (left >= 0) {
            let refpos = blockProps.indexOf(orders[left]);
            if (refpos > -1) {
              blockProps.splice(refpos + 1, 0, field);
              continue addField;
            }
          }

          // insert before a reference field after it
          let right = idx + i;
          if (right < orders.length) {
            let refpos = blockProps.indexOf(orders[right]);
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
  let groupLength = getGroupLength(block, desc);
  let fields: string[] = [];
  if (field != null) {
    for (let i = 0; i < groupLength; ++i) {
      fields.push(`${field}${i}`);
    }
  } else {
    for (let prop of desc.properties) {
      if (prop.visible !== 'low') {
        for (let i = 0; i < groupLength; ++i) {
          fields.push(`${prop.name}${i}`);
        }
      }
    }
  }
  showProperties(block, fields);
}

export function hideProperties(block: Block, fields: string[]) {
  let bp = block.getValue('@b-p');
  if (!Array.isArray(bp)) {
    return;
  }
  let blockProps: string[] = [...bp];
  let changeNeeded = false;
  for (let field of fields) {
    let idx = blockProps.indexOf(field);
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
  let bp = block.getValue('@b-p');
  if (!Array.isArray(bp)) {
    return;
  }

  let fieldsToRemove = [];
  if (field != null) {
    fieldsToRemove.push(field);
  } else {
    for (let prop of desc.properties) {
      fieldsToRemove.push(prop.name);
    }
  }

  let blockProps: string[] = [...bp];
  let changeNeeded = false;
  for (let field of fieldsToRemove) {
    for (let i = 0; i < blockProps.length; ++i) {
      let prop = blockProps[i];
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
  let bp = block.getValue('@b-p');
  if (!Array.isArray(bp) || fieldFrom === fieldTo) {
    return;
  }
  let idxFrom = bp.indexOf(fieldFrom);
  let idxTo = bp.indexOf(fieldTo);

  if (idxFrom > -1 && idxTo > -1) {
    bp = bp.concat(); // make a copy
    bp.splice(idxFrom, 1);
    bp.splice(idxTo, 0, fieldFrom);
    block.setValue('@b-p', bp);
  }
}
