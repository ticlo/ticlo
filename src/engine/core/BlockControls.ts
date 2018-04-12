import {Block} from "./Block";
import {BlockProperty} from "./BlockProperty";

export class BlockClassControl extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }

  onChange(val: any): void {
    if (this.updateValue(val)) {
      this._block._classChanged(val);
    }
  }
}

export class BlockCallControl extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }

  onChange(val: any): void {
    if (this.updateValue(val)) {
      this._block._onCall(val);
    }
  }
}

export class BlockModeControl extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }

  onChange(val: any): void {
    if (this.updateValue(val)) {
      this._block._modeChanged(val);
    }
  }
}

export class BlockLengthControl extends BlockProperty {
  constructor(block: Block, name: string) {
    super(block, name);
  }

  onChange(val: any): void {
    if (this.updateValue(val)) {
      this._block._lengthChanged(val);
    }
  }
}