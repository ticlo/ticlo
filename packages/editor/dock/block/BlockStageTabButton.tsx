import React from 'react';
import {Button} from 'antd';
import {CloseOutlined, SaveOutlined} from '@ant-design/icons';

import {DockContext, DockContextType} from 'rc-dock';
import {LazyUpdateComponent} from '../../component/LazyUpdateComponent.js';
import {ClientConn, ValueSubscriber, ValueUpdate} from '@ticlo/core/editor.js';
import {TabData} from 'rc-dock/src/DockData.js';
import {TicloCurrentFlowContext} from '../../component/LayoutContext.js';

interface Props {
  conn: ClientConn;
  title: React.ReactNode;
  id: string;
  path: string;
  onSave: () => void;
}

interface State {
  hasChange: boolean;
}

export class BlockStageTabButton extends LazyUpdateComponent<Props, State> {
  static contextType = DockContextType;
  declare context: DockContext;

  state: State = {hasChange: false};
  constructor(props: Props) {
    super(props);
    const {conn, path, onSave} = props;
    if (onSave) {
      this.hasChangeListener.subscribe(conn, `${path}.@has-change`);
    }
  }

  hasChangeListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      this.safeSetState({hasChange: Boolean(response.cache.value)});
    },
  });

  componentWillUnmount(): void {
    const {conn, path} = this.props;
    this.hasChangeListener.unsubscribe();
    super.componentWillUnmount();
  }

  onClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    const {id} = this.props;
    this.context.dockMove(this.context.find(id) as TabData, null, 'remove');
  };
  onSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    const {onSave} = this.props;
    onSave?.();
  };

  renderImpl() {
    const {title, onSave} = this.props;
    const {hasChange} = this.state;
    let closeButtun: React.ReactElement;
    if (onSave && hasChange) {
      closeButtun = (
        <div className="ticl-stage-panel-save">
          <Button className="ticl-icon-btn" shape="circle" icon={<SaveOutlined />} onClick={this.onSave} />
          <Button className="ticl-icon-btn" shape="circle" icon={<CloseOutlined />} onClick={this.onClose} />
        </div>
      );
    } else {
      closeButtun = <div className="dock-tab-close-btn" onClick={this.onClose} />;
    }
    return (
      <TicloCurrentFlowContext.Consumer>
        {(currentFlow) => (
          <span
            className={`ticl-stage-panel-tab${currentFlow.currentPath === this.props.path ? ' ticl-stage-panel-tab-focused' : ''}`}
            onClick={() => currentFlow.onFlowFocus(this.props.path)}
          >
            <span className="ticl-stage-panel-tab-title">{title}</span>
            {closeButtun}
          </span>
        )}
      </TicloCurrentFlowContext.Consumer>
    );
  }
}
