import {PropDesc, PropGroupDesc} from "../block/Descriptor";
import {Block} from "../block/Block";
import {deepClone} from "./Clone";


export function addMoreProperty(block: Block, desc: PropDesc | PropGroupDesc, group?: string) {

  let propDesc: PropDesc;
  let groupDesc: PropGroupDesc;
  if ((desc as PropGroupDesc).group) {
    groupDesc = desc as PropGroupDesc;
    if (Array.isArray(groupDesc.properties)) {
      groupDesc.properties = [];
    }
    group = groupDesc.group;
  } else if ((desc as PropDesc).name) {
    propDesc = desc as PropDesc;
  } else {
    return;
  }

  let moreProps = block.getValue('#more');

  if (!Array.isArray(moreProps)) {
    if (groupDesc || !group) {
      // if it's not not child property in a group
      block.setValue('#more', [desc]);
    }
    return;
  } else {
     moreProps = deepClone(moreProps);
  }

  if (group) {
    let groupIdx = moreProps.findIndex((g: PropGroupDesc) => g.group === group);
    if (groupIdx > -1) {
      if (groupDesc) {
        // replace existing group
        moreProps[groupIdx] = groupDesc;
        block.setValue('#more', moreProps);
        return;
      } else {
        // add property to existing group
        groupDesc = moreProps[groupIdx];
        let groupChildIdx = groupDesc.properties.findIndex((p: PropDesc) => p.name === propDesc.name);
        if (groupChildIdx > -1) {
          groupDesc.properties[groupChildIdx] = propDesc;
        } else {
          groupDesc.properties.push(propDesc);
        }
        block.setValue('#more', moreProps);
        return;
      }
    } else if (groupDesc) {
      // add a new group
      moreProps.push(groupDesc);
      block.setValue('#more', moreProps);
      return;
    }
  } else {
    let propIndex = moreProps.findIndex((g: PropDesc) => g.name === propDesc.name);
    if (propIndex > -1) {
      moreProps[propIndex] = propDesc;
    } else {

    }
  }
}