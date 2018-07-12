import {BlockFunction, FunctionData} from "../block/BlockFunction";
import {DataMap, isSavedBlock} from "../util/Types";

export type MapWorkerMode = undefined | 'refresh' | 'persist';

export class MapImpl extends BlockFunction {

  _src: DataMap;
  _srcChanged: boolean = false;

  _onSourceChange(val: any): boolean {
    // TODO allow string src for class name
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
}