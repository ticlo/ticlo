import {BaseFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';
import {PropDesc, PropGroupDesc} from '../../block/Descriptor';
import {BlockConfig} from '../../block/BlockProperty';

export class CreateObjectFunction extends BaseFunction {
  configChanged(config: BlockConfig, val: any): boolean {
    switch (config._name) {
      case '#more':
      case '#extend':
        return true;
      default:
        return false;
    }
  }
  run() {
    let baseObj = this._data.getValue('#extend');
    let output = baseObj ? {...baseObj} : {};
    let custom: PropDesc | PropGroupDesc[] = this._data.getValue('#custom');
    if (Array.isArray(custom)) {
      for (let prop of custom) {
        if (prop) {
          if (prop.type === 'group') {
            let length = this._data.getLength(prop.name, prop.defaultLen);
            for (let groupProp of prop.properties) {
              let arr: any[] = [];
              for (let i = 0; i < length; ++i) {
                arr.push(this._data.getValue(`${groupProp.name}${i}`));
              }
              output[groupProp.name] = arr;
            }
          } else {
            let val = this._data.getValue(prop.name);
            if (val !== undefined) {
              output[prop.name] = this._data.getValue(prop.name);
            }
          }
        }
      }
    }
    this._data.output(output);
  }
}

Functions.add(CreateObjectFunction, {
  name: 'create-object',
  icon: 'txt:{ }',
  properties: [{name: '#output', type: 'object', readonly: true}],
  configs: [{name: '#extend', type: 'object'}, '#call', '#mode', '#priority', '#sync']
});
