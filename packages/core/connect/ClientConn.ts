import {FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor';
import {ClientCallbacks, ClientDescListener, SubscribeCallbacks, ValueUpdate} from './ClientRequests';

import {DataMap} from '../util/DataTypes';
import {StreamDispatcher} from '../block/Dispatcher';
import {Query} from './Query';

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

  // unimportant request may be merged with other set request on same path
  updateValue(path: string, value: any, important?: boolean | ClientCallbacks): Promise<any> | string;

  // restore saved value if current value not equal to saved value
  restoreSaved(path: string, callbacks?: ClientCallbacks): Promise<any> | string;

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

  getValue(path: string): Promise<any>;

  addBlock(path: string, data?: DataMap, anyName?: boolean, callbacks?: ClientCallbacks): Promise<any> | string;

  addFlow(path: string, data?: DataMap, callbacks?: ClientCallbacks): Promise<any> | string;

  addFlowFolder(path: string, callbacks?: ClientCallbacks): Promise<any> | string;

  list(path: string, filter?: string, max?: number, callbacks?: ClientCallbacks): Promise<any> | string;

  query(path: string, query: Query, callbacks?: ClientCallbacks): Promise<any> | string;

  subscribe(path: string, callbacks: SubscribeCallbacks, fullValue?: boolean): void;

  unsubscribe(path: string, callbacks: SubscribeCallbacks): void;

  watch(path: string, callbacks: ClientCallbacks): void;

  unwatch(path: string, callbacks: ClientCallbacks): void;

  editWorker(
    path: string,
    fromField?: string,
    fromFunction?: string,
    defaultData?: DataMap,
    callbacks?: ClientCallbacks
  ): Promise<any> | string;

  applyFlowChange(path: string, funcId?: string, callbacks?: ClientCallbacks): Promise<any> | string;

  deleteFunction(funcId?: string, callbacks?: ClientCallbacks): Promise<any> | string;

  showProps(path: string, props: string[], callbacks?: ClientCallbacks): Promise<any> | string;

  hideProps(path: string, props: string[], callbacks?: ClientCallbacks): Promise<any> | string;

  moveShownProp(path: string, propFrom: string, propTo: string, callbacks?: ClientCallbacks): Promise<any> | string;

  setLen(path: string, group: string, length: number, callbacks?: ClientCallbacks): Promise<any> | string;

  renameProp(path: string, newName: string): Promise<any> | string;

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

  undo(path: string, callbacks?: ClientCallbacks): Promise<any> | string;

  redo(path: string, callbacks?: ClientCallbacks): Promise<any> | string;

  copy(path: string, props: string[], cut?: boolean, callbacks?: ClientCallbacks): Promise<any> | string;

  executeCommand(path: string, command: string, params?: DataMap, callbacks?: ClientCallbacks): Promise<any> | string;

  paste(
    path: string,
    data: DataMap,
    resolve?: 'overwrite' | 'rename',
    callbacks?: ClientCallbacks
  ): Promise<any> | string;

  callFunction(path: string, callbacks?: ClientCallbacks): Promise<any> | string;

  watchDesc(id: string, listener?: ClientDescListener): FunctionDesc;

  unwatchDesc(listener: ClientDescListener): void;

  getCategory(category: string): FunctionDesc;

  getCommonBaseFunc(set: Set<FunctionDesc>): FunctionDesc;

  getOptionalProps(desc: FunctionDesc): {[key: string]: PropDesc};

  findGlobalBlocks(tags: string[]): string[];

  cancel(id: string): void;
}

export class ValueSubscriber {
  conn: ClientConn;
  path: string;
  fullValue: boolean;

  wasValid = false;
  constructor(public callbacks: SubscribeCallbacks) {}

  onUpdate(response: ValueUpdate): void {
    this.callbacks?.onUpdate?.(response);
    this.wasValid = true;
  }

  onError(error: string, data?: DataMap): void {
    if (this.wasValid) {
      this.wasValid = false;
      this.reSubscribe();
    } else {
      this.callbacks?.onError?.(error, data);
    }
  }

  subscribe(conn: ClientConn, path: string, fullValue = false) {
    this.fullValue = fullValue;
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

  reSubscribe() {
    if (this.conn && this.path) {
      this.conn.subscribe(this.path, this, this.fullValue);
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
