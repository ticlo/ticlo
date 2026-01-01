import {Functions} from '../../block/Functions.js';
import {BaseFunction, StatefulFunction} from '../../block/BlockFunction.js';
import {BlockIO} from '../../block/BlockProperty.js';
import {EventType, NO_EMIT, WAIT} from '../../block/Event.js';
import type {Block} from '../../block/Block.js';
import {BlockMode} from '../../block/Descriptor.js';

const MIN_DELAY = 0.001;
const DEFAULT_DELAY = 1;

export class DelayFunction extends BaseFunction<Block> {
  private _timeout?: any;
  private _onTimer = () => {
    this._timeout = null;
    this._timerTriggered = true;
    this._data._queueFunction();
  };
  private _inputChanged = false;
  private _timerTriggered = false;
  inputChanged(input: BlockIO, val: unknown): boolean {
    if (input._name === 'input') {
      this._inputChanged = true;
    }
    return true;
  }

  initInputs() {
    if (this._data.getValue('input') !== undefined) {
      this._inputChanged = true;
      const blockMode = this._data.getValue('#mode');
      if (blockMode == null || blockMode === 'onLoad') {
        this._data._queueFunction();
      }
    }
  }
  run() {
    if (this._timerTriggered) {
      this._timerTriggered = false;
      this._data.output(this._data.getValue('input'));
      return undefined;
    }

    if (this._inputChanged) {
      this._inputChanged = false;
      const mode = this._data.getValue('mode');
      if (mode === 'window' && this._timeout) {
        return WAIT;
      }
      if (this._timeout) {
        clearTimeout(this._timeout);
      }
      let delay = Number(this._data.getValue('delay'));
      if (!Number.isFinite(delay) || delay < MIN_DELAY) {
        delay = DEFAULT_DELAY;
      }
      this._timeout = setTimeout(this._onTimer, delay * 1000);
      return WAIT;
    }
    return NO_EMIT;
  }

  cancel(reason: EventType, mode: BlockMode): boolean {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
      return true;
    }
    this._timerTriggered = false;
    return false;
  }

  cleanup() {
    if (this._timeout) {
      clearTimeout(this._timeout);
    }
    this._data.output(undefined);
    super.cleanup();
  }

  destroy() {
    if (this._timeout) {
      clearTimeout(this._timeout);
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
