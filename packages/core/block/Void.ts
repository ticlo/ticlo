import {BlockProperty, BlockPropertyEvent, BlockPropertySubscriber} from './BlockProperty.js';
import {PropListener} from './Dispatcher.js';
import {_strictMode} from './BlockSettings.js';

class VoidProperty extends BlockProperty {
  static readonly instance = new VoidProperty(null, '');

  onChange(val: unknown, save?: boolean): boolean {
    return false;
  }

  setValue(val: unknown) {
    // do nothing
  }

  setBinding(path: string) {
    // do nothing
  }

  _saveValue(): unknown {
    if (_strictMode) {
      throw new Error('Can not save destroyed property');
    }
    return;
  }

  _load(val: unknown) {
    if (_strictMode) {
      throw new Error('Can not load destroyed property');
    }
  }

  _liveUpdate(val: unknown) {
    if (_strictMode) {
      throw new Error('Can not liveUpdate destroyed property');
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

  listen(listener: PropListener<any>) {
    // do nothing
  }

  unlisten(listener: PropListener<any>) {
    // do nothing
  }

  destroy() {
    // do nothing
  }
}

export const voidProperty = VoidProperty.instance;
