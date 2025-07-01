import {FlowWithShared, FlowWithSharedConfigGenerators} from '../block/SharedBlock';
import {Root} from '../block/Flow';
import {ConstTypeConfig} from '../block/BlockConfigs';
import {BlockConfig, BlockProperty} from '../block/BlockProperty';
import {Resolver} from '../block/Resolver';
import {DataMap} from '../util/DataTypes';
import {FlowHistory} from '../block/FlowHistory';

export const WorkerFlowConfigGenerators: {[key: string]: typeof BlockProperty} = {
  ...FlowWithSharedConfigGenerators,
  '#is': ConstTypeConfig('flow:worker'),
};

export class WorkerFlow extends FlowWithShared {
  _createConfig(field: string): BlockProperty {
    if (field in WorkerFlowConfigGenerators) {
      return new WorkerFlowConfigGenerators[field](this, field);
    } else {
      return new BlockConfig(this, field);
    }
  }

  onWait(val: any) {
    let wait = Boolean(val);
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

export class RepeaterWorker extends WorkerFlow {
  getCacheKey(funcId: string, data: DataMap): any {
    if (!funcId && data['#cacheMode']) {
      return this._parent._parent.getProperty('#shared', true);
    }
    return super.getCacheKey(funcId, data);
  }
}
