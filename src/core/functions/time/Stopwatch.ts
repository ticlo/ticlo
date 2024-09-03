// align to whole minutes, 5 minutes 10 minutes, 15minute 30 minutes, whole hour

// interval is in seconds, but allows 0.01 second,  when interval > 60, use scheduler instead of setInterval

import {AutoUpdateFunction} from '../base/AutoUpdateFunction';
import {Functions} from '../../block/Functions';

const MIN_INTERVAL = 0.001;
const DEFAULT_INTERVAL = 1;

class StopwatchFunction extends AutoUpdateFunction {
  #timeout?: any;
  #onTimer = () => {
    this.#timeout = null;
  };
  run() {}
  cleanup() {
    if (this.#timeout) {
      clearTimeout(this.#timeout);
    }
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
      {name: 'module', type: 'number', min: 0, default: 1},
      {name: 'loop', type: 'toggle'},
      {name: '#output', type: 'number', readonly: true},
    ],
  },
  'time'
);
