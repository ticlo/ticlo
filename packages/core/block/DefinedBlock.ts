import {Block} from './Block.ts';
import {BlockConfig, BlockIO, BlockProperty} from './BlockProperty.ts';
import {type DataMap, isSavedBlock} from '../util/DataTypes.ts';
import type {Flow} from './Flow.ts';

type PropertyClass = new (block: Block, name: string) => BlockProperty;

function definedProperty(Base: PropertyClass) {
  return class DefinedProperty extends Base {
    onChange() {
      return false;
    }

    updateValue() {
      return false;
    }

    setValue() {
      throw new Error(`Code-defined property is read-only: ${this._block.getFullPath()}.${this._name}`);
    }

    setBinding() {}
    setBindProperty() {}
    _listenRaw() {}
    _loadHelper() {}

    isCleared() {
      return false;
    }

    createBlock(): Block {
      throw new Error(`Code-defined property is read-only: ${this._block.getFullPath()}.${this._name}`);
    }

    _load(value: unknown) {
      if (this._value instanceof DefinedBlock && isSavedBlock(value) && typeof value['#is'] !== 'object') {
        this._value._load(value);
      }
    }

    _liveUpdate(value: unknown) {
      if (this._value instanceof DefinedBlock && isSavedBlock(value) && typeof value['#is'] !== 'object') {
        this._value._liveUpdate(value);
      }
    }

    _liveClear() {
      if (this._value instanceof DefinedBlock) this._value._liveUpdate({});
    }

    _saveValue(): unknown {
      if (this._value instanceof DefinedBlock) {
        const data = this._value._save();
        if (Object.keys(data).length) return {'#is': '', ...data};
      }
      return undefined;
    }
  };
}

const DefinedIO = definedProperty(BlockIO);
const DefinedConfig = definedProperty(BlockConfig);
const DefinedAttribute = definedProperty(BlockProperty);

export function isDefinedProperty(property: BlockProperty): boolean {
  return property instanceof DefinedIO || property instanceof DefinedConfig || property instanceof DefinedAttribute;
}

function constantValue(value: unknown, copies = new WeakMap<object, unknown>()): unknown {
  if (!value || typeof value !== 'object') return value;
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    return value;
  if (copies.has(value)) return copies.get(value);
  const copy: DataMap | unknown[] = Array.isArray(value) ? new Array(value.length) : {};
  copies.set(value, copy);
  for (const key of Object.keys(value)) {
    Object.defineProperty(copy, key, {value: constantValue((value as DataMap)[key], copies), enumerable: true});
  }
  return Object.freeze(copy);
}

function defineValue(parent: Block, name: string, value: unknown) {
  const existing = parent._props.get(name);
  if (existing && (!existing.isCleared() || existing._listeners.size)) {
    throw new Error(`Global definition is already in use: ${parent.getFullPath()}.${name}`);
  }
  const Property = name.startsWith('#') ? DefinedConfig : name.startsWith('@') ? DefinedAttribute : DefinedIO;
  const property = new Property(parent, name);
  if (isSavedBlock(value) && typeof value['#is'] !== 'object') {
    value = new DefinedBlock(parent._flow, parent, property, value);
  } else {
    value = constantValue(isSavedBlock(value) ? value['#is'] : value);
  }
  property._value = property._saved = value;
  existing?.destroy();
  parent._props.set(name, property);
  return property;
}

/** Code-owned values and services. #is describes their type without executing a stored function. */
export class DefinedBlock extends Block {
  static create(parent: Block, name: string, data: DataMap): DefinedBlock {
    if (data['#is'] !== undefined && typeof data['#is'] !== 'string') {
      throw new Error('Global block #is must be a function ID string');
    }
    return defineValue(parent, name, {'#is': '', ...data}).getValue() as DefinedBlock;
  }

  constructor(flow: Flow, parent: Block, property: BlockProperty, data: DataMap) {
    super(flow, parent, property);
    // The base constructor creates a blank #is property; the code definition owns it instead.
    this._props.get('#is').destroy();
    this._props.delete('#is');
    for (const [name, value] of Object.entries({'#is': '', ...data})) {
      if (name.startsWith('~')) throw new Error('Global definitions contain values, not bindings');
      defineValue(this, name, value);
    }
    this._funcidChanged(this.getValue('#is'));
  }

  _applyFuncid(_funcId: string) {}
}
