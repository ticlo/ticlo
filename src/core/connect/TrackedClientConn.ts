import {ClientConn} from './ClientConn';
import {ValueDispatcher} from '../block/Dispatcher';
import {FunctionDesc, PropDesc, PropGroupDesc} from '../block/Descriptor';
import {ClientCallbacks, ClientDescListener, SubscribeCallbacks} from './ClientRequests';

import {DataMap} from '../util/DataTypes';

export class TrackedClientConn implements ClientConn {
  _base: ClientConn;

  readonly changed = new ValueDispatcher<boolean>();

  getBaseConn() {
    return this._base.getBaseConn();
  }

  constructor(base: ClientConn) {
    this._base = base;
    this.changed._value = false;
  }

  isChanged() {
    return this.changed._value;
  }

  _changed() {
    this.changed.updateValue(true);
  }

  acknowledge() {
    this.changed.updateValue(false);
  }

  addMoreProp(
    path: string,
    desc: PropDesc | PropGroupDesc,
    group?: string,
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    this._changed();
    return this._base.addMoreProp(path, desc, group, callbacks);
  }

  applyWorkerChange(path: string, funcId?: string, callbacks?: ClientCallbacks): Promise<any> | string {
    this._changed();
    return this._base.applyWorkerChange(path, funcId, callbacks);
  }

  callImmediate(f: () => void): void {
    this._base.callImmediate(f);
  }

  cancel(id: string): void {
    this._base.cancel(id);
  }

  createBlock(path: string, data?: DataMap, anyName?: boolean, callbacks?: ClientCallbacks): Promise<any> | string {
    this._changed();
    return this._base.createBlock(path, data, anyName, callbacks);
  }

  editWorker(
    path: string,
    fromField?: string,
    fromFunction?: string,
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    // TODO
    return this._base.editWorker(path, fromField, fromFunction, callbacks);
  }

  findGlobalBlocks(tags: string[]): string[] {
    return this._base.findGlobalBlocks(tags);
  }

  getValue(path: string, callbacks?: ClientCallbacks): Promise<any> | string {
    return this._base.getValue(path, callbacks);
  }

  hideProps(path: string, props: string[], callbacks?: ClientCallbacks): Promise<any> | string {
    this._changed();
    return this._base.hideProps(path, props, callbacks);
  }

  insertGroupProp(path: string, group: string, idx: number, callbacks?: ClientCallbacks): Promise<any> | string {
    this._changed();
    return this._base.insertGroupProp(path, group, idx, callbacks);
  }

  listChildren(path: string, filter?: string, max?: number, callbacks?: ClientCallbacks): Promise<any> | string {
    return this._base.listChildren(path, filter, max, callbacks);
  }

  lockImmediate(source: any): void {
    this._base.lockImmediate(source);
  }

  moveGroupProp(
    path: string,
    group: string,
    oldIdx: number,
    newIdx: number,
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    this._changed();
    return this._base.moveGroupProp(path, group, oldIdx, newIdx, callbacks);
  }

  moveMoreProp(
    path: string,
    nameFrom: string,
    nameTo: string,
    group?: string,
    callbacks?: ClientCallbacks
  ): Promise<any> | string {
    this._changed();
    return this._base.moveMoreProp(path, nameFrom, nameTo, group, callbacks);
  }

  moveShownProp(path: string, propFrom: string, propTo: string, callbacks?: ClientCallbacks): Promise<any> | string {
    this._changed();
    return this._base.moveShownProp(path, propFrom, propTo, callbacks);
  }

  removeGroupProp(path: string, group: string, idx: number, callbacks?: ClientCallbacks): Promise<any> | string {
    this._changed();
    return this._base.removeGroupProp(path, group, idx, callbacks);
  }

  removeMoreProp(path: string, name: string, group?: string, callbacks?: ClientCallbacks): Promise<any> | string {
    this._changed();
    return this._base.removeMoreProp(path, name, group, callbacks);
  }

  setBinding(
    path: string,
    from: string,
    absolute?: boolean,
    important?: boolean | ClientCallbacks
  ): Promise<any> | string {
    this._changed();
    return this._base.setBinding(path, from, absolute, important);
  }

  setLen(path: string, group: string, length: number, callbacks?: ClientCallbacks): Promise<any> | string {
    this._changed();
    return this._base.setLen(path, group, length, callbacks);
  }

  setValue(path: string, value: any, important?: boolean | ClientCallbacks): Promise<any> | string {
    this._changed();
    return this._base.setValue(path, value, important);
  }

  showProps(path: string, props: string[], callbacks?: ClientCallbacks): Promise<any> | string {
    this._changed();
    return this._base.showProps(path, props, callbacks);
  }

  subscribe(path: string, callbacks: SubscribeCallbacks, fullValue?: boolean): void {
    this._base.subscribe(path, callbacks, fullValue);
  }

  unlockImmediate(source: any): void {
    this._base.unlockImmediate(source);
  }

  unsubscribe(path: string, callbacks: SubscribeCallbacks): void {
    this._base.unsubscribe(path, callbacks);
  }

  unwatch(path: string, callbacks: ClientCallbacks): void {
    this._base.unwatch(path, callbacks);
  }

  unwatchDesc(listener: (desc: FunctionDesc, id: string) => void): void {
    this._base.unwatchDesc(listener);
  }

  updateValue(path: string, value: any, important?: boolean | ClientCallbacks): Promise<any> | string {
    return this._base.updateValue(path, value, important);
  }

  watch(path: string, callbacks: ClientCallbacks): void {
    this._base.watch(path, callbacks);
  }

  watchDesc(id: string, listener?: (desc: FunctionDesc, id: string) => void): FunctionDesc {
    return this._base.watchDesc(id, listener);
  }
}
