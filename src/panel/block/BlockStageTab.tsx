import React from 'react';
import {Button} from 'antd';
import {DockContext, DockContextType} from 'rc-dock/lib';
import {LazyUpdateComponent} from '../../ui/component/LazyUpdateComponent';
import {TrackedClientConn} from '../../core/connect/TrackedClientConn';
import {Dispatcher} from '../../core/block/Dispatcher';

interface Props {
  conn: TrackedClientConn;
  title: string;
  id: string;
  onSave: () => void;
}

interface State {}

export class BlockStageTab extends LazyUpdateComponent<Props, State> {
  static contextType = DockContextType;
  context!: DockContext;

  constructor(props: Props) {
    super(props);
    props.conn.changed.listen(this);
  }

  onChange(val: boolean) {
    if (this._mounted) {
      this.forceUpdate();
    }
  }

  onSourceChange(source: any): void {}

  componentWillUnmount(): void {
    let {conn} = this.props;
    conn.changed.unlisten(this);
    super.componentWillUnmount();
  }

  onClose = () => {
    const {id} = this.props;
    this.context.dockMove(this.context.find(id), null, 'remove');
  };
  onSave = () => {
    const {conn, onSave} = this.props;
    onSave();
    conn.acknowledge();
  };

  renderImpl() {
    const {title, conn, onSave} = this.props;
    let closeButtun: React.ReactElement;
    if (onSave && conn.isChanged()) {
      closeButtun = (
        <div className="ticl-stage-panel-save">
          <Button className="ticl-icon-btn" shape="circle" icon="save" onClick={this.onSave} />
          <Button className="ticl-icon-btn" shape="circle" icon="close" onClick={this.onClose} />
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
