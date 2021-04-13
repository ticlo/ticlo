import {BaseFunction} from '../../block/BlockFunction';
import {Functions} from '../../block/Functions';
import {defaultConfigs, PropDesc, PropGroupDesc} from '../../block/Descriptor';
import {BlockConfig} from '../../block/BlockProperty';

export class CreateObjectFunction extends BaseFunction {
  configChanged(config: BlockConfig, val: any): boolean {
    switch (config._name) {
      case '#custom':
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
            let fields = prop.properties.map((p) => p.name);
            if (fields.length === 1 && fields[0] === prop.name) {
              // use flat array instead of array of Object wrapper when group name is same as field name
              fields = null;
            }
            output[prop.name] = this._data.getArray(prop.name, prop.defaultLen, fields);
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
  properties: [{name: '#output', pinned: true, type: 'object', readonly: true}],
  configs: ([{name: '#extend', type: 'object'}] as (string | PropDesc)[]).concat(defaultConfigs),
  category: 'data',
});
