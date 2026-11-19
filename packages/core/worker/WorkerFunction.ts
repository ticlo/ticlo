import {BaseFunction, StatefulFunction} from '../block/BlockFunction.ts';
import {FunctionDesc, getDefaultDataFromCustom, PropDesc, PropGroupDesc} from '../block/Descriptor.ts';
import {BlockConfig, BlockIO} from '../block/BlockProperty.ts';
import {Flow, Root} from '../block/Flow.ts';
import {Event, EventType} from '../block/Event.ts';
import {DataMap} from '../util/DataTypes.ts';
import {RepeaterWorker, WorkerFlow} from './WorkerFlow.ts';
import {FlowStorage} from '../block/Storage.ts';
import {deepEqual} from '../util/Compare.ts';
import {globalFunctions} from '../block/FunctionModule.ts';
import {Block, BlockChildWatch} from '../block/Block.ts';
import {FlowPropsSync} from '../block/FlowIO.ts';
import {WorkerControl, type WorkerHost} from './WorkerControl.ts';

const WORKER_RESERVED = new Set(['#state', '#use', '#props']);

export enum WorkerMode {
  ON = 'on',
  OFF = 'off',
  DISABLE = 'disable',
  /**
   * When flow is not created, lazy means do not load the flow,
   * When flow is already created, lazy means do not unload or change its disable status
   */
  LAZY = 'lazy',
}

export const WorkerModeOptions = Object.values(WorkerMode);

export class WorkerCollector extends Event {
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

export class WorkerFunction extends BaseFunction<Block> implements WorkerHost {
  readonly workerField = '#use';
  readonly control: WorkerControl;

  _funcFlow: WorkerFlow;
  private readonly _propsSync: FlowPropsSync;

  constructor(data: Block) {
    super(data);
    this.control = new WorkerControl(this, data);
    this._propsSync = new FlowPropsSync(data, WORKER_RESERVED);
    // make sure collector is emitted even when there are no sync block under it
    data.getProperty('#emit');
  }

  private _syncProps() {
    if (this._funcFlow && !this._funcFlow._destroyed) {
      this._propsSync.setFlow(this._funcFlow);
    } else {
      this._propsSync.setData(this.control.getWorkerData());
    }
  }

  configChanged(config: BlockConfig, val: any): boolean {
    switch (config._name) {
      case '#state':
        return true;
      case '#use': {
        const changed = this.control.onUseChange(val);
        if (changed) {
          this._propsSync.setData(this.control.getWorkerData());
        }
        return changed;
      }
      default:
        return false;
    }
  }
  initInputs() {
    this.control.onUseChange(this._data.getValue('#use'));
    this._syncProps();
  }

  inputChanged(input: BlockIO, val: any): boolean {
    return false;
  }

  _collector: WorkerCollector;

  onCall(val: any): boolean {
    if (val instanceof WorkerCollector) {
      this._collector = val;
      return true;
    }
    return false;
  }

  createWorker(disable: boolean) {
    if (!this.control.isReady()) {
      return;
    }
    if (this._funcFlow == null) {
      const {src, saveCallback} = this.control.getSaveParameter();
      const subFlowMode = this._data.getValue('#state') ?? WorkerMode.ON;
      if (subFlowMode === WorkerMode.ON) {
        this._funcFlow = this._data.createOutputFlow(RepeaterWorker, '#worker', src, this._data, saveCallback);
        this._funcFlow?.updateInput(this._data);
      }
    } else {
      this._funcFlow.updateValue('#disabled', disable || undefined);
    }
  }

  run(): any {
    if (this._collector) {
      this._collector.addSubFlow(this._data);
    }
    if (this.control._srcChanged) {
      this._data.deleteValue('#worker');
      this._funcFlow = null;
      this.control._srcChanged = false;
    }

    const subFlowMode = this._data.getValue('#state');
    switch (subFlowMode) {
      case WorkerMode.OFF: {
        if (this._funcFlow != null) {
          this._data.deleteValue('#worker');
          this._funcFlow = null;
        }
        break;
      }
      case WorkerMode.DISABLE: {
        this.createWorker(true);
        break;
      }
      case WorkerMode.LAZY: {
        // Do nothing
        break;
      }
      // case 'on:
      default: {
        this.createWorker(false);
      }
    }
    this._syncProps();

    if (this._collector) {
      const result = this._collector;
      this._collector = null;
      return result;
    }
  }

  cleanup(): void {
    this._data.deleteValue('#worker');
    this._funcFlow = null;
    this._propsSync.setData(null);
  }

  destroy() {
    this._propsSync.destroy();
    this.control.destroy();
    super.destroy();
  }
}

function getDefaultWorker(block: Block, field: string, blockStack: Map<any, any>): DataMap {
  // only works with work instance #input #output
  // not for any field
  if (field == null) {
    const custom = block.getValue('#custom');
    if (Array.isArray(custom) && custom.length) {
      const inputs = custom.filter((data) => !data.readonly);
      const outputs = custom.filter((data) => data.readonly).map((data) => ({...data, readonly: false}));
      const result: any = {'#is': ''};
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

globalFunctions.addFactory(
  WorkerFunction,
  {
    name: 'worker',
    priority: 3,
    dynamicProps: true,
    properties: [
      {
        name: '#state',
        type: 'radio-button',
        options: WorkerModeOptions,
        default: WorkerMode.ON,
      },
      {
        name: '#use',
        type: 'worker',
      },
    ],
    category: 'repeat',
    icon: 'svg:file',
  },
  null,
  {getDefaultWorker}
);
