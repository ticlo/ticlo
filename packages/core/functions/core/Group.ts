import {BaseFunction, StatefulFunction} from '../../block/BlockFunction.ts';
import {type BlockConfig} from '../../block/BlockProperty.ts';
import {globalFunctions} from '../../block/FunctionLib.ts';
import {type Block} from '../../block/Block.ts';

export class GroupFunction extends BaseFunction<Block> {
  private _autoUpdate = true;
  private _setAutoUpdate(v: boolean) {
    if (v === this._autoUpdate) {
      this._autoUpdate = v;
      return true;
    }
    return false;
  }

  configChanged(config: BlockConfig, val: unknown): boolean {
    if (config._name === 'mode') {
      return this._setAutoUpdate(config._value == null || config._value === 'auto');
    }
    return false;
  }

  run() {}

  cleanup(): void {}
}

globalFunctions.addFactory(GroupFunction, {
  name: 'group',
  icon: 'fas:folder',
  color: '9bd',
  properties: [],
});
