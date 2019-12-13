import {BaseFunction} from '../../block/BlockFunction';
import {Types} from '../../block/Type';
import {PropDesc, PropGroupDesc} from '../../block/Descriptor';

export class CreateObjectFunction extends BaseFunction {
  run() {
    let spread = this._data.getValue('#spread');
    let output = spread ? {...spread} : {};
    let more: PropDesc | PropGroupDesc[] = this._data.getValue('#more');
    if (Array.isArray(more)) {
      for (let prop of more) {
        if (prop) {
          if (prop.type === 'group') {
            let length = this._data.getValue(`${prop.name}#len`);
            if (!(length >= 0)) {
              length = prop.defaultLen;
            }
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

Types.add(CreateObjectFunction, {
  name: 'create-object',
  icon: 'txt:{ }',
  properties: [
    {name: '#spread', type: 'map'},
    {name: 'output', type: 'map', readonly: true}
  ],
  order: 0
});
