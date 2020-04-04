import React, {KeyboardEvent, ReactNode} from 'react';
import {Button, Tooltip} from 'antd';
import MenuUnfoldIcon from '@ant-design/icons/MenuUnfoldOutlined';
import MenuFoldIcon from '@ant-design/icons/MenuFoldOutlined';
import {BlockStage, PropertyList} from '../..';
import {Divider} from 'rc-dock/lib';
import {arrayEqual, ClientConn, ValueSubscriber, ValueUpdate} from '../../../../src/core/editor';
import {BlockStageTabButton} from './BlockStageTabButton';
import {LazyUpdateComponent} from '../../component/LazyUpdateComponent';
import {TooltipIconButton} from '../../component/TooltipIconButton';

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
  state: State = {showPropertyList: true, selectedKeys: [], sizes: [1000, 1], blockKey: 'Job'};

  static editorCount = 0;

  static createDockTab(
    path: string,
    conn: ClientConn,
    onSelect?: (keys: string[], handled: boolean) => void,
    onSave?: () => void
  ) {
    let id = `blockEditor${BlockStagePane.editorCount++}`;
    let tabName = decodeURIComponent(path.split('.').pop());
    return {
      id,
      closable: !onSave, // use the custom close button when onSave is not null
      title: onSave ? <BlockStageTabButton conn={conn} id={id} path={path} title={tabName} onSave={onSave} /> : tabName,
      group: 'blockStage',
      content: <BlockStagePane conn={conn} basePath={path} onSelect={onSelect} onSave={onSave} />,
    };
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
    console.log(123);
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
                icon={showPropertyList ? <MenuUnfoldIcon /> : <MenuFoldIcon />}
                onClick={this.onShowPropertyList}
                tooltip={showPropertyList ? 'Hide Properties' : 'Show Properties'}
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
