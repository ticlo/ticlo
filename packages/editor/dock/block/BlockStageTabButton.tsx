import React from 'react';
import {Icon, Button} from '@blueprintjs/core';
import {DockContext, DockContextType} from 'rc-dock';
import {LazyUpdateComponent} from '../../component/LazyUpdateComponent';
import {ClientConn, ValueSubscriber, ValueUpdate} from '@ticlo/core/editor';
import {TabData} from 'rc-dock/src/DockData';

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
    let {conn, path, onSave} = props;
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
    let {conn, path} = this.props;
    this.hasChangeListener.unsubscribe();
    super.componentWillUnmount();
  }

  onClose = () => {
    const {id} = this.props;
    this.context.dockMove(this.context.find(id) as TabData, null, 'remove');
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
          <Button size="small" className="ticl-icon-btn" variant="minimal" icon="floppy-disk" onClick={this.onSave} />
          <Button size="small" className="ticl-icon-btn" variant="minimal" icon="cross" onClick={this.onClose} />
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
