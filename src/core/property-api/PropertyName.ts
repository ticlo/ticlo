import {Block} from "../block/Block";
import {BlockProperty} from "../block/BlockProperty";
import {buildPropertiesOrder} from "./PropertyShowHide";
import {PropertyMover} from "./PropertyMover";

const trailingNumberReg = /\d+$/;

export function findPropertyForNewBlock(block: Block, baseName: string): BlockProperty {
  let usedNames = buildPropertiesOrder(block);
  if (!usedNames.includes(baseName)) {
    let p = block.getProperty(baseName);
    if (p.isCleared()) {
      return p;
    }
  }

  baseName = baseName.replace(trailingNumberReg, '');
  for (let i = 0; ; ++i) {
    let newName = `${baseName}${i}`;
    if (!usedNames.includes(newName)) {
      let p = block.getProperty(`${baseName}${i}`);
      if (p.isCleared()) {
        return p;
      }
    }
  }
}

export function renameProperty(block: Block, oldName: string, newName: string, moveOutboundLinks = false) {
  new PropertyMover(block, oldName, moveOutboundLinks).moveTo(newName);
}
