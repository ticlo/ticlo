import {BlockProperty, BlockPropertyEvent, BlockPropertySubscriber} from "./BlockProperty";
import {Listener} from "./Dispatcher";
import {Root} from "./Block";


class VoidProperty extends BlockProperty {
  static readonly instance = new VoidProperty(null, '');

  onChange(val: any): boolean {
    return false;
  }

  setValue(val: any) {
    // do nothing
  }

  setBinding(path: string) {
    // do nothing
  }

  _save(): any {
    if (Root.instance._strictMode) {
      throw new Error("Can not save destroyed property");
    }
  }

  _load(val: any) {
    if (Root.instance._strictMode) {
      throw new Error("Can not load destroyed property");
    }
  }

  _liveUpdate(val: any) {
    if (Root.instance._strictMode) {
      throw new Error("Can not liveUpdate destroyed property");
    }
  }

  subscribe(subscriber: BlockPropertySubscriber) {
    // do nothing
  }

  unsubscribe(subscriber: BlockPropertySubscriber) {
    // do nothing
  }

  addEvent(event: BlockPropertyEvent) {
    // do nothing
  }

  listen(listener: Listener<any>) {
    // do nothing
  }

  unlisten(listener: Listener<any>) {
    // do nothing
  }

  destroy() {
    // do nothing
  }
}

export const voidProperty = VoidProperty.instance;
