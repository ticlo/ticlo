import {Block} from '../block/Block';
import {BlockProperty} from '../block/BlockProperty';

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

export class PropertyMover {
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
        this.saved = property._saveValue();
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
                      postNames: names.slice(i + 1),
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
        this.block.createHelperBlock(newName)._liveUpdate(this.binding);
      }
    } else {
      this.block.getProperty(newName)._liveUpdate(this.saved);
    }
  }
}
