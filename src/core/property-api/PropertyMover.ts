import {Block} from '../block/Block';
import {BlockProperty, HelperProperty} from '../block/BlockProperty';
import {PropListener} from '../block/Dispatcher';
import {BlockBinding} from '../block/BlockBinding';

// /**
//  * @param block
//  * @param callback return true on sub block to skip children properties
//  */
// export function iterateProperties(block: Block, callback: (property: BlockProperty) => boolean) {
//   for (let [name, prop] of block._props) {
//     if (!prop.isCleared()) {
//       let skipChildren = callback(prop);
//       if (!skipChildren && prop._saved instanceof Block && prop._saved._prop === prop) {
//         iterateProperties(prop._saved, callback);
//       }
//     }
//   }
// }

function iterateListeners(listeners: Set<PropListener<any>>, callback: (property: BlockProperty) => void) {
  for (let listener of listeners) {
    if (listener instanceof BlockBinding) {
      iterateListeners(listener._listeners, callback);
    } else if (listener instanceof BlockProperty) {
      callback(listener);
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
  // move the helper property
  helperMover: PropertyMover;

  constructor(block: Block, oldName: string, moveOutboundLinks = false) {
    this.block = block;
    this.oldName = oldName;
    let property = block.getProperty(oldName, false);
    if (property) {
      if (property._bindingPath) {
        this.binding = property._bindingPath;
        if (property._helperProperty) {
          this.helperMover = new PropertyMover(block, property._helperProperty._name, moveOutboundLinks);
        }
      } else if (property instanceof HelperProperty) {
        // default _saveValue for HelperProperty always return null, use __save() instead
        this.saved = property.__save();
      } else {
        this.saved = property._saveValue();
      }

      const checkOutBound = (checkProp: BlockProperty) => {
        let bindingPath = checkProp._bindingPath;
        if (bindingPath) {
          let names = bindingPath.split('.');
          for (let i = 0; i < names.length; ++i) {
            if (names[i] === oldName) {
              // double check if the binding path touches the property we are moving
              let bindSourceProp = checkProp._block.queryProperty(names.slice(0, i + 1).join('.'));
              if (bindSourceProp === property) {
                this.outboundLinks.push({
                  prop: checkProp,
                  preNames: names.slice(0, i),
                  postNames: names.slice(i + 1),
                });
                break;
              }
            }
          }
        }
      };

      if (moveOutboundLinks) {
        this.outboundLinks = [];
        iterateListeners(property._listeners, checkOutBound);
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
      if (this.helperMover) {
        this.block.createHelperBlock(newName);
        this.helperMover.moveTo(`~${newName}`);
      } else {
        this.block.setBinding(newName, this.binding);
      }
    } else {
      this.block.getProperty(newName)._liveUpdate(this.saved);
    }
  }
}

export function moveProperty(
  block: Block,
  oldName: string,
  newName: string,
  moveOutboundLinks: boolean = false
): string {
  new PropertyMover(block, oldName, moveOutboundLinks).moveTo(newName);
  return null;
}
