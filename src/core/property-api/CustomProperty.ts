import {PropDesc, PropGroupDesc} from '../block/Descriptor';
import {Block} from '../block/Block';
import {deepClone} from '../util/Clone';
import {endsWithNumberReg} from '../util/String';
import {hideGroupProperties, hideProperties, showGroupProperties, showProperties} from './PropertyShowHide';

export function addCustomProperty(block: Block, desc: PropDesc | PropGroupDesc, group?: string) {
  let propDesc: PropDesc;
  let groupDesc: PropGroupDesc;
  if (desc.type === 'group') {
    groupDesc = desc as PropGroupDesc;
    if (!Array.isArray(groupDesc.properties)) {
      groupDesc.properties = [];
    }
    if (groupDesc.defaultLen == null || !(groupDesc.defaultLen >= 0)) {
      groupDesc.defaultLen = 2;
    }
    group = groupDesc.name;
  } else {
    propDesc = desc as PropDesc;
    if (group == null) {
      if (!desc.name) {
        return; // not allow empty property unless it's in a group
      }
    } else if (desc.name.match(endsWithNumberReg)) {
      return; // group property should not end with number
    }
  }

  let customProps = block.getValue('#custom');

  if (!Array.isArray(customProps)) {
    // if it's not a child property in a group
    if (groupDesc) {
      block.setValue('#custom', [desc]);
      showGroupProperties(block, groupDesc);
    } else if (group == null) {
      block.setValue('#custom', [desc]);
      if ((desc as PropDesc).visible !== 'low') {
        showProperties(block, [desc.name]);
      }
    }
    return;
  }

  // TODO, does shallow clone work? maybe a special version that only deep clones child properties?
  customProps = deepClone(customProps);

  if (group != null) {
    let groupIdx = customProps.findIndex((g: PropGroupDesc) => g.name === group);
    if (groupIdx > -1) {
      if (groupDesc) {
        hideGroupProperties(block, customProps[groupIdx]);
        // replace existing group
        customProps[groupIdx] = groupDesc;
        block.setValue('#custom', customProps);
        showGroupProperties(block, groupDesc);
      } else {
        // add property to existing group
        groupDesc = customProps[groupIdx];
        let groupChildIdx = groupDesc.properties.findIndex((p: PropDesc) => p.name === propDesc.name);
        if (groupChildIdx > -1) {
          groupDesc.properties[groupChildIdx] = propDesc;
        } else {
          groupDesc.properties.push(propDesc);
          if (propDesc.visible !== 'low') {
            showGroupProperties(block, groupDesc, propDesc.name);
          }
        }
        block.setValue('#custom', customProps);
      }
    } else if (groupDesc) {
      // add a new group
      customProps.push(groupDesc);
      block.setValue('#custom', customProps);
      showGroupProperties(block, groupDesc);
    }
  } else {
    let propIndex = customProps.findIndex((g: PropDesc) => g.name === propDesc.name);
    if (propIndex > -1) {
      customProps[propIndex] = propDesc;
    } else {
      customProps.push(propDesc);
      if ((desc as PropDesc).visible !== 'low') {
        showProperties(block, [desc.name]);
      }
    }
    block.setValue('#custom', customProps);
  }
}

export function removeCustomProperty(block: Block, name: string, group?: string) {
  let customProps: any[] = block.getValue('#custom');

  if (!Array.isArray(customProps)) {
    return;
  }

  customProps = deepClone(customProps);
  if (group) {
    let groupIdx = customProps.findIndex((g: PropGroupDesc) => g.name === group && g.type === 'group');
    if (groupIdx > -1) {
      let groupDesc: PropGroupDesc = customProps[groupIdx];
      if (name) {
        let groupChildIdx = groupDesc.properties.findIndex((p: PropDesc) => p.name === name);
        if (groupChildIdx > -1) {
          groupDesc.properties.splice(groupChildIdx, 1);
          block.setValue('#custom', customProps);
          hideGroupProperties(block, groupDesc, name);

          let gLength = block.getLength(groupDesc.name, groupDesc.defaultLen);
          for (let i = 0; i < gLength; ++i) {
            block.deleteValue(`${name}${i}`);
          }
        }
      } else {
        customProps.splice(groupIdx, 1);
        block.setValue('#custom', customProps);
        hideGroupProperties(block, groupDesc, null);
        let gLength = block.getLength(groupDesc.name, groupDesc.defaultLen);
        for (let prop of groupDesc.properties) {
          let baseName = prop.name;
          for (let i = 0; i < gLength; ++i) {
            block.deleteValue(`${baseName}${i}`);
          }
        }
      }
    }
  } else if (name) {
    let propIndex = customProps.findIndex((g: PropDesc) => g.name === name);
    if (propIndex > -1) {
      if (customProps.length > 1) {
        customProps.splice(propIndex, 1);
      } else {
        customProps = undefined;
      }
      block.setValue('#custom', customProps);
      hideProperties(block, [name]);
      block.deleteValue(name);
    }
  }
}

export function moveCustomProperty(block: Block, nameFrom: string, nameTo: string, group?: string) {
  if (nameFrom === nameTo) {
    return;
  }

  let customProps: any[] = block.getValue('#custom');
  if (!Array.isArray(customProps)) {
    return;
  }
  customProps = deepClone(customProps);

  let targetProps = customProps;
  if (group != null) {
    let foundGroup: PropGroupDesc = customProps.find((g: PropGroupDesc) => g.name === group && g.type === 'group');
    if (foundGroup) {
      targetProps = foundGroup.properties;
    } else {
      return;
    }
  }

  let idxFrom = targetProps.findIndex((p: PropDesc | PropGroupDesc) => p.name === nameFrom);
  let idxTo = targetProps.findIndex((p: PropDesc | PropGroupDesc) => p.name === nameTo);
  if (idxFrom > -1 && idxTo > -1) {
    let from = targetProps.splice(idxFrom, 1)[0];
    targetProps.splice(idxTo, 0, from);
    block.setValue('#custom', customProps);
  }
}
