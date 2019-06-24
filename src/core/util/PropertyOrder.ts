import {Block} from "../block/Block";
import {configDescs, PropDesc, PropGroupDesc} from "../block/Descriptor";
import {Types} from "../block/Type";

const configList = Object.keys(configDescs);


function buildPropertiesOrder(block: Block): string[] {
  let orders = [...configList];

  function addProps(props: (PropDesc | PropGroupDesc)[]) {
    for (let propDesc of props) {
      if ((propDesc as PropGroupDesc).properties) {
        let lenField = `${(propDesc as PropGroupDesc).group}#len`;
        orders.push(lenField);
        let groupLength = Number(block.getValue(lenField));
        if (!(groupLength >= 0)) {
          groupLength = (propDesc as PropGroupDesc).defaultLen;
        }
        for (let i = 0; i < groupLength; ++i) {
          for (let childDesc of (propDesc as PropGroupDesc).properties) {
            orders.push(`${(childDesc as PropDesc).name}${i}`);
          }
        }
      } else {
        orders.push((propDesc as PropDesc).name);
      }
    }
  }

  let [desc, size] = Types.getDesc(block.getValue('#is'));
  if (desc) {
    addProps(desc.properties);
  }
  let moreProps = block.getValue('#more');
  if (Array.isArray(moreProps)) {
    addProps(moreProps);
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
    addField:
      for (let field of searchForOrder) {
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

export function changeLength(block: Block, field: string, length: number) {

}
