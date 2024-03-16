import {BlockFunction} from '../block/BlockFunction';
import {FunctionDesc, getDefaultDataFromCustom, PropDesc, PropGroupDesc} from '../block/Descriptor';
import {BlockConfig, BlockIO} from '../block/BlockProperty';
import {Flow, Root} from '../block/Flow';
import {Event, EventType} from '../block/Event';
import {DataMap} from '../util/DataTypes';
import {WorkerFlow} from '../worker/WorkerFlow';
import {FlowStorage} from '../block/Storage';
import {deepEqual} from '../util/Compare';
import {Functions} from '../block/Functions';
import {Block} from '../block/Block';

export enum SubFlowMode {
  ON = 'on',
  OFF = 'off',
  DISABLE = 'disable',
  /**
   * When flow is not created, lazy means do not load the flow,
   * When flow is already created, lazy means do not unload or change its disable status
   */
  LAZY = 'lazy',
}

export const SubFlowModeOptions = Object.values(SubFlowMode);

class LoadFunctionCache {
  static async loadData(path: string, func: SubFlowFunction) {
    let data = await Root.instance._storage.loadFlow(path);
    func.onDataLoaded(data ?? {});
  }
}

export class SubFlowCollector extends Event {
  passThrough = true;
  onPush: (block: Block) => void;

  constructor(type: string, onPush: (block: Block) => void) {
    super(type);
    this.onPush = onPush;
  }

  check(): number {
    // always trigger other blocks regardless of Event create time
    return EventType.TRIGGER;
  }

  addSubFlow(block: Block): void {
    this.onPush(block);
  }
}

/**
 * LoadFlowFunction is the function to load another flow
 */
export class SubFlowFunction extends BlockFunction {
  _funcFlow: WorkerFlow;
  _src: DataMap;
  _loading = false;
  _subflowModeChanged = false;

  constructor(data: Block) {
    super(data);
    // make sure collector is emitted even when there are no sync block under it
    data.getProperty('#emit');
  }

  getStoragePath() {
    return `${this._data.getFullPath()}.#`;
  }

  configChanged(config: BlockConfig, val: any): boolean {
    switch (config._name) {
      case '#subflow':
        this._subflowModeChanged = true;
        return true;
      default:
        return false;
    }
  }

  inputChanged(input: BlockIO, val: any): boolean {
    return false;
  }

  _collector: SubFlowCollector;

  onCall(val: any): boolean {
    if (val instanceof SubFlowCollector) {
      this._collector = val;
      return true;
    }
    return false;
  }

  loadFunctionFlow(disable: boolean) {
    if (this._funcFlow == null) {
      if (!this._loading && !disable) {
        // don't load the subflow when it's disabled
        this._loading = true;
        LoadFunctionCache.loadData(this.getStoragePath(), this);
      }
    } else {
      this._funcFlow.updateValue('#disabled', disable || undefined);
    }
  }

  run(): any {
    if (this._collector) {
      this._collector.addSubFlow(this._data);
    }
    let subFlowMode = this._data.getValue('#subflow');
    switch (subFlowMode) {
      case 'off': {
        if (this._funcFlow != null) {
          this._data.deleteValue('#flow');
          this._funcFlow = null;
        }
        break;
      }
      case 'disable': {
        this.loadFunctionFlow(true);
        break;
      }
      case 'lazy': {
        // Do nothing
        break;
      }
      // case 'on:
      default: {
        this.loadFunctionFlow(false);
      }
    }

    if (this._collector) {
      this._collector.addSubFlow(this._data);
      let result = this._collector;
      this._collector = null;
      return result;
    }
  }

  onDataLoaded(src: DataMap) {
    this._loading = false;
    let subFlowMode = this._data.getValue('#subflow') ?? SubFlowMode.ON;
    if (this._funcFlow == null && subFlowMode === SubFlowMode.ON) {
      this._src = src;
      let storagePath = this.getStoragePath();
      let applyChange = (data: DataMap) => {
        this._src = data;
        Root.instance._storage.saveFlow(null, data, storagePath);
        return true;
      };
      this._funcFlow = this._data.createOutputFlow(WorkerFlow, '#flow', this._src, this._data, applyChange);
      this._funcFlow.updateInput(this._data);
    }
  }

  cleanup(): void {
    this._data.deleteValue('#flow');
  }

  destroy() {
    if (this._data._destroyed && !this._data._flow._destroyed) {
      Root.instance._storage.delete(this.getStoragePath());
    }
    super.destroy();
  }
}

function getDefaultWorker(block: Block, field: string, blockStack: Map<any, any>): DataMap {
  // only works with work instance #input #output
  // not for any field
  if (field == null) {
    let custom = block.getValue('#custom');
    if (Array.isArray(custom) && custom.length) {
      let inputs = custom.filter((data) => !data.readonly);
      let outputs = custom.filter((data) => data.readonly).map((data) => ({...data, readonly: false}));
      let result: any = {'#is': ''};
      if (inputs.length) {
        result['#inputs'] = getDefaultDataFromCustom(inputs);
      }
      if (outputs.length) {
        result['#outputs'] = getDefaultDataFromCustom(outputs);
      }
      return result;
    }
  }
  return null;
}

Functions.add(
  SubFlowFunction,
  {
    name: 'sub-flow',
    priority: 3,
    properties: [
      {
        name: '#subflow',
        type: 'radio-button',
        options: SubFlowModeOptions,
        default: SubFlowMode.ON,
      },
    ],
    category: 'repeat',
    icon: 'fas:file',
  },
  null,
  {getDefaultWorker}
);
