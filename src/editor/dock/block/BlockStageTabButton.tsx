import React from 'react';
import {Button} from 'antd';
import SaveIcon from '@ant-design/icons/SaveOutlined';
import CloseIcon from '@ant-design/icons/CloseOutlined';
import {DockContext, DockContextType} from 'rc-dock/lib';
import {LazyUpdateComponent} from '../../component/LazyUpdateComponent';
import {ClientConn, ValueSubscriber, ValueUpdate} from '../../../../src/core/editor';

interface Props {
  conn: ClientConn;
  title: string;
  id: string;
  path: string;
  onSave: () => void;
}

interface State {
  hasChange: boolean;
}

export class BlockStageTabButton extends LazyUpdateComponent<Props, State> {
  static contextType = DockContextType;
  context!: DockContext;

  state: State = {hasChange: false};
  constructor(props: Props) {
    super(props);
    let {conn, path, onSave} = props;
    if (onSave) {
      this.hasChangeListener.subscribe(conn, `${path}.@has-change`);
    }
  }

  hasChangeListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      this.safeSetState({hasChange: Boolean(response.cache.value)});
    }
  });

  componentWillUnmount(): void {
    let {conn, path} = this.props;
    this.hasChangeListener.unsubscribe();
    super.componentWillUnmount();
  }

  onClose = () => {
    const {id} = this.props;
    this.context.dockMove(this.context.find(id), null, 'remove');
  };
  onSave = () => {
    const {onSave} = this.props;
    onSave?.();
  };

  renderImpl() {
    const {title, conn, onSave} = this.props;
    const {hasChange} = this.state;
    let closeButtun: React.ReactElement;
    if (onSave && hasChange) {
      closeButtun = (
        <div className="ticl-stage-panel-save">
          <Button className="ticl-icon-btn" shape="circle" icon={<SaveIcon />} onClick={this.onSave} />
          <Button className="ticl-icon-btn" shape="circle" icon={<CloseIcon />} onClick={this.onClose} />
        </div>
      );
    } else {
      closeButtun = <div className="dock-tab-close-btn" onClick={this.onClose} />;
    }
    return (
      <span className="ticl-stage-panel-tab">
        {title}
        {closeButtun}
      </span>
    );
  }
}
