import {Block} from "../block/Block";
import {BlockProperty, HelperProperty} from "../block/BlockProperty";
import {PropDesc, PropGroupDesc, shouldShowProperty} from "../block/Descriptor";
import {Types} from "../block/Type";
import {hideProperties, showProperties} from "./PropertyShowHide";


let trailingNumberReg = /\d+$/;

export function anyChildProperty(block: Block, baseName: string): BlockProperty {
  let p = block.getProperty(baseName);
  if (p.isCleared()) {
    return p;
  }
  baseName = baseName.replace(trailingNumberReg, '');
  for (let i = 0; ; ++i) {
    p = block.getProperty(`${baseName}${i}`);
    if (p.isCleared()) {
      return p;
    }
  }
}

/**
 *
 * @param block
 * @param callback return true on sub block to skip children properties
 */
export function iterateProperties(block: Block, callback: (property: BlockProperty) => boolean) {
  for (let [name, prop] of block._props) {
    if (!prop.isCleared()) {
      let skipChildren = callback(prop);
      if (!skipChildren && prop._saved instanceof Block && prop._saved._prop === prop) {
        iterateProperties(prop._saved, callback);
      }
    }
  }
}

class PropertyMover {

  block: Block;
  oldName: string;
  binding: any;
  saved: any;
  outboundLinks: {
    prop: BlockProperty;
    preNames: string[];
    postNames: string[];
  }[];

  constructor(block: Block, oldName: string, moveOutboundLinks = false) {
    this.block = block;
    this.oldName = oldName;
    let property = block.getProperty(oldName, false);
    if (property) {
      if (property._bindingPath) {
        this.binding = property._saveBinding();
      } else {
        this.saved = property._save();
      }

      let checkOutbound = (checkProp: BlockProperty) => {
        for (let targetProp of checkProp._listeners) {

          // find binding targets
          if (targetProp instanceof BlockProperty) {
            if (targetProp._bindingPath && targetProp._bindingPath.includes(oldName)) {
              let names = targetProp._bindingPath.split('.');
              for (let i = 0; i < names.length; ++i) {
                if (names[i] === oldName) {

                  // check if the binding path touchs the property we are moving
                  let bindSourceProp = targetProp._block.queryProperty(names.slice(0, i + 1).join('.'));
                  if (bindSourceProp === property) {
                    this.outboundLinks.push({
                      prop: targetProp,
                      preNames: names.slice(0, i),
                      postNames: names.slice(i + 1)
                    });
                    break;
                  }
                }
              }
            }
          }
        }

        return false;
      };

      if (moveOutboundLinks) {
        this.outboundLinks = [];
        checkOutbound(property);
        if (property._saved instanceof Block && property._saved._prop === property) {
          iterateProperties(property._saved, checkOutbound);
        }

      }
      block.setValue(oldName, undefined);
    }
  }

  moveTo(newName: string) {
    if (this.outboundLinks) {
      for (let {prop, preNames, postNames} of this.outboundLinks) {
        preNames.push(newName);
        (prop as BlockProperty).setBinding(preNames.concat(postNames).join('.'));
      }
    }
    if (this.binding) {
      if (typeof this.binding === 'string') {
        // normal binding
        this.block.setBinding(newName, this.binding);
      } else {
        // binding helper
        this.block.createHelperBlock(newName)._load(this.binding);
      }
    } else if (this.saved !== undefined) {
      this.block.getProperty(newName)._load(this.saved);
    }
  }
}


export function renameProperty(block: Block, oldName: string, newName: string, moveOutboundLinks = false) {
  new PropertyMover(block, oldName, moveOutboundLinks).moveTo(newName);
}

export function insertGroupProperty(block: Block, name: string, idx: number) {

}

export function removeGroupProperty(block: Block, name: string, idx: number) {

}

export function moveGroupProperty(block: Block, nameOld: string, oldIdx: number, newIdx: number) {

}


export function changeLength(block: Block, field: string, length: number) {
  if (field.endsWith('#len')) {
    let group = field.substring(0, field.length - 4);
    let groupDesc: PropGroupDesc;

    function findGroup(props: (PropDesc | PropGroupDesc)[]): PropGroupDesc {
      for (let propDesc of props) {
        if ((propDesc as PropGroupDesc).group === group) {
          return propDesc as PropGroupDesc;
        }
      }
      return null;
    }

    let [desc, size] = Types.getDesc(block.getValue('#is'));
    if (desc) {
      groupDesc = findGroup(desc.properties);
    }
    if (!groupDesc) {
      let moreProps = block.getValue('#more');
      if (Array.isArray(moreProps)) {
        findGroup(moreProps);
      }
    }

    if (!groupDesc) {
      // still can't find the group, only set value
      block.setValue(field, length);
      return;
    }
    let oldLength = block.getValue(field);
    if (!(oldLength >= 0)) {
      oldLength = groupDesc.defaultLen;
    }
    let newLength = length;
    if (!(newLength >= 0)) {
      newLength = groupDesc.defaultLen;
    }

    block.setValue(field, length);

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
}