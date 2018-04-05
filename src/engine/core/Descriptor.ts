export interface PropDesc {
  name: string;
  type: string;
  editor?: string;
}

export interface PropGroupDesc {
  group: string;
  size: string;
  fields: PropDesc[];
}

export interface LogicDesc {
  inputs?: (PropDesc | PropGroupDesc)[];
  outputs?: (PropDesc | PropGroupDesc)[];
  attributes?: (PropDesc)[];
}
