export type ValueType = 'number' | 'string' | 'bool' | 'map' | 'array' | 'dynamic';

export interface PropDesc {
  name: string;
  type: ValueType;
  editor?: string;
}

export interface PropGroupDesc {
  group: string;
  type: ValueType;
  editor?: string;
}

export interface FunctionDesc {
  icon: string;
  useLength?: boolean;
  inputs?: (PropDesc | PropGroupDesc)[];
  outputs?: PropDesc[];
  attributes?: (PropDesc)[];
}
