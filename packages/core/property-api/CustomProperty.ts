import {
  blankFuncDesc,
  blankPropDesc,
  buildPropDescCache,
  findPropDesc,
  PropDesc,
  PropGroupDesc,
} from '../block/Descriptor.ts';
import {Block} from '../block/Block.ts';
import {BlockProperty} from '../block/BlockProperty.ts';
import {Namespace} from '../block/Namespace.ts';
import {deepClone} from '../util/Clone.ts';
import {endsWithNumberReg} from '../util/String.ts';
import {hideGroupProperties, hideProperties, showGroupProperties, showProperties} from './PropertyShowHide.ts';
import {getInputsLength, MAX_GROUP_LENGTH} from '../block/FunctonData.ts';

/** Copy a connected property's descriptor, preserving the custom property's name. */
export function copyCustomPropertyDescriptor(block: Block, name: string, group?: string): boolean {
  const custom = block.getValue('#custom') as (PropDesc | PropGroupDesc)[];
  if (!Array.isArray(custom)) return false;
  const properties =
    group == null
      ? custom
      : (custom.find((desc) => desc.type === 'group' && desc.name === group) as PropGroupDesc)?.properties;
  const baseName = group == null ? name : name.replace(/\d+$/, '');
  const customDesc = properties?.find((desc) => desc.name === baseName && desc.type !== 'group');
  const property = block.getProperty(name, false);
  if (!customDesc || !property) return false;

  let connected: BlockProperty;
  if (property._bindingSource) {
    connected = property._bindingSource.getProperty();
  } else {
    for (const listener of property._listeners) {
      if (
        listener instanceof BlockProperty &&
        listener._bindingPath &&
        listener._bindingSource?.getProperty() === property
      ) {
        if (connected) return false;
        connected = listener;
      }
    }
  }
  if (!connected) return false;

  const sourceBlock = connected._block;
  const getFuncDesc = (id: unknown) =>
    typeof id === 'string' ? Namespace.getFunctions(id, sourceBlock._flow)?.getDescToSend(id)[0] : undefined;
  const funcDesc = getFuncDesc(sourceBlock.getValue('#is')) ?? blankFuncDesc;
  const sourceCustom = sourceBlock.getValue('#custom');
  const cache = buildPropDescCache(funcDesc, Array.isArray(sourceCustom) ? sourceCustom : []);
  let desc = findPropDesc(connected._name, cache);
  if (desc === blankPropDesc) {
    let optionalDesc = funcDesc;
    const visited = new Set<string>();
    while (optionalDesc) {
      desc = optionalDesc.optional?.[connected._name] ?? blankPropDesc;
      if (desc !== blankPropDesc || !optionalDesc.base || visited.has(optionalDesc.base)) break;
      visited.add(optionalDesc.base);
      optionalDesc = getFuncDesc(optionalDesc.base);
    }
  }
  if (desc === blankPropDesc) return false;

  addCustomProperty(block, {...deepClone(desc), name: baseName}, group);
  return true;
}

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
    } else if (endsWithNumberReg.test(desc.name)) {
      return; // group property should not end with number
    }
  }

  let customProps = block.getValue('#custom') as unknown[];

  if (!Array.isArray(customProps)) {
    // if it's not a child property in a group
    if (groupDesc) {
      block.setValue('#custom', [desc]);
      showGroupProperties(block, groupDesc);
    } else if (group == null) {
      block.setValue('#custom', [desc]);
      if ((desc as PropDesc).pinned) {
        showProperties(block, [desc.name]);
      }
    }
    return;
  }

  // TODO, does shallow clone work? maybe a special version that only deep clones child properties?
  customProps = deepClone(customProps);

  if (group != null) {
    const groupIdx = customProps.findIndex((g: PropGroupDesc) => g.name === group);
    if (groupIdx > -1) {
      if (groupDesc) {
        hideGroupProperties(block, customProps[groupIdx] as PropGroupDesc);
        // replace existing group
        customProps[groupIdx] = groupDesc;
        block.setValue('#custom', customProps);
        showGroupProperties(block, groupDesc);
      } else {
        // add property to existing group
        groupDesc = customProps[groupIdx] as PropGroupDesc;
        const groupChildIdx = groupDesc.properties.findIndex((p: PropDesc) => p.name === propDesc.name);
        if (groupChildIdx > -1) {
          groupDesc.properties[groupChildIdx] = propDesc;
        } else {
          groupDesc.properties.push(propDesc);
          if (propDesc.pinned) {
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
    const propIndex = customProps.findIndex((g: PropDesc) => g.name === propDesc.name);
    if (propIndex > -1) {
      customProps[propIndex] = propDesc;
    } else {
      customProps.push(propDesc);
      if ((desc as PropDesc).pinned) {
        showProperties(block, [desc.name]);
      }
    }
    block.setValue('#custom', customProps);
  }
}

export function removeCustomProperty(block: Block, name: string, group?: string) {
  let customProps = block.getValue('#custom') as unknown[];

  if (!Array.isArray(customProps)) {
    return;
  }

  customProps = deepClone(customProps);
  if (group) {
    const groupIdx = customProps.findIndex((g: PropGroupDesc) => g.name === group && g.type === 'group');
    if (groupIdx > -1) {
      const groupDesc: PropGroupDesc = customProps[groupIdx] as PropGroupDesc;
      if (name) {
        const groupChildIdx = groupDesc.properties.findIndex((p: PropDesc) => p.name === name);
        if (groupChildIdx > -1) {
          groupDesc.properties.splice(groupChildIdx, 1);
          block.setValue('#custom', customProps);
          hideGroupProperties(block, groupDesc, name);

          const gLength = getInputsLength(block, groupDesc.name, groupDesc.defaultLen, groupDesc.maxLen);
          for (let i = 0; i < gLength; ++i) {
            block.deleteValue(`${name}${i}`);
          }
        }
      } else {
        customProps.splice(groupIdx, 1);
        block.setValue('#custom', customProps);
        hideGroupProperties(block, groupDesc, null);
        const gLength = getInputsLength(block, groupDesc.name, groupDesc.defaultLen, groupDesc.maxLen);
        for (const prop of groupDesc.properties) {
          const baseName = prop.name;
          for (let i = 0; i < gLength; ++i) {
            block.deleteValue(`${baseName}${i}`);
          }
        }
        hideProperties(block, [`${group}[]`]);
        block.deleteValue(`${group}[]`);
      }
    }
  } else if (name) {
    const propIndex = customProps.findIndex((g: PropDesc) => g.name === name);
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

  let customProps = block.getValue('#custom') as unknown[];
  if (!Array.isArray(customProps)) {
    return;
  }
  customProps = deepClone(customProps);

  let targetProps = customProps;
  if (group != null) {
    const foundGroup = customProps.find((g: PropGroupDesc) => g.name === group && g.type === 'group') as PropGroupDesc;
    if (foundGroup) {
      targetProps = foundGroup.properties;
    } else {
      return;
    }
  }

  const idxFrom = targetProps.findIndex((p: PropDesc | PropGroupDesc) => p.name === nameFrom);
  const idxTo = targetProps.findIndex((p: PropDesc | PropGroupDesc) => p.name === nameTo);
  if (idxFrom > -1 && idxTo > -1) {
    const from = targetProps.splice(idxFrom, 1)[0];
    targetProps.splice(idxTo, 0, from);
    block.setValue('#custom', customProps);
  }
}
