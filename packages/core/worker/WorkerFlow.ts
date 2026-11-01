import {FlowWithStatic, FlowWithStaticConfigGenerators} from '../block/StaticBlock.ts';
import {Root} from '../block/Flow.ts';
import {ConstTypeConfig} from '../block/BlockConfigs.ts';
import {BlockConfig, BlockProperty} from '../block/BlockProperty.ts';
import {Resolver} from '../block/Resolver.ts';
import {DataMap} from '../util/DataTypes.ts';
import {FlowHistory} from '../block/FlowHistory.ts';

export const WorkerFlowConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowWithStaticConfigGenerators,
  '#is': ConstTypeConfig('flow:worker'),
};

export class WorkerFlow extends FlowWithStatic {
  _createConfig(field: string): BlockProperty {
    if (field in WorkerFlowConfigGenerators) {
      return new WorkerFlowConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  onWait(val: any) {
    const wait = Boolean(val);
    if (!wait && wait !== this._waiting) {
      this.scheduleCheckReady();
    }
    super.onWait(wait);
  }

  // make sure the input triggers a change
  updateInput(val: any) {
    super.updateInput(val);
    if (!this._waiting) {
      this.scheduleCheckReady();
    }
  }

  _onReady: () => void;
  set onReady(func: () => void) {
    this._onReady = func;
  }
  checkReady = () => {
    if (!this._waiting) {
      this._onReady?.();
    }
  };

  scheduleCheckReady() {
    if (this._onReady) {
      Root.callLater(this.checkReady);
    }
  }

  startHistory() {
    if (!this._history) {
      this._history = new FlowHistory(this, this._loadFromData);
    }
  }

  _loadFromData: DataMap;
  _loadFlowData(map: DataMap, funcId?: string) {
    this._loadFromData = map;
    super._loadFlowData(map, funcId);
  }

  cancelChange() {
    if (this._loadFromData) {
      this._liveUpdate(this._loadFromData);
    }
  }
}

export class RepeaterWorker extends WorkerFlow {}
