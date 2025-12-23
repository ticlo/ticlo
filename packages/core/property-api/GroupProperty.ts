import {Block} from '../block/Block.js';
import {HelperProperty} from '../block/BlockProperty.js';
import {PropDesc, PropGroupDesc} from '../block/Descriptor.js';
import {Functions} from '../block/Functions.js';
import {hideProperties, showProperties} from './PropertyShowHide.js';
import {PropertyMover} from './PropertyMover.js';
import {getInputsLength, MAX_GROUP_LENGTH} from '../block/FunctonData.js';

function findGroupDesc(block: Block, group: string): PropGroupDesc {
  let groupDesc: PropGroupDesc;

  function findGroup(props: (PropDesc | PropGroupDesc)[]): PropGroupDesc {
    for (let propDesc of props) {
      if (propDesc.name === group && propDesc.type === 'group') {
        return propDesc as PropGroupDesc;
      }
    }
    return null;
  }

  let [desc, size] = Functions.getDescToSend(block.getValue('#is')?.toString());
  if (desc) {
    groupDesc = findGroup(desc.properties);
  }
  if (!groupDesc) {
    let customProps = block.getValue('#custom');
    if (Array.isArray(customProps)) {
      groupDesc = findGroup(customProps);
    }
  }
  return groupDesc;
}

function updateGroupPropertyLength(block: Block, group: string, groupDesc: PropGroupDesc, length: number) {
  let lengthField = `${group}[]`;
  let oldLength = getInputsLength(block, group, groupDesc.defaultLen, groupDesc.maxLen);
  let newLength = length;
  if (!(newLength >= 0)) {
    newLength = groupDesc.defaultLen;
  } else {
    const maxLen = groupDesc.maxLen ?? MAX_GROUP_LENGTH;
    if (newLength > maxLen) {
      newLength = maxLen;
    }
  }

  block.setValue(lengthField, length);

  if (newLength > oldLength) {
    // show properties in block
    let propsToShow: string[] = [];
    let isSubBlock = block._prop instanceof HelperProperty;
    for (let i = oldLength; i < newLength; ++i) {
      for (let prop of groupDesc.properties) {
        if (prop.pinned && !(isSubBlock && prop.name === '#output')) {
          propsToShow.push(`${prop.name}${i}`);
        }
      }
    }
    showProperties(block, propsToShow);
  } else if (newLength < oldLength) {
    // clear and hide properties
    let propsToHide: string[] = [];
    for (let i = newLength; i < oldLength; ++i) {
      for (let prop of groupDesc.properties) {
        let propName = `${prop.name}${i}`;
        block.deleteValue(propName);
        propsToHide.push(propName);
      }
    }
    hideProperties(block, propsToHide);
  }
}

export function insertGroupProperty(block: Block, group: string, idx: number) {
  let groupDesc = findGroupDesc(block, group);
  if (!groupDesc) {
    return;
  }
  let oldLength = getInputsLength(block, group, groupDesc.defaultLen, groupDesc.maxLen);
  if (idx < 0 || idx > oldLength || Math.round(idx) !== idx) {
    // invalid idx
    return;
  }
  // move properties
  for (let i = oldLength - 1; i >= idx; --i) {
    for (let prop of groupDesc.properties) {
      new PropertyMover(block, `${prop.name}${i}`, true).moveTo(`${prop.name}${i + 1}`);
    }
  }
  updateGroupPropertyLength(block, group, groupDesc, oldLength + 1);
}

export function removeGroupProperty(block: Block, group: string, idx: number) {
  let groupDesc = findGroupDesc(block, group);
  if (!groupDesc) {
    return;
  }
  let oldLength = getInputsLength(block, group, groupDesc.defaultLen, groupDesc.maxLen);
  if (idx < 0 || idx >= oldLength || Math.round(idx) !== idx) {
    // invalid idx
    return;
  }
  // move properties
  for (let i = idx + 1; i < oldLength; ++i) {
    for (let prop of groupDesc.properties) {
      new PropertyMover(block, `${prop.name}${i}`, true).moveTo(`${prop.name}${i - 1}`);
    }
  }
  updateGroupPropertyLength(block, group, groupDesc, oldLength - 1);
}

export function moveGroupProperty(block: Block, group: string, oldIdx: number, newIdx: number) {
  let groupDesc = findGroupDesc(block, group);
  if (!groupDesc) {
    return;
  }
  let length = getInputsLength(block, group, groupDesc.defaultLen, groupDesc.maxLen);
  if (
    oldIdx < 0 ||
    oldIdx >= length ||
    Math.round(oldIdx) !== oldIdx ||
    newIdx < 0 ||
    newIdx >= length ||
    Math.round(newIdx) !== newIdx ||
    oldIdx === newIdx
  ) {
    // invalid idx
    return;
  }
  let step = 1;
  if (oldIdx > newIdx) {
    step = -1;
  }
  // move properties
  let oldMovers: Map<string, PropertyMover> = new Map();
  for (let prop of groupDesc.properties) {
    oldMovers.set(prop.name, new PropertyMover(block, `${prop.name}${oldIdx}`, true));
  }
  for (let i = oldIdx; i !== newIdx; i += step) {
    for (let prop of groupDesc.properties) {
      new PropertyMover(block, `${prop.name}${i + step}`, true).moveTo(`${prop.name}${i}`);
    }
  }
  for (let [name, mover] of oldMovers) {
    mover.moveTo(`${name}${newIdx}`);
  }
}

export function setGroupLength(block: Block, group: string, length: number) {
  let groupDesc = findGroupDesc(block, group);

  if (!groupDesc) {
    // still can't find the group, only set value
    block.setValue(`${group}[]`, length);
    return;
  }
  updateGroupPropertyLength(block, group, groupDesc, length);
}
