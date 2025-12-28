import {PureFunction} from '../../block/BlockFunction.js';
import {Functions} from '../../block/Functions.js';
import {defaultConfigs, PropDesc, PropGroupDesc} from '../../block/Descriptor.js';
import {BlockConfig} from '../../block/BlockProperty.js';
import {DataMap} from '../../util/DataTypes.js';
import {getInputsArray} from '../../block/FunctonData.js';

export class CreateObjectFunction extends PureFunction {
  configChanged(config: BlockConfig, val: any): boolean {
    switch (config._name) {
      case '#custom':
      case '+extend':
        return true;
      default:
        return false;
    }
  }

  run() {
    const baseObj = this._data.getValue('+extend');
    const output: DataMap = typeof baseObj === 'object' ? {...baseObj} : {};
    const custom = this._data.getValue('#custom') as PropDesc | PropGroupDesc[];
    if (Array.isArray(custom)) {
      for (const prop of custom) {
        if (prop) {
          if (prop.type === 'group') {
            let fields = prop.properties.map((p) => p.name);
            if (fields.length === 1 && fields[0] === prop.name) {
              // use flat array instead of array of Object wrapper when group name is same as field name
              fields = null;
            }
            output[prop.name] = getInputsArray(this._data, prop.name, prop.defaultLen, fields);
          } else {
            const val = this._data.getValue(prop.name);
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
  configs: ([{name: '+extend', type: 'object'}] as (string | PropDesc)[]).concat(defaultConfigs),
  category: 'data',
});

// Class used for CreateHeader and CreateStyle
export class CreateObjectFunctionOptional extends PureFunction {
  configChanged(config: BlockConfig, val: any): boolean {
    switch (config._name) {
      case '+extend':
      case '#optional':
        return true;
      default:
        return false;
    }
  }

  run() {
    const baseObj = this._data.getValue('+extend');
    const output: DataMap = typeof baseObj === 'object' ? {...baseObj} : {};
    for (const field of this._data.getOptionalProps()) {
      const value = this._data.getValue(field);
      if (value !== undefined) {
        output[field] = value;
      }
    }
    this._data.output(output);
  }
}
