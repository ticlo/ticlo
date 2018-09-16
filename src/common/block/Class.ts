import {Block} from "./Block";
import {FunctionGenerator} from "./BlockFunction";
import {ValueDispatcher} from "./Dispatcher";
import {FunctionDesc} from "./Descriptor";


export class Class extends ValueDispatcher<FunctionGenerator> {
  _name: string;

  constructor(name: string) {
    super();
    this._name = name;
  }
}

const _types: {[key: string]: Class} = {};

let _typesFinalized = false;

export class Classes {
  static add(cls: FunctionGenerator, desc: FunctionDesc, namespace?: string) {
    desc.priority = cls.prototype.priority;
    desc.mode = cls.prototype.defaultMode;
    desc.useLength = Boolean(cls.prototype.useLength);

    let id = namespace ? `${namespace}:${desc.id}` : desc.id;
    let type = _types[id];
    if (!type) {
      type = new Class(id);
      _types[id] = type;
    }
    cls.prototype.type = id;
    type.updateValue(cls);
  }

  static clear(name: string) {
    let type = _types[name];

    if (type) {
      type.updateValue(null);
    }
  }

  static listen(name: string, block: Block): Class {
    if (!name) {
      return;
    }
    if (name.startsWith(':') && block._job._namespace) {
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
