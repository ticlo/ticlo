import {Block, type BlockChildWatch} from './Block.ts';
import {BlockBindingSource, BlockConfig, BlockIO, BlockProperty} from './BlockProperty.ts';
import {collectFlowIOProperties, type PropDesc, type PropGroupDesc} from './Descriptor.ts';
import type {PropListener} from './Dispatcher.ts';
import {ConfigGenerators, ConstTypeConfig} from './BlockConfigs.ts';
import {Task} from './Task.ts';
import {isDataMap, type DataMap} from '../util/DataTypes.ts';
import {deepEqual} from '../util/Compare.ts';
import {BlockOrder} from './BlockOrder.ts';
import {isRelativeProjectFilePath, resolveSubflowFilePath} from '../storage/FilePath.ts';
import type {Flow} from './Flow.ts';

class InputOrderConfig extends BlockConfig {
  onChange(value: unknown, save?: boolean): boolean {
    const owner = this._bindingSource?.getProperty()?._block;
    return super.onChange(owner ? BlockOrder.from(owner, value) : value, save);
  }
}

class InputCustomConfig extends BlockConfig {
  onChange(value: unknown, save?: boolean): boolean {
    const changed = super.onChange(value, save);
    if (changed) {
      (this._block as InputsBlock)._updateFilePathProps(value);
    }
    return changed;
  }
}

class InputsBlockIO extends BlockIO {
  onChange(value: unknown, save?: boolean): boolean {
    const block = this._block as InputsBlock;
    if (block._filePathProps !== null) {
      value = block._resolveBoundFilePath(this._name, value, this._bindingSource);
    }
    return super.onChange(value, save);
  }
}

class InputsBlockConfig extends BlockConfig {
  onChange(value: unknown, save?: boolean): boolean {
    const block = this._block as InputsBlock;
    if (block._filePathProps !== null) {
      value = block._resolveBoundFilePath(this._name, value, this._bindingSource);
    }
    return super.onChange(value, save);
  }
}

class BlockOutputWaitingConfig extends BlockProperty {
  _valueChanged() {
    this._block._flow.onWait(this._value);
  }
}

export const InputsConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:inputs'),
  '#call': BlockProperty,
  '#order': InputOrderConfig,
  '#custom': InputCustomConfig,
};

export const OutputsConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:outputs'),
  '#call': BlockProperty, // call not allowed
  '#return': BlockIO,
  '#wait': BlockOutputWaitingConfig, // directly forward wait to parent flow
};

export const FlowOutputsConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...ConfigGenerators,
  '#is': ConstTypeConfig('flow:outputs'),
  '#call': BlockProperty, // call not allowed
  '#return': BlockIO,
};

function extractFlowInputNames(customList: unknown): Set<string> | null {
  if (!Array.isArray(customList) || !customList.length) return null;
  let names: Set<string> | null = null;
  for (const item of customList) {
    if (
      item &&
      typeof item === 'object' &&
      item.type !== 'group' &&
      typeof item.name === 'string' &&
      item.name &&
      (item.name === '#order' || !/^[#@~]/.test(item.name))
    ) {
      names ??= new Set();
      names.add(item.name);
    }
  }
  return names;
}

function hostProvidesInput(host: Block, name: string): boolean {
  return host.getValue(name) !== undefined;
}

function isForwardableFlowOutput(prop: BlockProperty): boolean {
  const name = prop._name;
  return (prop instanceof BlockIO && name !== '#return') || name === '#output';
}

export class InputsBlock extends Block {
  _filePathProps: Set<string> | null = null;

  _createIO(field: string): BlockProperty {
    return new InputsBlockIO(this, field);
  }

  _createConfig(field: string): BlockProperty {
    if (field in InputsConfigGenerators) {
      return new InputsConfigGenerators[field](this, field);
    } else {
      return new InputsBlockConfig(this, field);
    }
  }

  _updateFilePathProps(customList: unknown) {
    const prev = this._filePathProps;
    let next: Set<string> | null = null;
    if (Array.isArray(customList)) {
      for (const item of customList) {
        if (item && typeof item === 'object' && item.type === 'file-path' && typeof item.name === 'string') {
          next ??= new Set();
          next.add(item.name);
        }
      }
    }
    this._filePathProps = next;
    if (prev !== null || next !== null) {
      for (const [name, prop] of this._props) {
        if (prop._bindingSource && Boolean(prev?.has(name)) !== Boolean(next?.has(name))) {
          const source = prop._bindingSource.getProperty();
          prop.onChange(source ? source.getValue() : prop._bindingSource.getValue());
        }
      }
    }
  }

  _resolveBoundFilePath(name: string, value: unknown, bindingSource: BlockBindingSource): unknown {
    if (this._filePathProps?.has(name) && bindingSource && typeof value === 'string' && value.length > 0) {
      return resolveSubflowFilePath(value, bindingSource.getProperty()?._block._flow._library, this._flow._library);
    }
    return value;
  }

  _setInputValue(val: unknown) {
    if (val instanceof Task) {
      this.updateValue('#value', val.getData());
      val = val.getDataMap();
    } else {
      this.updateValue('#value', val);
    }
    if (val instanceof Block) {
      const customList = this.getValue('#custom');
      if (Array.isArray(customList)) {
        for (const customProp of customList) {
          // create raw binding
          this.getProperty(customProp.name)._listenRaw(val.getProperty(customProp.name));
        }
      }
    } else if (Object.isExtensible(val)) {
      const customList = this.getValue('#custom');
      if (Array.isArray(customList)) {
        const filePathProps = this._filePathProps;
        const outerLibrary = filePathProps !== null ? this._flow._parent?._flow?._library : undefined;
        const subLibrary = outerLibrary ? this._flow._library : undefined;
        const needFilePathResolve = Boolean(outerLibrary && subLibrary && outerLibrary !== subLibrary);
        for (const customProp of customList) {
          const name = customProp.name;
          let value = (val as DataMap)[name];
          if (name === '#order') {
            const property = this.getProperty('#order');
            property._bindingSource?.unlisten(property);
            property._bindingSource = null;
            value = BlockOrder.from(val as DataMap, value);
          } else if (filePathProps?.has(name)) {
            const property = this._props.get(name);
            if (property?._bindingSource) {
              property._bindingSource.unlisten(property);
              property._bindingSource = null;
            }
            if (needFilePathResolve && typeof value === 'string' && isRelativeProjectFilePath(value)) {
              const prefix = outerLibrary.startsWith('+') ? outerLibrary : `+${outerLibrary}`;
              value = `${prefix}${value.slice(1)}`;
            }
          }
          this.updateValue(name, value);
        }
      }
    }
  }
}

export class OutputsBlock extends Block {
  inputChanged(input: BlockIO, val: unknown) {
    super.inputChanged(input, val);
    this._flow.outputChanged(input, val);
  }

  configChanged(input: BlockConfig, val: unknown) {
    super.configChanged(input, val);
    switch (input._name) {
      case '#custom':
        break;
      default:
        this._flow.outputChanged(input, val);
    }
  }

  _createConfig(field: string): BlockProperty {
    if (field in OutputsConfigGenerators) {
      return new OutputsConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }
}

interface InputHostEntry {
  count: number;
  reserved?: ReadonlySet<string>;
  watcher: BlockChildWatch;
}

/** #inputs for ordinary Flows shared across PageInclude hosts without mutating saved state. */
export class FlowInputsBlock extends InputsBlock {
  _inputHosts?: Map<Block, InputHostEntry>;
  _inputNames?: Set<string> | null;

  _updateFilePathProps(customList: unknown) {
    super._updateFilePathProps(customList);
    if (!this._inputHosts?.size) {
      this._inputNames = undefined;
      return;
    }
    const prevNames = this._inputNames;
    const nextNames = extractFlowInputNames(customList);
    this._inputNames = nextNames;

    if (prevNames) {
      for (const name of prevNames) {
        if (!nextNames?.has(name)) {
          this._revertInput(name);
        }
      }
    }
    if (nextNames) {
      for (const name of nextNames) {
        const host = this._findInputHost(name);
        if (host) {
          this._writeFromHost(name, host);
        }
      }
    }
  }

  attachInputHost(host: Block, reservedKeys?: ReadonlySet<string>): void {
    if (this._destroyed || host._destroyed) return;
    if (!this._inputHosts) {
      this._inputHosts = new Map();
      this._inputNames = extractFlowInputNames(this.getValue('#custom'));
    }
    const existing = this._inputHosts.get(host);
    if (existing) {
      existing.count++;
      return;
    }
    const entry: InputHostEntry = {
      count: 1,
      reserved: reservedKeys,
      watcher: {
        onChildChange: (prop) => {
          if ((prop as BlockIO)._outputing) return;
          const name = prop._name;
          if (!this._inputNames?.has(name) || entry.reserved?.has(name)) return;
          if (hostProvidesInput(host, name)) {
            this._writeFromHost(name, host);
          } else {
            this._syncFromHosts(name);
          }
        },
      },
    };
    this._inputHosts.set(host, entry);
    host.watch(entry.watcher);
    if (this._inputNames) {
      for (const name of this._inputNames) {
        if (!entry.reserved?.has(name) && hostProvidesInput(host, name)) {
          this._writeFromHost(name, host);
        }
      }
    }
  }

  detachInputHost(host: Block): void {
    const entry = this._inputHosts?.get(host);
    if (!entry) return;
    if (--entry.count > 0) return;
    this._inputHosts.delete(host);
    if (!host._destroyed) {
      host.unwatch(entry.watcher);
    }
    if (this._inputNames) {
      for (const name of this._inputNames) {
        if (!entry.reserved?.has(name) && (host._destroyed || hostProvidesInput(host, name))) {
          this._syncFromHosts(name);
        }
      }
    }
  }

  private _findInputHost(name: string): Block | null {
    if (!this._inputHosts) return null;
    let found: Block | null = null;
    for (const [host, entry] of this._inputHosts) {
      if (!host._destroyed && !entry.reserved?.has(name) && hostProvidesInput(host, name)) {
        found = host;
      }
    }
    return found;
  }

  private _syncFromHosts(name: string) {
    const host = this._findInputHost(name);
    if (host) {
      this._writeFromHost(name, host);
    } else {
      this._revertInput(name);
    }
  }

  private _writeFromHost(name: string, host: Block) {
    if (host._destroyed || this._destroyed) return;
    let val = host.getValue(name);
    if (name === '#order') {
      val = BlockOrder.from(host, val);
    } else if (this._filePathProps?.has(name) && typeof val === 'string' && val.length > 0) {
      val = resolveSubflowFilePath(val, host._flow?._library, this._flow?._library);
    }
    this.updateValue(name, val);
  }

  private _revertInput(name: string) {
    if (this._destroyed) return;
    const prop = this.getProperty(name, false);
    if (!prop) return;
    if (prop._saved !== undefined || prop._bindingSource) {
      prop.revertUpdate();
    } else {
      prop.updateValue(undefined);
    }
  }

  destroy(): void {
    if (this._inputHosts) {
      for (const [host, entry] of this._inputHosts) {
        if (!host._destroyed) {
          host.unwatch(entry.watcher);
        }
      }
      this._inputHosts.clear();
      this._inputNames = undefined;
    }
    super.destroy();
  }
}

interface OutputTargetEntry {
  count: number;
  reserved?: ReadonlySet<string>;
  written: Set<string>;
}

/** #outputs for ordinary Flows supporting 1-to-N PageInclude fan-out without forwarding #wait. */
export class FlowOutputsBlock extends OutputsBlock {
  _outputTargets?: Map<Block, OutputTargetEntry>;

  _createConfig(field: string): BlockProperty {
    if (field in FlowOutputsConfigGenerators) {
      return new FlowOutputsConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  attachOutputTarget(target: Block, reservedKeys?: ReadonlySet<string>): void {
    if (this._destroyed || target._destroyed) return;
    this._outputTargets ??= new Map();
    const existing = this._outputTargets.get(target);
    if (existing) {
      existing.count++;
      return;
    }
    const written = new Set<string>();
    const entry: OutputTargetEntry = {count: 1, reserved: reservedKeys, written};
    this._outputTargets.set(target, entry);
    for (const [name, prop] of this._props) {
      if (isForwardableFlowOutput(prop) && !reservedKeys?.has(name) && prop._value !== undefined) {
        target.output(prop._value, name);
        written.add(name);
      }
    }
  }

  detachOutputTarget(target: Block): void {
    const entry = this._outputTargets?.get(target);
    if (!entry) return;
    if (--entry.count > 0) return;
    this._outputTargets.delete(target);
    if (!target._destroyed) {
      for (const field of entry.written) {
        target.output(undefined, field);
      }
    }
  }

  private _broadcastOutput(prop: BlockProperty, val: unknown) {
    if (!this._outputTargets?.size || !isForwardableFlowOutput(prop)) return;
    const name = prop._name;
    for (const [target, entry] of this._outputTargets) {
      if (target._destroyed || entry.reserved?.has(name)) continue;
      target.output(val, name);
      if (val === undefined) {
        entry.written.delete(name);
      } else {
        entry.written.add(name);
      }
    }
  }

  inputChanged(input: BlockIO, val: unknown) {
    super.inputChanged(input, val);
    this._broadcastOutput(input, val);
  }

  configChanged(input: BlockConfig, val: unknown) {
    super.configChanged(input, val);
    if (input._name !== '#custom') {
      this._broadcastOutput(input, val);
    }
  }

  destroy(): void {
    if (this._outputTargets) {
      for (const [target, entry] of this._outputTargets) {
        if (!target._destroyed) {
          for (const field of entry.written) {
            target.output(undefined, field);
          }
        }
      }
      this._outputTargets.clear();
    }
    super.destroy();
  }
}

const activePropsSyncCount = new WeakMap<Block, number>();

class FlowCustomWatcher {
  private _ioProp?: BlockProperty;
  private _customProp?: BlockProperty;
  value: unknown;

  constructor(private readonly _onUpdate: () => void) {}

  private readonly _ioListener: PropListener = {
    onSourceChange: (prop) => {
      if (prop == null) {
        this._ioProp = undefined;
        this._detachCustom();
        this._onUpdate();
      }
    },
    onChange: (val) => {
      this._detachCustom();
      if (val instanceof Block && !val._destroyed) {
        this._customProp = val.getProperty('#custom', true);
        this._customProp.listen(this._customListener);
      } else {
        this._onUpdate();
      }
    },
  };

  private readonly _customListener: PropListener = {
    onSourceChange: (prop) => {
      if (prop == null) {
        this._customProp = undefined;
        this.value = undefined;
        this._onUpdate();
      }
    },
    onChange: (val) => {
      this.value = val;
      this._onUpdate();
    },
  };

  attach(flow: Flow, field: '#inputs' | '#outputs') {
    this._detachIo();
    this._ioProp = flow.getProperty(field, true);
    this._ioProp.listen(this._ioListener);
  }

  detach() {
    this._detachIo();
    this.value = undefined;
  }

  private _detachCustom() {
    if (this._customProp) {
      if (!this._customProp.isDestroyed()) {
        this._customProp.unlisten(this._customListener);
      }
      this._customProp = undefined;
    }
    this.value = undefined;
  }

  private _detachIo() {
    this._detachCustom();
    if (this._ioProp) {
      if (!this._ioProp.isDestroyed()) {
        this._ioProp.unlisten(this._ioListener);
      }
      this._ioProp = undefined;
    }
  }
}

/** Syncs `#inputs`/`#outputs` custom descriptors onto a host block's `#props`. */
export class FlowPropsSync {
  private readonly _inputs: FlowCustomWatcher;
  private readonly _outputs: FlowCustomWatcher;
  private _batching = false;
  private _destroyed = false;
  private _flow: Flow | null = null;
  private _lastProps: (PropDesc | PropGroupDesc)[] | undefined;

  constructor(
    private readonly _host: Block,
    private readonly _reserved?: ReadonlySet<string>
  ) {
    activePropsSyncCount.set(_host, (activePropsSyncCount.get(_host) ?? 0) + 1);
    const onChange = () => this._sync();
    this._inputs = new FlowCustomWatcher(onChange);
    this._outputs = new FlowCustomWatcher(onChange);
  }

  setFlow(flow: Flow | null | undefined): void {
    if (this._destroyed) return;
    const next = flow && !flow._destroyed ? flow : null;
    if (next === this._flow && next !== null) {
      this._sync();
      return;
    }
    this._batching = true;
    this._inputs.detach();
    this._outputs.detach();
    this._flow = next;
    if (next) {
      this._inputs.attach(next, '#inputs');
      this._outputs.attach(next, '#outputs');
    }
    this._batching = false;
    this._sync();
  }

  setData(data: DataMap | null | undefined): void {
    if (this._destroyed) return;
    this._batching = true;
    this._inputs.detach();
    this._outputs.detach();
    this._flow = null;
    this._inputs.value = isDataMap(data?.['#inputs']) ? (data['#inputs'] as DataMap)['#custom'] : undefined;
    this._outputs.value = isDataMap(data?.['#outputs']) ? (data['#outputs'] as DataMap)['#custom'] : undefined;
    this._batching = false;
    this._sync();
  }

  private _sync() {
    if (this._batching || this._destroyed || this._host._destroyed) return;
    const collected = collectFlowIOProperties(this._inputs.value, this._outputs.value, this._reserved);
    const next = collected.length ? collected : undefined;
    if (!deepEqual(next, this._lastProps)) {
      this._lastProps = next;
      this._host.updateValue('#props', next);
    }
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._batching = true;
    this._inputs.detach();
    this._outputs.detach();
    this._flow = null;
    const remaining = (activePropsSyncCount.get(this._host) ?? 1) - 1;
    if (remaining <= 0) {
      activePropsSyncCount.delete(this._host);
      if (!this._host._destroyed) {
        this._host.updateValue('#props', undefined);
      }
    } else {
      activePropsSyncCount.set(this._host, remaining);
    }
  }
}
