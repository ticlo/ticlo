import {BlockMode} from "./Block";

// high: always show in block, unless toggled by user
// low: always hide in block
// undefined: show in block but not in sub block
export type VisibleType = 'high' | 'low' ;

export type ValueType =
  'number'
  | 'string'
  | 'bool'
  | 'select'
  | 'color'
  | 'datetime'
  | 'type'
  | 'js'
  | 'any'
  | 'map'
  | 'array'
  | 'any';

export interface PropDesc {
  name: string;
  type: ValueType;
  editor?: string;
  readonly?: boolean;
  visible?: VisibleType; // whether property is shown in block view
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

export const blankFuncDesc = {
  name: '',
  icon: ''
};
