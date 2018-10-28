import {BlockMode} from "./Block";

export type ValueType = 'number' | 'string' | 'bool' | 'map' | 'array' | 'dynamic';

export interface PropDesc {
  name: string;
  type: ValueType;
  help?: string;
  editor?: string;
}

export interface PropGroupDesc {
  group: string;
  type: ValueType;
  help?: string;
  editor?: string;
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
