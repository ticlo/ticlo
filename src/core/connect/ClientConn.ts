import {FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor';
import {ClientCallbacks, ClientDescListener, SubscribeCallbacks, ValueUpdate} from './ClientRequests';

import {DataMap} from '../util/DataTypes';
import {StreamDispatcher} from '../block/Dispatcher';

/**
 * interface for ClientConnect and its wrappers
 */

export interface ClientConn {
  getBaseConn(): ClientConn;

  childrenChangeStream(): StreamDispatcher<{path: string; showNode?: boolean}>;

  callImmediate(f: () => void): void;

  lockImmediate(source: any): void;

  unlockImmediate(source: any): void;

  // unimportant request may be merged with other set request on same path
  setValue(path: string, value: any, important?: boolean | ClientCallbacks): Promise<any> | string;

  updateValue(path: string, value: any, important?: boolean | ClientCallbacks): Promise<any> | string;

  /**
   *
   * @param path
   * @param from
   * @param absolute When true, path is full path of the source object.
   *   If path is undefined, means the binding should keep the current primitive value
   * @param important
   */
  setBinding(
    path: string,
    from: string,
    absolute?: boolean,
    important?: boolean | ClientCallbacks
  ): Promise<any> | string;

  getValue(path: string, callbacks?: ClientCallbacks): Promise<any> | string;

  createBlock(path: string, data?: DataMap, anyName?: boolean, callbacks?: ClientCallbacks): Promise<any> | string;

  addJob(path: string, data?: DataMap, callbacks?: ClientCallbacks): Promise<any> | string;

  listChildren(path: string, filter?: string, max?: number, callbacks?: ClientCallbacks): Promise<any> | string;

  subscribe(path: string, callbacks: SubscribeCallbacks, fullValue?: boolean): void;

  unsubscribe(path: string, callbacks: SubscribeCallbacks): void;

  watch(path: string, callbacks: ClientCallbacks): void;

  unwatch(path: string, callbacks: ClientCallbacks): void;

  editWorker(
    path: string,
    fromField?: string,
    fromFunction?: string,
    callbacks?: ClientCallbacks
  ): Promise<any> | string;

  applyJobChange(path: string, funcId?: string, callbacks?: ClientCallbacks): Promise<any> | string;

  showProps(path: string, props: string[], callbacks?: ClientCallbacks): Promise<any> | string;

  hideProps(path: string, props: string[], callbacks?: ClientCallbacks): Promise<any> | string;

  moveShownProp(path: string, propFrom: string, propTo: string, callbacks?: ClientCallbacks): Promise<any> | string;

  setLen(path: string, group: string, length: number, callbacks?: ClientCallbacks): Promise<any> | string;

  addCustomProp(
    path: string,
    desc: PropDesc | PropGroupDesc,
    group?: string,
    callbacks?: ClientCallbacks
  ): Promise<any> | string;

  removeCustomProp(path: string, name: string, group?: string, callbacks?: ClientCallbacks): Promise<any> | string;

  moveCustomProp(
    path: string,
    nameFrom: string,
    nameTo: string,
    group?: string,
    callbacks?: ClientCallbacks
  ): Promise<any> | string;

  addOptionalProp(path: string, name: string, callbacks?: ClientCallbacks): Promise<any> | string;

  removeOptionalProp(path: string, name: string, callbacks?: ClientCallbacks): Promise<any> | string;

  moveOptionalProp(path: string, nameFrom: string, nameTo: string, callbacks?: ClientCallbacks): Promise<any> | string;

  insertGroupProp(path: string, group: string, idx: number, callbacks?: ClientCallbacks): Promise<any> | string;

  removeGroupProp(path: string, group: string, idx: number, callbacks?: ClientCallbacks): Promise<any> | string;

  moveGroupProp(
    path: string,
    group: string,
    oldIdx: number,
    newIdx: number,
    callbacks?: ClientCallbacks
  ): Promise<any> | string;

  watchDesc(id: string, listener?: ClientDescListener): FunctionDesc;

  unwatchDesc(listener: ClientDescListener): void;

  getCategory(category: string): FunctionDesc;

  findGlobalBlocks(tags: string[]): string[];

  cancel(id: string): void;
}

export class ValueSubscriber {
  conn: ClientConn;
  path: string;

  constructor(callbacks: SubscribeCallbacks) {
    if (callbacks) {
      this.onUpdate = callbacks.onUpdate;
      this.onError = callbacks.onError;
    }
  }

  onUpdate(response: ValueUpdate): void {}

  onError(error: string, data?: DataMap): void {}

  subscribe(conn: ClientConn, path: string, fullValue = false) {
    if (this.conn === conn && this.path === path) {
      return;
    }
    if (this.conn && this.path) {
      this.conn.unsubscribe(path, this);
    }
    this.conn = conn;
    this.path = path;
    if (this.conn && this.path) {
      this.conn.subscribe(this.path, this, fullValue);
    }
  }

  unsubscribe() {
    if (this.conn && this.path) {
      this.conn.unsubscribe(this.path, this);
      this.conn = null;
      this.path = null;
    }
  }
}
