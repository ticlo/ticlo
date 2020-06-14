import {BlockMode, BlockModeList} from './Block';
import {DataMap} from '..';

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
  pinned?: boolean; // whether property is shown in block view

  // default value shown in editor when value is undefined
  default?: string | number | boolean;

  // initialize new block with the init value
  init?: any;

  // number, string
  placeholder?: string;

  // string, like javascript jsx json etc
  // used by TextEditorTab
  mime?: string;

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

export interface FunctionCommandDesc {
  parameters: PropDesc[];
}

export interface FunctionDesc {
  name: string;
  id?: string;
  icon?: string;
  /** namespace of the function */
  ns?: string;
  src?: 'worker' | 'js' | 'category' | 'hidden';
  help?: string;
  priority?: 0 | 1 | 2 | 3;
  mode?: BlockMode;
  properties?: (PropDesc | PropGroupDesc)[];
  configs?: (string | PropDesc)[];
  // optional properties defined in base function, base function can be the current function itself
  base?: string;
  optional?: {[key: string]: PropDesc};
  commands?: {[key: string]: FunctionCommandDesc};
  /** recipient property will receive value or binding when parent property is converted to subblock of this type */
  recipient?: string;
  // used by service editor to filter global blocks
  tags?: string[];
  // a React class to display special component in block UI in the editor
  // not used on server side
  view?: any;

  color?: string;
  // block color and icon can change with @b-style={color,icon}
  dynamicStyle?: boolean;

  category?: string;
}

export const blankFuncDesc: FunctionDesc = {
  name: '',
  icon: '',
  properties: [],
};
export const blankPropDesc: PropDesc = {
  name: '',
  type: 'any',
};
export const lengthPropDesc: PropDesc = {name: '[]', type: 'number', default: 2, min: 0, step: 1};
export const configDescs: {[key: string]: PropDesc} = {
  '#is': {name: '#is', type: 'type'},
  '#is(readonly)': {name: '#is', type: 'type', readonly: true},
  '#mode': {
    name: '#mode',
    type: 'select',
    options: BlockModeList,
    default: 'auto',
  },
  '#call': {name: '#call', type: 'event'},
  '#sync': {name: '#sync', type: 'toggle'},
  '#disabled': {name: '#disabled', type: 'toggle', default: false},
  '#wait': {name: '#wait', type: 'toggle', readonly: true},
  '#wait(#outputs)': {name: '#wait', type: 'toggle'},
  '#cancel': {name: '#cancel', type: 'event'},
  '#priority': {
    name: '#priority',
    type: 'select',
    options: ['auto', 0, 1, 2, 3],
    default: 'auto',
  },
  '#value': {name: '#value', type: 'any'},
  '#render': {name: '#render', type: 'object', readonly: true},
  '#inputs': {name: '#inputs', type: 'any'},
  '#outputs': {name: '#outputs', type: 'any'},
  '#desc': {name: '#desc', type: 'object'},
  '#cacheMode': {name: '#cacheMode', type: 'radio-button', options: ['auto', 'persist'], default: 'auto'},
};

export const defaultConfigs = ['#call', '#mode', '#priority', '#sync', '#disabled', '#wait'];

export const defaultConfigDescs: PropDesc[] = defaultConfigs.map((name: string) => configDescs[name]);

export function mapConfigDesc(configs: (string | PropDesc)[]): PropDesc[] {
  if (configs == null) {
    return undefined;
  }
  if ((configs as any).mappedConfig) {
    return configs as PropDesc[];
  }
  let result: PropDesc[] = [];
  (result as any).mappedConfig = true;
  for (let config of configs) {
    if (typeof config === 'object') {
      result.push(config);
    } else if (configDescs.hasOwnProperty(config)) {
      result.push(configDescs[config]);
    }
  }
  return result;
}

export const attributeDescs: {[key: string]: PropDesc} = {
  '@b-name': {name: '@b-name', type: 'string'},
  '@b-p': {name: '@b-p', type: 'array'},
  '@b-xyw': {name: '@b-xyw', type: 'array'},
};

export const attributeList: PropDesc[] = [attributeDescs['@b-name'], attributeDescs['@b-p'], attributeDescs['@b-xyw']];

export function buildPropDescCache(
  funcDesc: FunctionDesc,
  custom: (PropDesc | PropGroupDesc)[],
  andCustom?: (PropDesc | PropGroupDesc)[]
): {[key: string]: PropDesc} {
  if (!funcDesc) return null;

  let result: {[key: string]: PropDesc} = {};

  function addProps(props: (PropDesc | PropGroupDesc)[]) {
    if (!props) return;
    for (let prop of props) {
      if (prop.type === 'group') {
        result[`${prop.name}[]`] = lengthPropDesc;
        for (let gprop of (prop as PropGroupDesc).properties) {
          // add number index to the property name
          result[`${gprop.name}0`] = gprop;
        }
      } else {
        result[prop.name] = prop;
      }
    }
  }

  addProps(mapConfigDesc(funcDesc.configs));
  addProps(custom);
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

function initBlockProperties(data: any, properties: (PropDesc | PropGroupDesc)[], pinAll: boolean = false) {
  let props: string[] = [];
  for (let propDesc of properties) {
    if ((propDesc as PropGroupDesc).properties) {
      for (let i = 0; i < (propDesc as PropGroupDesc).defaultLen; ++i) {
        for (let childDesc of (propDesc as PropGroupDesc).properties) {
          let propName = `${childDesc.name}${i}`;
          if (pinAll || childDesc.pinned) {
            props.push(propName);
          }
          if (childDesc.init !== undefined) {
            data[propName] = childDesc.init;
          }
        }
      }
    } else {
      if (pinAll || (propDesc as PropDesc).pinned) {
        props.push(propDesc.name);
      }
      if ((propDesc as PropDesc).init !== undefined) {
        data[propDesc.name] = (propDesc as PropDesc).init;
      }
    }
  }
  data['@b-p'] = props;
}

export function getDefaultFuncData(desc: FunctionDesc) {
  let data: any = {
    '#is': desc.id,
  };
  initBlockProperties(data, desc.properties);
  return data;
}
export function getSubBlockFuncData(data: DataMap) {
  if (Array.isArray(data['@b-p']) && data['@b-p'].includes('#output')) {
    return {...data, '@b-p': data['@b-p'].filter((str) => str !== '#output')};
  }
  return data;
}

export function getDefaultDataFromCustom(
  custom: (PropDesc | PropGroupDesc)[],
  base: DataMap = {'#is': ''},
  pinAll: boolean = true
) {
  let data: any = {...base, '#custom': custom};
  initBlockProperties(data, custom, pinAll);
  return data;
}

export function getOutputDesc(desc: FunctionDesc): PropDesc {
  if (desc && desc.properties?.length) {
    let last = desc.properties[desc.properties.length - 1];
    if (last.name === '#output' && last.type !== 'group') {
      return last;
    }
  }
  return null;
}
