import {Block} from "./Block";
import {FunctionGenerator} from "./BlockFunction";
import {ValueDispatcher} from "./Dispatcher";
import {FunctionDesc} from "./Descriptor";
import JSON = Mocha.reporters.JSON;
import JsonEsc from "jsonesc/dist";

export interface DescListener {
  onDescChange(id: string, desc: FunctionDesc): void;
}


export class Type extends ValueDispatcher<FunctionGenerator> {
  _id: string;
  _desc: FunctionDesc;
  _descSize: number = 0;

  constructor(id: string) {
    super();
    this._id = id;
  }

  setDesc(desc?: FunctionDesc) {
    this._desc = desc;
    if (desc) {
      this._descSize = JsonEsc.stringify(desc).length;
    } else {
      this._descSize = 0;
    }
  }
}

const _types: {[key: string]: Type} = {};

export class Types {
  static add(cls: FunctionGenerator, desc: FunctionDesc, namespace?: string) {
    desc.priority = cls.prototype.priority;
    desc.mode = cls.prototype.defaultMode;
    desc.ns = namespace;
    if (cls.prototype.useLength) {
      desc.useLength = true;
    } else {
      delete desc.useLength;
    }

    let id = namespace ? `${namespace}:${desc.name}` : desc.name;
    desc.id = id;
    let type = _types[id];
    if (!type) {
      type = new Type(id);
      _types[id] = type;
    }
    cls.prototype.type = id;
    type.updateValue(cls);
    type.setDesc(desc);
    Types.dispatchDescChange(id, desc);
  }

  static clear(id: string) {
    let type = _types[id];

    if (type) {
      type.updateValue(null);
      type.setDesc(null);
      Types.dispatchDescChange(id, null);
    }
  }

  static listen(id: string, block: Block): Type {
    if (!id) {
      return;
    }
    if (id.startsWith(':') && block._job._namespace) {
      id = block._job._namespace + id;
    }
    let type = _types[id];

    if (!type) {
      type = new Type(id);
      _types[id] = type;
    }
    type.listen(block);
    return type;
  }

  static _listeners: Set<DescListener> = new Set<DescListener>();

  static listenDesc(listener: DescListener): void {
    Types._listeners.add(listener);
  }

  static unlistenDesc(listener: DescListener): void {
    Types._listeners.delete(listener);
  }

  static dispatchDescChange(id: string, desc: FunctionDesc) {
    for (let listener of Types._listeners) {
      listener.onDescChange(id, desc);
    }
  }

  static getAllTypeIds(): string[] {
    return Object.keys(_types);
  }

  static getDesc(id: string): [FunctionDesc, number] {
    let type = _types[id];

    if (type) {
      return [type._desc, type._descSize];
    }
    return [null, 0];
  }
}
