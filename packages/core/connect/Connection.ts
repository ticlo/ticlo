import {DataMap, measureObjSize, WS_FRAME_SIZE} from '../util/DataTypes.js';
import {Logger} from '../util/Logger.js';

export class ConnectionSendingData {
  /* istanbul ignore next */
  getSendingData(): {data: DataMap; size: number} {
    // to be overridden
    /* istanbul ignore next */
    throw new Error('not implemented');
  }
}

export class Connection {
  // null for new connection
  // false for not connected but scheduled
  _connected?: boolean;

  _sending: Set<ConnectionSendingData> = new Set();
  _waitingReceive: boolean = false;
  _scheduled: any;

  // must send something to the other side as an ack
  _mustSend = false;

  /* istanbul ignore next */
  doSend(datas: DataMap[]): void {
    // to be overridden
    /* istanbul ignore next */
    throw new Error('not implemented');
  }

  /* istanbul ignore next */
  onData(data: DataMap): void {
    // to be overridden
    /* istanbul ignore next */
    throw new Error('not implemented');
  }

  onConnect() {
    Logger.trace('connected', this);
    if (this._connected === false) {
      this._connected = true;
      this._schedule();
    } else {
      this._connected = true;
    }
  }

  onDisconnect() {
    Logger.trace('disconnected', this);
    this._connected = false;
    if (this._scheduled) {
      clearTimeout(this._scheduled);
      this._scheduled = null;
    }
  }

  _receiving = false;
  _callImmediates = new Set<() => void>();
  _immediateLock = 0;

  // if connection is receiving data, call the function after data is processed
  // otherwise call the function directly
  callImmediate(f: () => void) {
    if (this._receiving || this._immediateLock > 0) {
      // will be called after receiving
      this._callImmediates.add(f);
    } else {
      f();
    }
  }

  // prevenent callImmediate to be run until unlocked
  lockImmediate(source: any) {
    this._immediateLock++;
  }

  unlockImmediate(source: any) {
    this._immediateLock--;
    if (this._immediateLock <= 0 && this._callImmediates.size) {
      this.executeImmediates();
    }
  }

  executeImmediates = () => {
    for (let callback of this._callImmediates) {
      callback();
    }
    this._callImmediates.clear();
    this._immediateLock = 0;
  };

  onReceive(data: DataMap[]) {
    this._waitingReceive = false;
    if (data.length) {
      this._mustSend = true;
    }
    if ((this._sending.size > 0 || data.length > 0) && !this._scheduled) {
      this._schedule();
    }
    this._receiving = true;
    for (let d of data) {
      this.onData(d);
    }
    this._receiving = false;
    if (this._callImmediates.size) {
      this.executeImmediates();
    }
  }

  addSend(data: ConnectionSendingData) {
    if (this._destroyed) {
      return;
    }
    this._sending.add(data);
    if (this._scheduled || this._waitingReceive) {
      return;
    }
    this._schedule();
  }

  _schedule() {
    if (this._connected) {
      this._scheduled = setTimeout(() => {
        this._doSend();
        this._scheduled = null;
      }, 0);
    } else if (this._connected == null) {
      this._connected = false;
    }
  }

  _doSend() {
    let sending: DataMap[] = [];
    let sendingSize = 0;
    for (let s of this._sending) {
      this._sending.delete(s);
      const {data, size} = s.getSendingData();
      if (data != null) {
        sendingSize += size;
        sending.push(data);
      }
      if (sendingSize >= WS_FRAME_SIZE) {
        break;
      }
    }
    if (sending.length) {
      this.doSend(sending);
      this._waitingReceive = true;
    } else if (this._mustSend) {
      this.doSend([]);
    }
    this._mustSend = false;
  }

  _destroyed = false;

  destroy() {
    this._destroyed = true;
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

  getSendingData(): {data: DataMap; size: number} {
    let size = 0;
    for (let key in this._data) {
      let v = this._data[key];
      size += key.length;
      switch (typeof v) {
        case 'string':
          size += v.length;
          break;
        case 'object':
          size += measureObjSize(v);
          break;
        default:
          size += 4;
      }
    }
    return {data: this._data, size};
  }
}
