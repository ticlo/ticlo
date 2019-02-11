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
  options?: (string | number | boolean)[];
  default?: string | number | boolean;
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
  '#is': {name: '#is', type: 'type'},
  '#mode': {
    name: '#mode',
    type: 'select',
    options: ['auto', 'always', 'onChange', 'onCall', 'disabled'],
    default: 'auto'
  },
  '#call': {name: '#call', type: 'event'},
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
];

