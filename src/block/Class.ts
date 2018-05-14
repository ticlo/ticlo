import { Block } from "./Block";
import { BlockFunction, FunctionGenerator } from "./BlockFunction";
import { ValueDispatcher } from "./Dispatcher";


export class Class extends ValueDispatcher<FunctionGenerator> {
  _name: string;

  constructor(name: string) {
    super();
    this._name = name;
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
    type.updateValue(cls);
  }

  static listen(name: string, block: Block): Class {
    if (!name) {
      return;
    }
    if (name.startsWith('/') && block._job._namespace) {
      name = block._job._namespace + name;
    }
    let type = _types[name];

    if (!type) {
      type = new Class(name);
      _types[name] = type;
    }
    type.listen(block);
    return type;
  }
}
