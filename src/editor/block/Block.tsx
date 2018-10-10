import * as React from "react";
import {ClientConnection} from "../../common/connect/ClientConnection";
import {DataMap} from "../../common/util/Types";
import {DataRendererItem, PureDataRenderer} from "../../ui/component/DataRenderer";
import {TIcon} from "../icon/Icon";
import {FunctionDesc} from "../../common/block/Descriptor";


export interface Stage {
  _blocks: Map<string, BlockItem>;
  _links: Map<string, LinkItem>;
  _fields: Map<string, FieldItem>;
}

export class FieldItem extends DataRendererItem {
  conn: ClientConnection;
  key: string;
  isInput: boolean;
  isOutput: boolean;
  outLink: LinkItem;
  inLink: LinkItem;
  bindBlock?: BlockItem;

  render(): React.ReactNode {
    return <div className='ticl-block-row'/>;
  }
}

export class LinkItem {
  fromProp: FieldItem;
  toProp: FieldItem;
}

export class BlockItem extends DataRendererItem {
  conn: ClientConnection;
  x: number = 0;
  y: number = 0;
  w: number = 0;
  key: string;
  name: string;
  fields: FieldItem[] = [];
  selected: boolean = false;

  constructor(connection: ClientConnection, key: string) {
    super();
    this.conn = connection;
    this.key = key;
    this.name = key.substr(key.indexOf('.') + 1);
  }

  render(): React.ReactNode[] {
    let result: React.ReactNode[] = [];
    for (let field of this.fields) {
      result.push(field.render());
    }
    return result;
  }
}

interface FieldViewProps {
  item: FieldItem;
}

interface FieldViewState {

}


export class FieldView extends PureDataRenderer<FieldViewProps, FieldViewState> {

}


interface BlockViewProps {
  item: BlockItem;
}

interface BlockViewState {
  funcDesc: FunctionDesc;
}

const defaultFuncDesc = {
  id: '',
  icon: ''
};


export class BlockView extends PureDataRenderer<BlockViewProps, BlockViewState> {
  isListener = {
    onUpdate: (response: DataMap) => {

    }
  };
  xywListener = {
    onUpdate: (response: DataMap) => {

    }
  };
  pListener = {
    onUpdate: (response: DataMap) => {

    }
  };

  constructor(props: BlockViewProps) {
    super(props);
    this.state = {funcDesc: defaultFuncDesc};
    let {item} = props;
    item.conn.subscribe(`${item.key}.#is`, this.isListener);
    item.conn.subscribe(`${item.key}.@b-xyw`, this.xywListener);
    item.conn.subscribe(`${item.key}.@b-p`, this.pListener);
  }

  getFuncStyle(): string {
    let {style, priority} = this.state.funcDesc;
    if (style) {
      return 'ticl-block-pr' + style.substr(0, 1);
    }
    if (priority > -1) {
      return 'ticl-block-pr' + priority;
    }
    return '';
  }

  render() {
    let {item} = this.props;
    let {funcDesc} = this.state;
    return (
      <div
        className={`ticl-block ${this.getFuncStyle()}${item.selected ? ' ticl-block-selected' : ''}`}
        style={{top: item.y, left: item.x, width: item.w}}
      >
        <div className='ticl-block-head'>
          <TIcon icon={funcDesc.icon}/>
          {item.name}
        </div>
        <div className='ticl-block-body'>
          {item.render()}
        </div>
        <div className='ticl-block-foot'/>
      </div>
    );
  }
}

