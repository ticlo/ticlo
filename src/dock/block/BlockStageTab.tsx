import React, {ReactNode} from 'react';
import {Button, Tooltip} from 'antd';
import UnorderedListIcon from '@ant-design/icons/UnorderedListOutlined';
import CloseIcon from '@ant-design/icons/CloseOutlined';
import {BlockStage, PropertyList} from '../../editor';
import {Divider} from 'rc-dock/lib';
import {arrayEqual} from '../../core/util/Compare';
import {ClientConn} from '../../core/connect/ClientConn';
import {TrackedClientConn} from '../../core/connect/TrackedClientConn';
import {BlockStageTabButton} from './BlockStageTabButton';

import './BlockStageTab.less';

interface Props {
  conn: ClientConn;
  basePath: string;
  onSelect?: (keys: string[], handled: boolean) => void;
}

interface State {
  showPropertyList: boolean;
  selectedKeys: string[];
  sizes: number[];
}

export class BlockStageTab extends React.PureComponent<Props, State> {
  state: State = {showPropertyList: true, selectedKeys: [], sizes: [1000, 1]};

  static editorCount = 0;

  static createDockTab(
    path: string,
    conn: ClientConn,
    onSelect?: (keys: string[], handled: boolean) => void,
    onSave?: () => void
  ) {
    let trackedConn = new TrackedClientConn(conn);
    let id = `blockEditor${BlockStageTab.editorCount++}`;
    let tabName = path.split('.').pop();
    return {
      id,
      closable: !onSave,
      title: onSave ? <BlockStageTabButton conn={trackedConn} id={id} title={tabName} onSave={onSave} /> : tabName,
      group: 'blockStage',
      content: <BlockStageTab conn={trackedConn} basePath={path} onSelect={onSelect} />
    };
  }

  private _rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this._rootNode = node;
  };

  onShowPropertyList = () => {
    const {showPropertyList} = this.state;
    this.setState({showPropertyList: !showPropertyList});
  };

  onSelect = (keys: string[]) => {
    let {onSelect} = this.props;
    let {showPropertyList, selectedKeys} = this.state;
    if (arrayEqual(keys, selectedKeys)) {
      return;
    }

    this.setState({selectedKeys: keys});

    // send selection to parent
    if (onSelect) {
      onSelect(keys, showPropertyList);
    }
  };

  getDividerData = (idx: number) => {
    if (!this._rootNode) return null;
    let blockStage = this._rootNode.querySelector('.ticl-stage') as HTMLDivElement;
    let propertyList = this._rootNode.querySelector('.ticl-property-list') as HTMLDivElement;
    return {
      element: this._rootNode,
      beforeDivider: [{size: blockStage.offsetWidth}],
      afterDivider: [{size: propertyList.offsetWidth, minSize: 216}]
    };
  };

  // callback from the dragging
  changeSizes = (sizes: number[]) => {
    this.setState({sizes});
  };

  render() {
    let {conn, basePath} = this.props;
    let {showPropertyList, selectedKeys, sizes} = this.state;

    return (
      <div className="ticl-hbox ticl-stage-panel" ref={this.getRef}>
        <BlockStage
          key="stage"
          conn={conn}
          basePath={basePath}
          onSelect={this.onSelect}
          style={{width: sizes[0], height: '100%'}}
        />
        <div className="ticl-stage-header">{basePath}</div>
        {showPropertyList ? (
          <>
            <Divider key="divider" idx={1} getDividerData={this.getDividerData} changeSizes={this.changeSizes} />
            <PropertyList conn={conn} keys={selectedKeys} style={{width: sizes[1], height: '100%', padding: '8px'}} />
          </>
        ) : null}
        <Button
          className="ticl-square-icon-btn"
          size="small"
          shape="circle"
          tabIndex={-1}
          icon={showPropertyList ? <CloseIcon /> : <UnorderedListIcon />}
          onClick={this.onShowPropertyList}
        />
      </div>
    );
  }
}
