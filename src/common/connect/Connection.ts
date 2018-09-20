import {DataMap} from "../util/Types";

export class ConnectionSendingData {
  /* istanbul ignore next */
  getSendingData(): {data: DataMap, size: number} {
    // to be overridden
    /* istanbul ignore next */
    throw new Error("not implemented");
  }
}

export class Connection {

  _sending: Set<ConnectionSendingData> = new Set();
  _waitingReceive: boolean = false;
  _scheduled: any;

  /* istanbul ignore next */
  doSend(datas: DataMap[]): void {
    // to be overridden
    /* istanbul ignore next */
    throw new Error("not implemented");
  }

  /* istanbul ignore next */
  onData(data: DataMap): void {
    // to be overridden
    /* istanbul ignore next */
    throw new Error("not implemented");
  }

  onReceive(data: DataMap[]) {
    this._waitingReceive = false;
    if ((this._sending.size > 0 || data.length > 0) && !this._scheduled) {
      this._schedule();
    }
    for (let d of data) {
      this.onData(d);
    }
  }

  addSend(data: ConnectionSendingData) {
    this._sending.add(data);
    if (this._scheduled || this._waitingReceive) {
      return;
    }
    this._schedule();
  }

  _schedule() {
    this._scheduled = setTimeout(() => {
      this._doSend();
      this._scheduled = null;
    }, 0);
  }

  _doSend() {
    let sending: DataMap[] = [];
    let sendingSize = 0;
    for (let s of this._sending) {
      this._sending.delete(s);
      let {data, size} = s.getSendingData();
      if (data != null) {
        sendingSize += size;
        sending.push(data);
      }
      if (size > 0x80000) {
        break;
      }
    }
    this.doSend(sending);
    if (sending.length) {
      this._waitingReceive = true;
    }
  }

  destroy() {
    if (this._scheduled) {
      clearTimeout(this._scheduled);
    }
    this._sending = null;
  }
}

export class ConnectionSend extends ConnectionSendingData {
  _data: DataMap;

  constructor(data: DataMap = null) {
    super();
    this._data = data;
  }

  getSendingData(): {data: DataMap, size: number} {
    let size = 0;
    for (let key in this._data) {
      let v = this._data[key];
      if (typeof v === 'string') {
        size += v.length;
      } else {
        size += 4;
      }
    }
    return {data: this._data, size};
  }
}
