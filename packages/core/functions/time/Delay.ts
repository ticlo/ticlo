import {Functions} from '../../block/Functions';
import {BaseFunction, StatefulFunction} from '../../block/BlockFunction';
import {BlockIO} from '../../block/BlockProperty';
import {EventType, NO_EMIT, WAIT} from '../../block/Event';
import type {Block} from '../../block/Block';
import {BlockMode} from '../../block/Descriptor';

const MIN_DELAY = 0.001;
const DEFAULT_DELAY = 1;

export class DelayFunction extends BaseFunction<Block> {
  #timeout?: any;
  #onTimer = () => {
    this.#timeout = null;
    this.#timerTriggered = true;
    this._data._queueFunction();
  };
  #inputChanged = false;
  #timerTriggered = false;
  inputChanged(input: BlockIO, val: unknown): boolean {
    if (input._name === 'input') {
      this.#inputChanged = true;
    }
    return true;
  }

  initInputs() {
    if (this._data.getValue('input') !== undefined) {
      this.#inputChanged = true;
      const blockMode = this._data.getValue('#mode');
      if (blockMode == null || blockMode === 'onLoad') {
        this._data._queueFunction();
      }
    }
  }
  run() {
    if (this.#timerTriggered) {
      this.#timerTriggered = false;
      this._data.output(this._data.getValue('input'));
      return undefined;
    }

    if (this.#inputChanged) {
      this.#inputChanged = false;
      const mode = this._data.getValue('mode');
      if (mode === 'window' && this.#timeout) {
        return WAIT;
      }
      if (this.#timeout) {
        clearTimeout(this.#timeout);
      }
      let delay = Number(this._data.getValue('delay'));
      if (!Number.isFinite(delay) || delay < MIN_DELAY) {
        delay = DEFAULT_DELAY;
      }
      this.#timeout = setTimeout(this.#onTimer, delay * 1000);
      return WAIT;
    }
    return NO_EMIT;
  }

  cancel(reason: EventType, mode: BlockMode): boolean {
    if (this.#timeout) {
      clearTimeout(this.#timeout);
      this.#timeout = null;
      return true;
    }
    this.#timerTriggered = false;
    return false;
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
  DelayFunction,
  {
    name: 'delay',
    icon: 'fas:stopwatch',
    priority: 2,
    properties: [
      {name: 'input', type: 'any', pinned: true},
      {name: '#output', type: 'any', pinned: true, readonly: true},
      {name: 'delay', type: 'number', min: MIN_DELAY, default: DEFAULT_DELAY, unit: 's'},
      {name: 'mode', type: 'select', options: ['wait', 'window'], default: 'wait'},
    ],
  },
  'time'
);
