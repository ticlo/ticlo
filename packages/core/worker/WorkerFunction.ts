import {BaseFunction, StatefulFunction} from '../block/BlockFunction.js';
import {FunctionDesc, getDefaultDataFromCustom, PropDesc, PropGroupDesc} from '../block/Descriptor.js';
import {BlockConfig, BlockIO} from '../block/BlockProperty.js';
import {Flow, Root} from '../block/Flow.js';
import {Event, EventType} from '../block/Event.js';
import {DataMap} from '../util/DataTypes.js';
import {RepeaterWorker, WorkerFlow} from './WorkerFlow.js';
import {FlowStorage} from '../block/Storage.js';
import {deepEqual} from '../util/Compare.js';
import {globalFunctions} from '../block/Functions.js';
import {Block, BlockChildWatch} from '../block/Block.js';
import {WorkerControl, type WorkerHost} from './WorkerControl.js';

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

/**
 * SubFlowFunction is the function to load another flow from storage, not as a reusable worker
 */
export class WorkerFunction extends BaseFunction<Block> implements WorkerHost {
  readonly workerField = '+use';
  readonly control: WorkerControl;

  _funcFlow: WorkerFlow;

  constructor(data: Block) {
    super(data);
    this.control = new WorkerControl(this, data);
    // make sure collector is emitted even when there are no sync block under it
    data.getProperty('#emit');
  }

  configChanged(config: BlockConfig, val: any): boolean {
    switch (config._name) {
      case '+state':
        return true;
      case '+use':
        return this.control.onUseChange(val);
      default:
        return false;
    }
  }
  initInputs() {
    this.control.onUseChange(this._data.getValue('+use'));
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
      const subFlowMode = this._data.getValue('+state') ?? WorkerMode.ON;
      if (subFlowMode === WorkerMode.ON) {
        this._funcFlow = this._data.createOutputFlow(RepeaterWorker, '#flow', src, this._data, saveCallback);
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
      this._data.deleteValue('#flow');
      this._funcFlow = null;
      this.control._srcChanged = false;
    }

    const subFlowMode = this._data.getValue('+state');
    switch (subFlowMode) {
      case WorkerMode.OFF: {
        if (this._funcFlow != null) {
          this._data.deleteValue('#flow');
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

    if (this._collector) {
      const result = this._collector;
      this._collector = null;
      return result;
    }
  }

  cleanup(): void {
    this._data.deleteValue('#flow');
  }

  destroy() {
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

globalFunctions.add(
  WorkerFunction,
  {
    name: 'worker',
    priority: 3,
    properties: [
      {
        name: '+state',
        type: 'radio-button',
        options: WorkerModeOptions,
        default: WorkerMode.ON,
      },
      {
        name: '+use',
        type: 'worker',
      },
    ],
    category: 'repeat',
    icon: 'fas:file',
  },
  null,
  {getDefaultWorker}
);
