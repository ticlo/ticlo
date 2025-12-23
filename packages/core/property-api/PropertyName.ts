import {Block} from '../block/Block.js';
import {BlockProperty} from '../block/BlockProperty.js';
import {buildPropertiesOrder} from './PropertyShowHide.js';
import {PropertyMover} from './PropertyMover.js';

const trailingNumberReg = /\d+$/;

export function findPropertyForNewBlock(block: Block, baseName: string, reservedNames: string[] = []): BlockProperty {
  let usedNames = buildPropertiesOrder(block).concat(reservedNames);
  if (!usedNames.includes(baseName)) {
    let p = block.getProperty(baseName);
    if (p.isCleared()) {
      return p;
    }
  }

  baseName = baseName.replace(trailingNumberReg, '');
  for (let i = 1; ; ++i) {
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
