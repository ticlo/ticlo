import {DataMap} from "../../common/util/Types";

let _scope: any;
let _data: DataMap;

export class DragStore {


  static dragStart(scope: any, data: DataMap) {
    _scope = scope;
    _data = data;
  }

  static getData(scope: any, field: string) {
    if (scope === _scope && _data) {
      return _data[field];
    }
    return null;
  }

  static dragEnd() {
    _scope = null;
    _data = null;
  }
}