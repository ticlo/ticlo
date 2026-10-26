import React, {ReactNode} from 'react';
import {Button, Tooltip} from 'antd';
import {MenuFoldOutlined, MenuUnfoldOutlined} from '@ant-design/icons';

import {BlockStage, PropertyList} from '../../index.ts';
import {Divider, TabData} from 'rc-dock';
import {arrayEqual, ClientConn, getDisplayName, ValueSubscriber, ValueUpdate} from '@ticlo/core/editor.ts';
import {BlockStageTabButton} from './BlockStageTabButton.tsx';
import {LazyUpdateComponent} from '../../component/LazyUpdateComponent.tsx';
import {TooltipIconButton} from '../../component/TooltipIconButton.tsx';
import {LocalizedNodeName, t} from '../../component/LocalizedLabel.tsx';
import {getFuncLibPath} from '../../util/FunctionLib.ts';

interface Props {
  conn: ClientConn;
  basePath: string;
  stageId?: string;
  /** Hide the property list and its toggle button. */
  disablePropertyList?: boolean;
  onSelect?: (keys: string[], handled: boolean) => void;
  onSave?: () => void;
}

interface State {
  showPropertyList: boolean;
  selectedKeys: string[];
  sizes: number[];
  blockKey: string;
  funcLib?: string;
}

export class BlockStagePane extends LazyUpdateComponent<Props, State> {
  state: State = {showPropertyList: true, selectedKeys: [], sizes: [1000, 1], blockKey: 'Flow'};
  private stage = React.createRef<BlockStage>();
  private activate = () => this.stage.current?.activate();

  static createDockTab(
    path: string,
    conn: ClientConn,
    onSelect?: (keys: string[], handled: boolean) => void,
    onSave?: () => void
  ) {
    const id = `blockEditor:${path}`;
    let tabName: string | React.ReactNode = getDisplayName(path.split('.').pop(), null);
    if ((tabName as string).startsWith('#')) {
      tabName = <LocalizedNodeName name={tabName as string} />;
    }
    return {
      id,
      closable: !onSave, // use the custom close button when onSave is not null
      title: <BlockStageTabButton conn={conn} id={id} path={path} title={tabName} onSave={onSave} />,
      group: 'blockStage',
      content: <BlockStagePane conn={conn} basePath={path} stageId={id} onSelect={onSelect} onSave={onSave} />,
    } as TabData;
  }

  private _rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this._rootNode = node;
  };

  private blockRevision = 0;
  blockListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      if (!Object.hasOwn(response.change ?? response.cache, 'value')) return;
      this.blockRevision += 1;
      // Keep the initial watch: closing a FlowEditor's last watch destroys it.
      if (this.blockRevision === 1 && response.cache.value) return;
      // Replacement blocks have the same serialized path, so each value update needs a fresh stage.
      this.safeSetState({blockKey: response.cache.value ? String(this.blockRevision) : null, selectedKeys: []});
    },
  });

  scopeListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      const {basePath} = this.props;
      const funcLib = getFuncLibPath(response.cache.value, basePath);
      if (funcLib !== this.state.funcLib) {
        this.safeSetState({funcLib});
      }
    },
  });

  constructor(props: Props) {
    super(props);
    const {conn, basePath} = props;
    this.blockListener.subscribe(conn, basePath);
    this.scopeListener.subscribe(conn, `${basePath}.#lib`, true);
  }

  onShowPropertyList = () => {
    const {showPropertyList} = this.state;
    this.setState({showPropertyList: !showPropertyList});
  };

  onSelect = (keys: string[]) => {
    const {onSelect, disablePropertyList} = this.props;
    const {showPropertyList, selectedKeys} = this.state;
    if (arrayEqual(keys, selectedKeys)) {
      return;
    }

    this.setState({selectedKeys: keys});

    // send selection to parent
    if (onSelect) {
      onSelect(keys, showPropertyList && !disablePropertyList);
    }
  };

  getDividerData = (idx: number) => {
    if (!this._rootNode) return null;
    const blockStage = this._rootNode.querySelector('.ticl-e-stage') as HTMLDivElement;
    const propertyList = this._rootNode.querySelector('.ticl-e-property-list') as HTMLDivElement;
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

  renderImpl() {
    const {conn, basePath, stageId, onSave, disablePropertyList} = this.props;
    const {showPropertyList, selectedKeys, sizes, blockKey, funcLib = basePath} = this.state;

    return (
      <div
        className="ticl-e-hbox ticl-e-stage-tab-content"
        ref={this.getRef}
        tabIndex={0}
        onPointerDownCapture={this.activate}
        onFocusCapture={this.activate}
      >
        {blockKey ? (
          <BlockStage
            ref={this.stage}
            key={blockKey}
            conn={conn}
            basePath={basePath}
            stageId={stageId}
            funcLib={funcLib}
            onSave={onSave}
            onSelect={this.onSelect}
            style={{width: sizes[0], height: '100%'}}
            toolButtons={
              !disablePropertyList && (
                <TooltipIconButton
                  conn={conn}
                  icon={showPropertyList ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={this.onShowPropertyList}
                  tooltip={showPropertyList ? t('Hide Properties') : t('Show Properties')}
                  tooltipPlacement="left"
                />
              )
            }
          />
        ) : (
          <div style={{width: sizes[0], height: '100%'}}>Invalid Input</div>
        )}

        <div className="ticl-e-stage-header">{basePath}</div>
        {showPropertyList && !disablePropertyList ? (
          <>
            <Divider key="divider" idx={1} getDividerData={this.getDividerData} changeSizes={this.changeSizes} />
            <PropertyList
              conn={conn}
              paths={selectedKeys}
              funcLib={funcLib}
              style={{width: sizes[1], height: '100%', padding: '8px'}}
            />
          </>
        ) : null}
      </div>
    );
  }
  componentWillUnmount() {
    this.blockListener.unsubscribe();
    this.scopeListener.unsubscribe();
    super.componentWillUnmount();
  }
}
