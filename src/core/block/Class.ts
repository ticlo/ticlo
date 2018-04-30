import { Block } from "./Block";
import { BlockFunction, FunctionGenerator } from "./BlockFunction";

export class Class {
  _generator: FunctionGenerator = null;
  _name: string;
  _blocks: Set<Block> = new Set<Block>();
  _isStatic: boolean;

  constructor(name: string) {
    this._name = name;
    this._isStatic = !name.includes('/');
  }

  update(generator: FunctionGenerator) {
    this._generator = generator;
    for (let block of this._blocks) {
      block.updateFunction(this._generator);
    }
  }

  add(block: Block) {
    block.updateFunction(this._generator);
    if (this._isStatic && this._generator) {
      return null;
    } else {
      return this._blocks.add(block);
    }
  }

  remove(block: Block) {
    this._blocks.delete(block);
  }
}

const _types: { [key: string]: Class } = {};

let _typesFinalized = false;

export class Classes {
  static add(name: string, cls: FunctionGenerator) {
    cls.prototype.className = name;
    let type = _types[name];

    if (!type) {
      type = new Class(name);
      _types[name] = type;
    }
    cls.prototype.type = name;
    type.update(cls);
  }

  static listen(name: string, block: Block): Class {
    let type = _types[name];

    if (!type) {
      type = new Class(name);
      _types[name] = type;
    }
    type.add(block);
    return type;
  }
}
