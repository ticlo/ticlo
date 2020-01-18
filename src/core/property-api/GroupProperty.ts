import {Block} from '../block/Block';
import {BlockProperty, HelperProperty} from '../block/BlockProperty';
import {PropDesc, PropGroupDesc, shouldShowProperty} from '../block/Descriptor';
import {Functions} from '../block/Functions';
import {buildPropertiesOrder, hideProperties, showProperties} from './PropertyShowHide';
import {PropertyMover} from './PropertyMover';

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

  let [desc, size] = Functions.getDesc(block.getValue('#is'));
  if (desc) {
    groupDesc = findGroup(desc.properties);
  }
  if (!groupDesc) {
    let moreProps = block.getValue('#more');
    if (Array.isArray(moreProps)) {
      groupDesc = findGroup(moreProps);
    }
  }
  return groupDesc;
}

function updateGroupPropertyLength(block: Block, group: string, groupDesc: PropGroupDesc, length: number) {
  let lengthField = `${group}#len`;
  let oldLength = block.getValue(lengthField);
  if (!(oldLength >= 0)) {
    oldLength = groupDesc.defaultLen;
  }
  let newLength = length;
  if (!(newLength >= 0)) {
    newLength = groupDesc.defaultLen;
  }

  block.setValue(lengthField, length);

  if (newLength > oldLength) {
    // show properties in block
    let propsToShow: string[] = [];
    let isSubBlock = block._prop instanceof HelperProperty;
    for (let i = oldLength; i < newLength; ++i) {
      for (let prop of groupDesc.properties) {
        if (shouldShowProperty(prop.visible, isSubBlock)) {
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
  let lengthField = `${group}#len`;
  let oldLength = block.getValue(lengthField);
  if (!(oldLength >= 0)) {
    oldLength = groupDesc.defaultLen;
  }
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
  let lengthField = `${group}#len`;
  let oldLength = block.getValue(lengthField);
  if (!(oldLength >= 0)) {
    oldLength = groupDesc.defaultLen;
  }
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
  let lengthField = `${group}#len`;
  let length = block.getValue(lengthField);
  if (!(length >= 0)) {
    length = groupDesc.defaultLen;
  }
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
    block.setValue(`${group}#len`, length);
    return;
  }
  updateGroupPropertyLength(block, group, groupDesc, length);
}
