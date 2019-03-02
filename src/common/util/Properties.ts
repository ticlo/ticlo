import {Block} from "../block/Block";
import {BlockProperty} from "../block/BlockProperty";


let trailingNumberReg = /\d+$/;

export function anyChildProperty(block: Block, baseName: string): BlockProperty {
  let p = block.getProperty(baseName, true);
  if (p.isCleared()) {
    return p;
  }
  baseName = baseName.replace(trailingNumberReg, '');
  for (let i = 0; ; ++i) {
    p = block.getProperty(`${baseName}${i}`, true);
    if (p.isCleared()) {
      return p;
    }
  }
}


class PropertyMover {
  block: Block;
  oldName: string;
  binding: any;
  saved: any;

  constructor(block: Block, oldName: string, moveBinding = false) {
    this.block = block;
    this.oldName = oldName;
    let property = block.getProperty(oldName);
    if (property) {
      if (property._bindingPath) {
        this.binding = property._saveBinding();
      } else {
        this.saved = property._save();
      }
    }
    if (moveBinding) {

    }
    block.setValue(oldName, undefined);
  }

  moveTo(newName: string) {
    if (this.binding) {
      if (typeof this.binding === 'string') {
        // normal binding
        this.block.setBinding(newName, this.binding);
      } else {
        // binding helper
        this.block.createHelperBlock(newName)._load(this.binding);
      }
    } else if (this.saved !== undefined) {
      this.block.getProperty(newName, true)._load(this.saved);
    }
  }
}


export function renameProperty(block: Block, oldName: string, newName: string, moveBinding = false) {
  new PropertyMover(block, oldName, moveBinding).moveTo(newName);
}

export function insertGroupProperty(block: Block, name: string, idx: number) {

}

export function removeGroupProperty(block: Block, name: string, idx: number) {

}

export function moveGroupProperty(block: Block, nameOld: string, oldIdx: number, newIdx: number) {

}