import React from 'react';
import {
  FunctionDesc,
  getDefaultFuncData,
  ClientConn,
  encodeTicloName,
  translateFunction,
  TicloI18nSettings,
} from '@ticlo/core/editor.ts';
import {TIcon} from '../icon/Icon.tsx';
import {DragDropDiv, DragState} from 'rc-dock';
import {getFuncStyleFromDesc} from '../util/BlockColors.ts';
import {Dropdown, Menu} from 'antd';
import {BuildOutlined, DeleteOutlined, EditOutlined} from '@ant-design/icons';

import {TicloLayoutContext, TicloLayoutContextType} from '../component/LayoutContext.ts';
import {LocalizedFunctionName, t} from '../component/LocalizedLabel.tsx';
import {MenuProps} from 'antd';
import {PopupHost, type PopupActions} from '../popup/PopupHost.tsx';

export type OnFunctionClick = (name: string, desc: FunctionDesc, data: any) => void;

interface Props {
  conn: ClientConn;
  desc: FunctionDesc;
  name?: any;
  data?: any;
  onClick?: OnFunctionClick;
  funcLib?: string;
}

export class FunctionView extends React.PureComponent<Props, any> {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;
  popup = React.createRef<PopupActions>();

  onDrag = (e: DragState) => {
    let {conn, data, desc} = this.props;

    if (!data) {
      data = getDefaultFuncData(desc);
    }

    let name = desc.name;
    if (TicloI18nSettings.useLocalizedBlockName) {
      name = translateFunction(desc.id, desc.name, desc.ns);
    }
    e.setData(
      {
        blockName: name,
        blockData: data,
        functionDesc: desc,
        isStaticBlock: e.event.altKey,
      },
      conn.getBaseConn()
    );
    e.startDrag(undefined, undefined, {opacity: 0.9});
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
  onEditClicked = () => {
    const {conn, desc, funcLib} = this.props;
    const editPath = `#temp.#edit-${encodeTicloName(desc.id)}`;
    conn.editWorker(editPath, null, desc.id, undefined, desc.id.startsWith(':') ? funcLib : undefined);
    this.context.editFlow(editPath, () => {
      conn.applyFlowChange(editPath, undefined, this.popup.current?.requestCallbacks);
    });
  };
  onDeleteClicked = () => {
    const {conn, desc, funcLib} = this.props;
    conn.deleteFunction(desc.id, desc.id.startsWith(':') ? funcLib : undefined, this.popup.current?.requestCallbacks);
  };

  getMenu = (): MenuProps => {
    return {
      selectable: false,
      items: [
        {
          key: 'edit',
          onClick: this.onEditClicked,
          label: (
            <>
              <BuildOutlined />
              {t('Edit')}
            </>
          ),
        },
        {
          key: 'rename',
          label: (
            <>
              <EditOutlined />
              {t('Rename')}
            </>
          ),
        },
        {
          key: 'delete',
          onClick: this.onDeleteClicked,
          label: (
            <>
              <DeleteOutlined />
              {t('Delete')}
            </>
          ),
        },
      ],
    };
  };

  render() {
    const {desc, conn} = this.props;
    const {ns, id} = desc;
    const idParts = id.split(':');
    let prefix: string | null = null;
    if (idParts.length > 1) {
      prefix = idParts.at(-2);
      if (!prefix && idParts.length > 2) {
        prefix = idParts.at(-3);
      }
    }
    const [colorClass, iconName] = getFuncStyleFromDesc(desc, conn, 'ticl-e-bg--');
    const typeView = (
      <DragDropDiv className={`${colorClass} ticl-e-func-view`} onClick={this.onClick} onDragStartT={this.onDrag}>
        <TIcon icon={iconName} />
        {prefix ? <span className="ticl-e-func-ns">{prefix}</span> : null}
        <LocalizedFunctionName desc={desc} className="ticl-e-func-name" />
      </DragDropDiv>
    );

    let content = typeView;
    if (
      (ns?.startsWith('+') || (id.startsWith(':') && this.props.funcLib != null)) &&
      desc.src === 'worker' &&
      this.context?.editFlow
    ) {
      content = (
        <Dropdown menu={this.getMenu()} trigger={['contextMenu']}>
          {typeView}
        </Dropdown>
      );
    }
    return (
      <>
        {content}
        <PopupHost ref={this.popup} />
      </>
    );
  }
}
