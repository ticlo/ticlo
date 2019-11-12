import {FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor';
import {ClientCallbacks, ClientDescListener, SubscribeCallbacks} from './ClientRequests';

import {DataMap} from '../util/DataTypes';

/**
 * interface for ClientConnect and its wrappers
 */

export interface ClientConn {
  getBaseConn(): ClientConn;

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

  applyWorkerChange(path: string, funcId?: string, callbacks?: ClientCallbacks): Promise<any> | string;

  showProps(path: string, props: string[], callbacks?: ClientCallbacks): Promise<any> | string;

  hideProps(path: string, props: string[], callbacks?: ClientCallbacks): Promise<any> | string;

  moveShownProp(path: string, propFrom: string, propTo: string, callbacks?: ClientCallbacks): Promise<any> | string;

  setLen(path: string, group: string, length: number, callbacks?: ClientCallbacks): Promise<any> | string;

  addMoreProp(
    path: string,
    desc: PropDesc | PropGroupDesc,
    group?: string,
    callbacks?: ClientCallbacks
  ): Promise<any> | string;

  removeMoreProp(path: string, name: string, group?: string, callbacks?: ClientCallbacks): Promise<any> | string;

  moveMoreProp(
    path: string,
    nameFrom: string,
    nameTo: string,
    group?: string,
    callbacks?: ClientCallbacks
  ): Promise<any> | string;

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

  findGlobalBlocks(tags: string[]): string[];

  cancel(id: string): void;
}
