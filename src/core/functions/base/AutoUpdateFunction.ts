import {ImpureFunction} from '../../block/BlockFunction';
import {ScheduleEvent, setSchedule} from '../../util/SetSchedule';
import {Block} from '../../block/Block';
import type {BlockConfig} from '../../block/BlockProperty';
import {FunctionData} from '../../block/FunctonData';

export abstract class AutoUpdateFunction extends ImpureFunction {
  #schedule: ScheduleEvent;
  #onTimer = (time: number) => {
    this.#schedule = null;
    if (this._data instanceof Block) {
      this._data._queueFunction();
    }
  };

  #autoUpdate: boolean;
  #setAutoUpdate(v: boolean) {
    if (v !== this.#autoUpdate && this._data instanceof Block) {
      this.#autoUpdate = v;
      if (!v && this.#schedule) {
        this.#schedule.cancel();
        this.#schedule = null;
      }
      return true;
    }
    return false;
  }

  addSchedule(nextCheck: number) {
    if (this.#autoUpdate) {
      if (nextCheck !== this.#schedule?.start) {
        this.#schedule?.cancel();
        this.#schedule = setSchedule(this.#onTimer, nextCheck);
      }
    }
  }

  constructor(data: FunctionData) {
    super(data);
    this.#autoUpdate = data instanceof Block;
  }

  configChanged(config: BlockConfig, val: unknown): boolean {
    if (config._name === 'mode') {
      return this.#setAutoUpdate(config._value == null || config._value === 'auto');
    }
    return false;
  }

  cleanup() {
    this.#schedule?.cancel();
    super.cleanup();
  }
  destroy() {
    this.#schedule?.cancel();
    super.destroy();
  }
}
