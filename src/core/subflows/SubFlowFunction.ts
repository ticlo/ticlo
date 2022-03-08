import {BlockFunction} from '../block/BlockFunction';
import {FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor';
import {BlockConfig, BlockIO} from '../block/BlockProperty';
import {Flow, Root} from '../block/Flow';
import {Event, EventType} from '../block/Event';
import {DataMap} from '../util/DataTypes';
import {WorkerFlow} from '../worker/WorkerFlow';
import {Storage} from '../block/Storage';
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
        LoadFunctionCache.loadData(this._data.getFullPath(), this);
      }
    } else {
      this._funcFlow.updateValue('#disabled', disable || undefined);
    }
  }

  run(): any {
    if (this._collector) {
      this._collector.addSubFlow(this._data);
    }
    let subFlowMode: SubFlowMode = this._data.getValue('#subflow');
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

    if (this._funcFlow == null && !this._loading) {
      this._loading = true;
      LoadFunctionCache.loadData(this._data.getFullPath(), this);
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
    let subFlowMode: SubFlowMode = this._data.getValue('#subflow');
    if (this._funcFlow == null && subFlowMode === 'on') {
      this._src = src;
      let applyChange: (data: DataMap) => boolean;
      applyChange = (data: DataMap) => {
        this._src = data;
        Root.instance._storage.saveFlow(this._data.getFullPath(), null, data);
        return true;
      };
      this._funcFlow = this._data.createOutputFlow(WorkerFlow, '#flow', this._src, this._data, applyChange);
      this._funcFlow.updateInput(this._data);
    }
  }

  cleanup(): void {
    this._data.deleteValue('#flow');
  }
}

Functions.add(SubFlowFunction, {
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
});
