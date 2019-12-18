import {BlockMode, BlockModeList} from './Block';

// high: always show in block, unless toggled by user
// low: always hide in block
// undefined: show in block but not in sub block
export type VisibleType = 'high' | 'low';

export type ValueType =
  | 'number'
  | 'string'
  | 'toggle'
  | 'select'
  | 'multi-select'
  | 'combo-box'
  | 'radio-button'
  | 'color'
  | 'event'
  | 'date'
  | 'date-range'
  | 'password'
  | 'js'
  | 'object'
  | 'array'
  | 'none' // editor not allowed
  | 'any'
  // special editors
  | 'type'
  | 'worker'
  | 'service';

export interface PropDesc {
  name: string;
  type: ValueType;
  readonly?: boolean;
  visible?: VisibleType; // whether property is shown in block view

  // default value shown in editor when value is undefined
  default?: string | number | boolean;

  // initialize new block with the init value
  init?: any;

  // number, string
  placeholder?: string;

  // number
  min?: number;
  max?: number;
  step?: number;

  // bool, select, multi-select, radio-button, service
  options?: (string | number)[];

  // color
  disableAlpha?: boolean;

  // date, date-range
  showTime?: boolean;

  // service, object
  create?: string;

  // allowed types in editor for dynamic types
  types?: ValueType[];
}

export interface PropGroupDesc {
  name: string;
  type: 'group';
  defaultLen: number;
  properties?: PropDesc[];
}

export interface FunctionDesc {
  name: string;
  /** namespace of the function */
  ns?: string;
  id?: string;
  src?: 'worker' | 'js';
  help?: string;
  icon?: string;
  priority?: 0 | 1 | 2 | 3;
  mode?: BlockMode;
  properties?: (PropDesc | PropGroupDesc)[];
  configs?: PropDesc[];
  attributes?: PropDesc[];
  /** recipient property will receive value or binding when parent property is converted to subblock of this type */
  recipient?: string;
  // used by service editor to filter global blocks
  tags?: string[];
  // a React class to display special component in block UI in the editor
  // not used on server side
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
  icon: '',
  properties: []
};
export const blankPropDesc: PropDesc = {
  name: '',
  type: 'any'
};

export const configDescs: {[key: string]: PropDesc} = {
  '#is': {name: '#is', type: 'type'},
  '#is(readonly)': {name: '#is', type: 'type', readonly: true},
  '#mode': {
    name: '#mode',
    type: 'select',
    options: BlockModeList,
    default: 'auto'
  },
  '#len': {name: '#len', type: 'number', default: 2, min: 0, step: 1},
  '#call': {name: '#call', type: 'event'},
  '#sync': {name: '#sync', type: 'toggle'},
  '#wait': {name: '#wait', type: 'toggle', readonly: true},
  '#wait(output)': {name: '#wait', type: 'toggle'},
  '#cancel': {name: '#cancel', type: 'event'},
  '#priority': {
    name: '#priority',
    type: 'select',
    options: ['auto', 0, 1, 2, 3],
    default: 'auto'
  },
  '#value': {name: '#value', type: 'any'},
  '#input': {name: '#input', type: 'any'},
  '#output': {name: '#output', type: 'any'}
};

export const configList: PropDesc[] = [
  configDescs['#call'],
  configDescs['#mode'],
  configDescs['#priority'],
  configDescs['#sync'],
  configDescs['#wait']
];

export const attributeDescs: {[key: string]: PropDesc} = {
  '@b-p': {name: '@b-p', type: 'array'},
  '@b-xyw': {name: '@b-xyw', type: 'array'}
};

export const attributeList: PropDesc[] = [attributeDescs['@b-p'], attributeDescs['@b-xyw']];

export function buildPropDescCache(
  funcDesc: FunctionDesc,
  more: (PropDesc | PropGroupDesc)[],
  andMore?: (PropDesc | PropGroupDesc)[]
): {[key: string]: PropDesc} {
  if (!funcDesc) return null;

  let result: {[key: string]: PropDesc} = {};

  function addProps(props: (PropDesc | PropGroupDesc)[]) {
    if (!props) return;
    for (let prop of props) {
      if (prop.type === 'group') {
        result[`${prop.name}#len`] = configDescs['#len'];
        for (let gprop of (prop as PropGroupDesc).properties) {
          // add number index to the property name
          result[`${gprop.name}0`] = gprop;
        }
      } else {
        result[prop.name] = prop;
      }
    }
  }
  addProps(funcDesc.configs);
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

function initBlockProperties(data: any, properties: (PropDesc | PropGroupDesc)[], isSubBlock = false) {
  let props: string[] = [];
  for (let propDesc of properties) {
    if ((propDesc as PropGroupDesc).properties) {
      for (let i = 0; i < (propDesc as PropGroupDesc).defaultLen; ++i) {
        for (let childDesc of (propDesc as PropGroupDesc).properties) {
          let propName = `${childDesc.name}${i}`;
          if (shouldShowProperty(childDesc.visible, isSubBlock)) {
            props.push(propName);
          }
          if (childDesc.init !== undefined) {
            data[propName] = childDesc.init;
          }
        }
      }
    } else {
      if (shouldShowProperty((propDesc as PropDesc).visible, isSubBlock)) {
        props.push(propDesc.name);
      }
      if ((propDesc as PropDesc).init !== undefined) {
        data[propDesc.name] = (propDesc as PropDesc).init;
      }
    }
  }
  data['@b-p'] = props;
}

export function getDefaultFuncData(desc: FunctionDesc, isSubBlock = false) {
  let data: any = {
    '#is': desc.id
  };
  initBlockProperties(data, desc.properties, isSubBlock);
  return data;
}

export function getDefaultDataFromMore(more: (PropDesc | PropGroupDesc)[]) {
  let data: any = {'#is': '', '#more': more};
  initBlockProperties(data, more);
  return data;
}

export function getOutputDesc(desc: FunctionDesc): PropDesc {
  if (desc && desc.properties.length) {
    let last = desc.properties[desc.properties.length - 1];
    if (last.name === 'output' && last.type !== 'group') {
      return last;
    }
    return null;
  }
}
