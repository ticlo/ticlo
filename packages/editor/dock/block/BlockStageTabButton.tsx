import React, {useContext} from 'react';
import {Button, Popover} from 'antd';
import {CloseOutlined, SaveOutlined} from '@ant-design/icons';

import {DockContext, DockContextType} from 'rc-dock';
import {LazyUpdateComponent} from '../../component/LazyUpdateComponent.tsx';
import {ClientConn, ValueSubscriber, ValueUpdate, getDisplayName} from '@ticlo/core/editor.ts';
import {flowRefFromPath} from '@ticlo/core/block/FlowRuntime.ts';
import {TabData} from 'rc-dock';
import {TicloCurrentFlowContext, TicloDefaultLibraryContext} from '../../component/LayoutContext.ts';
import {EditPolicyContext} from '../../component/EditPolicyContext.tsx';
import {LocalizedNodeName} from '../../component/LocalizedLabel.tsx';

interface Props {
  conn: ClientConn;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  id: string;
  path: string;
  onSave?: () => void;
}

interface State {
  hasChange: boolean;
}

function tabPopoverPath(path: string, defaultLibrary: string): string | undefined {
  if (!path || (path.startsWith('+') && !path.includes('.'))) return undefined;
  const {library, kind, name} = flowRefFromPath(path);
  if (library !== defaultLibrary) return library === '#root' ? `#root / ${path}` : path;
  if (name.includes('.')) return kind === 'module' ? `:${name}` : name;
}

const StageTabTitle = React.memo(function StageTabTitle({path, title, icon}: Pick<Props, 'path' | 'title' | 'icon'>) {
  const library = useContext(TicloDefaultLibraryContext);
  const fullPath = tabPopoverPath(path, library);
  const name = getDisplayName(path.slice(path.lastIndexOf('.') + 1), null);
  const label = (
    <span className="ticl-e-stage-panel-tab-title">
      {icon}
      {title ?? (name.startsWith('#') ? <LocalizedNodeName name={name} /> : name)}
    </span>
  );
  return fullPath ? (
    <Popover content={fullPath} placement="bottom">
      {label}
    </Popover>
  ) : (
    label
  );
});

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
    if (this.props.conn.getEditPolicyView().can({cmd: 'applyFlowChange', path: this.props.path}) === false) return;
    onSave?.();
  };

  renderImpl() {
    const {path, title, icon, onSave} = this.props;
    const {hasChange} = this.state;
    let closeButtun: React.ReactElement;
    if (onSave && hasChange) {
      closeButtun = (
        <div className="ticl-e-stage-panel-save">
          <EditPolicyContext.Consumer>
            {(policy) => (
              <Button
                className="ticl-e-icon-btn"
                shape="circle"
                icon={<SaveOutlined />}
                onClick={this.onSave}
                disabled={!policy.can({cmd: 'applyFlowChange', path: this.props.path})}
              />
            )}
          </EditPolicyContext.Consumer>
          <Button className="ticl-e-icon-btn" shape="circle" icon={<CloseOutlined />} onClick={this.onClose} />
        </div>
      );
    } else {
      closeButtun = (
        <div className="dock-tab-close-btn" onClick={this.onClose}>
          <span className="dock-icon dock-icon-close" />
        </div>
      );
    }
    return (
      <TicloCurrentFlowContext.Consumer>
        {(currentFlow) => (
          <span
            className={`ticl-e-stage-panel-tab${currentFlow.activeStage?.id === this.props.id ? ' ticl-e-stage-panel-tab-focused' : ''}`}
            onClick={() => currentFlow.activateStage(this.props.id)}
          >
            <StageTabTitle path={path} title={title} icon={icon} />
            {onSave && closeButtun}
          </span>
        )}
      </TicloCurrentFlowContext.Consumer>
    );
  }
}
