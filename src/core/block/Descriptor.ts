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
  | 'radio-button'
  | 'color'
  | 'event'
  | 'date'
  | 'date-range'
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
  readonly?: boolean;
  visible?: VisibleType; // whether property is shown in block view

  default?: string | number | boolean;

  // number, string
  placeholder?: string;

  // number
  min?: number;
  max?: number;
  step?: number;

  // bool, select, radio-button
  options?: (string | number)[];

  // color
  disableAlpha?: boolean;

  // date, date-range
  showTime?: boolean;
}

export interface PropGroupDesc {
  group: string;
  defaultLen: number;
  properties?: PropDesc[];
}

export interface FunctionDesc {
  name: string;
  /** namespace of the function */
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

  category?: string;
  /** the order in the category */
  order?: number;
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

export function buildPropDescCache(funcDesc: FunctionDesc, more: (PropDesc | PropGroupDesc)[]): {[key: string]: PropDesc} {
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

export function shouldShowProperty(visible: VisibleType, isSubBlock: boolean) {
  if (isSubBlock) {
    return visible === 'high';
  } else {
    return visible !== 'low';
  }
}

export function getDefaultFuncData(desc: FunctionDesc, isSubBlock = false) {
  let data: any = {
    '#is': desc.id
  };

  // add default props
  let props = [];
  for (let propDesc of desc.properties) {
    if ((propDesc as PropGroupDesc).properties) {
      for (let i = 0; i < 2; ++i) {
        for (let childDesc of (propDesc as PropGroupDesc).properties) {
          if (shouldShowProperty((childDesc as PropDesc).visible, isSubBlock)) {
            props.push(`${(childDesc as PropDesc).name}${i}`);
          }
        }
      }
    } else if (shouldShowProperty((propDesc as PropDesc).visible, isSubBlock)) {
      props.push((propDesc as PropDesc).name);
    }
  }
  data['@b-p'] = props;
  return data;
}