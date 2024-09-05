// align to whole minutes, 5 minutes 10 minutes, 15minute 30 minutes, whole hour

// interval is in seconds, but allows 0.01 second,  when interval > 60, use scheduler instead of setInterval

import {AutoUpdateFunction} from '../base/AutoUpdateFunction';
import {Functions} from '../../block/Functions';
import {EventType} from '../../block/Event';
import {BlockMode} from '../../block/Descriptor';

const MIN_INTERVAL = 0.001;
const DEFAULT_INTERVAL = 1;

class StopwatchFunction extends AutoUpdateFunction {
  #timeout?: any;
  #onTimer = () => {
    this.#timeout = null;
  };
  onCall(val: unknown): boolean {
    return super.onCall(val);
  }

  run() {}

  cancel(reason: EventType, mode: BlockMode): boolean {
    const superResult = super.cancel(reason, mode);
    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
      return true;
    }
    return superResult;
  }

  cleanup() {
    if (this.#timeout) {
      clearTimeout(this.#timeout);
    }
    this._data.output(undefined);
    super.cleanup();
  }
  destroy() {
    if (this.#timeout) {
      clearTimeout(this.#timeout);
    }
    super.destroy();
  }
}

Functions.add(
  StopwatchFunction,
  {
    name: 'stopwatch',
    icon: 'fas:stopwatch',
    priority: 2,
    properties: [
      {name: 'interval', type: 'number', min: MIN_INTERVAL, default: DEFAULT_INTERVAL, unit: 's'},
      {name: 'module', type: 'number', min: 0, max: Number.MAX_SAFE_INTEGER, default: 1},
      {name: 'loop', type: 'toggle'},
      {name: '#output', type: 'number', readonly: true},
    ],
  },
  'time'
);
