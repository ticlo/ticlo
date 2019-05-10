import {BlockMode} from "./Block";

// high: always show in block, unless toggled by user
// low: always hide in block
// undefined: show in block but not in sub block
export type VisibleType = 'high' | 'low' ;

export type ValueType =
  'number'
  | 'string'
  | 'toggle'
  | 'select'
  | 'color'
  | 'event'
  | 'datetime'
  | 'password'
  | 'js'
  | 'map'
  | 'array'
  | 'any'
  // special editors
  | 'type'
  ;

export interface PropDesc {
  name: string;
  type: ValueType;
  editor?: string;
  readonly?: boolean;
  visible?: VisibleType; // whether property is shown in block view

  // number, string
  placeholder?: string;

  // number
  min?: number;
  max?: number;
  step?: number;

  // bool, select, tags
  options?: (string | number)[];
  default?: string | number | boolean;

  // color
  disableAlpha?: boolean;
}

export interface PropGroupDesc {
  group: string;
  properties?: PropDesc[];
}

export interface FunctionDesc {
  name: string;
  ns?: string;
  id?: string;
  help?: string;
  icon?: string;
  priority?: 0 | 1 | 2 | 3;
  mode?: BlockMode;
  useLength?: boolean;
  properties?: (PropDesc | PropGroupDesc)[];
  attributes?: (PropDesc)[];

  view?: any;

  style?: 'repeater' | 'service';
  folder?: string;
}

export function getFuncStyleFromDesc(desc: FunctionDesc, prefix = 'ticl-block-pr'): string {
  let {style, priority} = desc;
  if (style) {
    return prefix + style.substr(0, 1);
  }
  if (priority > -1) {
    return prefix + priority;
  }
  return '';
}

export const blankFuncDesc: FunctionDesc = {
  name: '',
  icon: ''
};
export const blankPropDesc: PropDesc = {
  name: '',
  type: 'any'
};

export const configDescs: {[key: string]: PropDesc} = {
  '#is': {name: '#is', type: 'string'},
  '#mode': {
    name: '#mode',
    type: 'select',
    options: ['auto', 'onLoad', 'onChange', 'onCall', 'disabled'],
    default: 'auto'
  },
  '#len': {name: '#len', type: 'number', default: 2, min: 0, step: 1},
  '#call': {name: '#call', type: 'event'},
  '#sync': {name: '#sync', type: 'toggle'},
  '#wait': {name: '#wait', type: 'toggle'},
  '#cancel': {name: '#cancel', type: 'event'},
  '#priority': {name: '#priority', type: 'select', options: ['auto', 0, 1, 2, 3], default: 'auto'},
  '#input': {name: '#input', type: 'any'},
  '#output': {name: '#output', type: 'any'},
};

export const configList: PropDesc[] = [
  configDescs['#call'],
  configDescs['#mode'],
  configDescs['#priority'],
  configDescs['#sync'],
];

export function buildDescCache(funcDesc: FunctionDesc, more: (PropDesc | PropGroupDesc)[]): {[key: string]: PropDesc} {
  if (!funcDesc) return null;

  let result: {[key: string]: PropDesc} = {};

  function addProps(props: (PropDesc | PropGroupDesc)[]) {
    if (!props) return;
    for (let prop of props) {
      if ((prop as PropGroupDesc).group != null) {
        result[`${(prop as PropGroupDesc).group}#len`] = configDescs['#len'];
        for (let gprop of (prop as PropGroupDesc).properties) {
          // add number index to the property name
          result[`${(prop as PropDesc).name}0`] = (prop as PropDesc);
        }
      } else {
        result[(prop as PropDesc).name] = (prop as PropDesc);
      }
    }
  }

  addProps(more);
  addProps(funcDesc.properties);

  return result;
}

const numberReg = /[0-9]/;

export function findPropDesc(name: string, cache: {[key: string]: PropDesc}): PropDesc {
  if (!name || !cache) {
    return blankPropDesc;
  }
  let numMatch = name.match(numberReg);
  if (numMatch) {
    let baseName = name.substr(0, numMatch.index);
    name = `${baseName}0`;
  }
  if (cache.hasOwnProperty(name)) {
    return cache[name];
  }
  if (configDescs.hasOwnProperty(name)) {
    return configDescs[name];
  }
  return blankPropDesc;
}