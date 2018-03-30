export interface PropDesc {
  name: string;
  type: string;
  editor?: string;
}

export interface PropGroupDesc {
  group: string,
  size: string,
  fields: Array<PropDesc>
}

export interface LogicDesc {
  inputs?: Array<PropDesc | PropGroupDesc>;
  outputs?: Array<PropDesc | PropGroupDesc>;
  attributes?: Array<PropDesc>;
}

