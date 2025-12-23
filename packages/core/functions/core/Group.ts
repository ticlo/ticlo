import {BaseFunction, StatefulFunction} from '../../block/BlockFunction.js';
import {type BlockConfig} from '../../block/BlockProperty.js';
import {Functions} from '../../block/Functions.js';
import {type Block} from '../../block/Block.js';

export class GroupFunction extends BaseFunction<Block> {
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

Functions.add(GroupFunction, {
  name: 'group',
  icon: 'fas:folder',
  color: '9bd',
  properties: [],
});
