import {Block} from "./Block";
import {FunctionGenerator} from "./BlockFunction";
import {ValueDispatcher} from "./Dispatcher";
import {FunctionDesc} from "./Descriptor";

interface DescListener {
  onDescChange(id: string, desc: FunctionDesc): void;
}


export class Class extends ValueDispatcher<FunctionGenerator> {
  _id: string;
  _desc: FunctionDesc;

  constructor(id: string) {
    super();
    this._id = id;
  }
}

const _types: {[key: string]: Class} = {};

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
    type._desc = desc;
    Classes.dispatchDescChange(id, desc);
  }

  static clear(id: string) {
    let type = _types[id];

    if (type) {
      type.updateValue(null);
      type._desc = null;
      Classes.dispatchDescChange(id, null);
    }
  }

  static listen(id: string, block: Block): Class {
    if (!id) {
      return;
    }
    if (id.startsWith(':') && block._job._namespace) {
      id = block._job._namespace + id;
    }
    let type = _types[id];

    if (!type) {
      type = new Class(id);
      _types[id] = type;
    }
    type.listen(block);
    return type;
  }

  static _listeners: Set<DescListener> = new Set<DescListener>();

  static listenDesc(listener: DescListener): void {
    Classes._listeners.add(listener);
  }

  static unlistenDescs(listener: DescListener): void {
    Classes._listeners.delete(listener);
  }

  static dispatchDescChange(id: string, desc: FunctionDesc) {
    for (let listener of Classes._listeners) {
      listener.onDescChange(id, desc);
    }
  }

  static getAllClassIds(): string[] {
    return Object.keys(_types);
  }

  static getDesc(id: string): FunctionDesc {
    let type = _types[id];

    if (type) {
      return type._desc;
    }
    return null;
  }
}
