import {BlockFunction} from '../../block/BlockFunction';
import {type BlockConfig} from '../../block/BlockProperty';

export class FolderFunction extends BlockFunction {
  #autoUpdate = true;
  #setAutoUpdate(v: boolean) {
    if (v === this.#autoUpdate) {
      this.#autoUpdate = v;
      return true;
    }
    return false;
  }

  configChanged(config: BlockConfig, val: unknown): boolean {
    if (config._name === 'mode') {
      return this.#setAutoUpdate(config._value == null || config._value === 'auto');
    }
    return false;
  }

  run() {}

  cleanup(): void {}
}
