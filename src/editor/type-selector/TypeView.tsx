import React from 'react';
import {FunctionDesc, getDefaultFuncData, ClientConn} from '../../../src/core/editor';
import {TIcon} from '../icon/Icon';
import {DragDropDiv, DragState} from 'rc-dock/lib';
import {getFuncStyleFromDesc} from '../util/BlockColors';

export type OnTypeClick = (name: string, desc: FunctionDesc, data: any) => void;

interface Props {
  conn: ClientConn;
  desc: FunctionDesc;
  name?: any;
  data?: any;
  onClick?: OnTypeClick;
}

export class TypeView extends React.PureComponent<Props, any> {
  onDrag = (e: DragState) => {
    let {conn, data, desc} = this.props;

    if (!data) {
      data = getDefaultFuncData(desc);
    }

    e.setData(
      {
        blockName: desc.name,
        blockData: data
      },
      conn.getBaseConn()
    );
    e.startDrag();
  };

  onClick = (e: React.MouseEvent) => {
    let {onClick, desc, name, data} = this.props;
    if (onClick) {
      if (!name) {
        name = desc.name;
      }
      onClick(name, desc, data);
    }
  };

  render() {
    let {desc, name, conn} = this.props;
    if (!name) {
      name = desc.name;
    }
    let {ns} = desc;
    let [colorClass, iconName] = getFuncStyleFromDesc(desc, conn, 'ticl-bg--');
    return (
      <DragDropDiv className={`${colorClass} ticl-type-view`} onClick={this.onClick} onDragStartT={this.onDrag}>
        <TIcon icon={iconName} />
        {ns ? <span className="ticl-type-ns">{ns}</span> : null}
        <span className="ticl-type-name">{name}</span>
      </DragDropDiv>
    );
  }
}
