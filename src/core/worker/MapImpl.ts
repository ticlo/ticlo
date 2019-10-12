import {BlockFunction, FunctionData} from '../block/BlockFunction';
import {DataMap, isSavedBlock} from '../util/DataTypes';
import {Block} from '../block/Block';

export type MapWorkerMode = undefined | 'reuse' | 'persist';

export class MapImpl extends BlockFunction {
  _src: DataMap;
  _srcChanged: boolean; /* = false*/

  _onSourceChange(val: any): boolean {
    // TODO allow string use for class name
    if (isSavedBlock(val)) {
      this._src = val;
      this._srcChanged = true;
      return true;
    }
    if (this._src) {
      this._src = undefined;
      this._srcChanged = true;
      return true;
    }
    return false;
  }

  _reuseWorker: MapWorkerMode;

  _onReuseWorkerChange(val: any): boolean {
    if (val !== 'reuse' && val !== 'persist') {
      val = undefined;
    }
    if (val !== this._reuseWorker) {
      this._reuseWorker = val;
      // reuseWorker change should be treated same as use change
      this._srcChanged = true;
      return true;
    }
    return false;
  }

  _timeout: number;
  _timeoutChanged: boolean;

  _onTimeoutChange(val: any): boolean {
    let n = Number(val);
    if (!(n >= 0)) {
      n = 0;
    }
    if (n === this._timeout) {
      return false;
    }
    this._timeoutChanged = true;
    this._timeout = n;
    return true;
  }
}
