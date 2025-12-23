import React, {KeyboardEvent, ReactNode} from 'react';
import {Button, Tooltip} from 'antd';
import {MenuFoldOutlined, MenuUnfoldOutlined} from '@ant-design/icons';

import {BlockStage, PropertyList} from '../../index.js';
import {Divider, TabData} from 'rc-dock';
import {arrayEqual, ClientConn, getDisplayName, ValueSubscriber, ValueUpdate} from '@ticlo/core/editor.js';
import {BlockStageTabButton} from './BlockStageTabButton.js';
import {LazyUpdateComponent} from '../../component/LazyUpdateComponent.js';
import {TooltipIconButton} from '../../component/TooltipIconButton.js';
import {LocalizedNodeName, t} from '../../component/LocalizedLabel.js';

interface Props {
  conn: ClientConn;
  basePath: string;
  onSelect?: (keys: string[], handled: boolean) => void;
  onSave?: () => void;
}

interface State {
  showPropertyList: boolean;
  selectedKeys: string[];
  sizes: number[];
  blockKey: string;
}

export class BlockStagePane extends LazyUpdateComponent<Props, State> {
  state: State = {showPropertyList: true, selectedKeys: [], sizes: [1000, 1], blockKey: 'Flow'};

  static editorCount = 0;

  static createDockTab(
    path: string,
    conn: ClientConn,
    onSelect?: (keys: string[], handled: boolean) => void,
    onSave?: () => void
  ) {
    let id = `blockEditor${BlockStagePane.editorCount++}`;
    let tabName: string | React.ReactNode = getDisplayName(path.split('.').pop(), null);
    if ((tabName as string).startsWith('#')) {
      tabName = <LocalizedNodeName name={tabName as string} />;
    }
    return {
      id,
      closable: !onSave, // use the custom close button when onSave is not null
      title: onSave ? <BlockStageTabButton conn={conn} id={id} path={path} title={tabName} onSave={onSave} /> : tabName,
      group: 'blockStage',
      content: <BlockStagePane conn={conn} basePath={path} onSelect={onSelect} onSave={onSave} />,
    } as TabData;
  }

  private _rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this._rootNode = node;
  };

  initialBlockKey: string;
  blockListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      if (response.cache.value) {
        let blockKey = String(response.cache.value);
        if (!this.initialBlockKey) {
          this.initialBlockKey = blockKey;
        } else if (blockKey !== this.initialBlockKey) {
          // change the blockKey to force a stage reload
          this.safeSetState({blockKey, selectedKeys: []});
        }
      } else {
        this.safeSetState({blockKey: null, selectedKeys: []});
      }
    },
  });

  constructor(props: Props) {
    super(props);
    let {conn, basePath} = props;
    this.blockListener.subscribe(conn, basePath);
  }

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
      afterDivider: [{size: propertyList.offsetWidth, minSize: 216}],
    };
  };

  // callback from the dragging
  changeSizes = (sizes: number[]) => {
    this.setState({sizes});
  };

  onKeyDown = (e: KeyboardEvent) => {
    let {onSave} = this.props;
    switch (e.key) {
      case 's': {
        if (onSave && (e.ctrlKey || e.metaKey)) {
          onSave();
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
    }
  };

  renderImpl() {
    let {conn, basePath, onSave} = this.props;
    let {showPropertyList, selectedKeys, sizes, blockKey} = this.state;

    return (
      <div className="ticl-hbox ticl-stage-tab-content" ref={this.getRef} onKeyDown={this.onKeyDown} tabIndex={0}>
        {blockKey ? (
          <BlockStage
            key={blockKey}
            conn={conn}
            basePath={basePath}
            onSelect={this.onSelect}
            style={{width: sizes[0], height: '100%'}}
            toolButtons={
              <TooltipIconButton
                conn={conn}
                icon={showPropertyList ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={this.onShowPropertyList}
                tooltip={showPropertyList ? t('Hide Properties') : t('Show Properties')}
                tooltipPlacement="left"
              />
            }
          />
        ) : (
          <div style={{width: sizes[0], height: '100%'}}>Invalid Input</div>
        )}

        <div className="ticl-stage-header">{basePath}</div>
        {showPropertyList ? (
          <>
            <Divider key="divider" idx={1} getDividerData={this.getDividerData} changeSizes={this.changeSizes} />
            <PropertyList conn={conn} paths={selectedKeys} style={{width: sizes[1], height: '100%', padding: '8px'}} />
          </>
        ) : null}
      </div>
    );
  }
  componentWillUnmount() {
    this.blockListener.unsubscribe();
    super.componentWillUnmount();
  }
}
