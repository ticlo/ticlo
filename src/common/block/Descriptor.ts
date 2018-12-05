import {BlockMode} from "./Block";

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
  help?: string;
  editor?: string;
  readonly?: boolean;
}

export interface PropGroupDesc {
  group: string;
  type: ValueType;
  help?: string;
  editor?: string;
  readonly?: boolean;
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
  inputs?: (PropDesc | PropGroupDesc)[];
  outputs?: PropDesc[];
  attributes?: (PropDesc)[];

  style?: 'repeater' | 'service';
  folder?: string;
}

export function getFuncStyleFromDesc(desc: FunctionDesc): string {
  let {style, priority} = desc;
  if (style) {
    return 'ticl-block-pr' + style.substr(0, 1);
  }
  if (priority > -1) {
    return 'ticl-block-pr' + priority;
  }
  return '';
}
