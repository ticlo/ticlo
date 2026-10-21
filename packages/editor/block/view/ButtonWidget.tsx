import React from 'react';
import {Button} from 'antd';
import {PropDesc} from '@ticlo/core';
import {deepClone} from '@ticlo/core/util/Clone.ts';
import {BlockWidget, BlockWidgetProps} from './BlockWidget.ts';
import {LazyUpdateComponent, LazyUpdateSubscriber} from '../../component/LazyUpdateComponent.tsx';
import {EditPolicyContext} from '../../component/EditPolicyContext.tsx';

class ButtonView extends LazyUpdateComponent<BlockWidgetProps, any> {
  static contextType = EditPolicyContext;
  declare context: React.ContextType<typeof EditPolicyContext>;
  static readonly viewProperties: PropDesc[] = [
    {name: '@b-w-label', type: 'string'},
    {name: '@b-w-field', type: 'string'},
    {name: '@b-w-value', type: 'object'},
  ];

  label = new LazyUpdateSubscriber(this);
  field = new LazyUpdateSubscriber(this);
  value = new LazyUpdateSubscriber(this);

  constructor(props: BlockWidgetProps) {
    super(props);
    const {conn, path, updateViewHeight} = props;
    this.label.subscribe(conn, `${path}.@b-w-label`);
    this.field.subscribe(conn, `${path}.@b-w-field`);
    this.value.subscribe(conn, `${path}.@b-w-value`, true);
    // Two 24px field rows, including the button, padding and border.
    updateViewHeight(48);
  }

  get fieldName(): string {
    return typeof this.field.value === 'string' ? this.field.value : '';
  }

  canClick() {
    const {path} = this.props;
    const field = this.fieldName;
    return this.context.can(field ? {cmd: 'update', path: `${path}.${field}`} : {cmd: 'callFunction', path});
  }

  onClick = () => {
    if (!this.canClick()) return;
    const {conn, path} = this.props;
    const field = this.fieldName;
    if (field) {
      conn.updateValue(`${path}.${field}`, deepClone(this.value.value ?? {}), true);
    } else {
      conn.callFunction(path);
    }
  };

  renderImpl(): React.ReactNode {
    return (
      <div className="ticl-e-button-view">
        <Button block disabled={!this.canClick()} onClick={this.onClick}>
          {this.label.value ?? (this.fieldName || '#call')}
        </Button>
      </div>
    );
  }

  componentWillUnmount(): void {
    this.label.unsubscribe();
    this.field.unsubscribe();
    this.value.unsubscribe();
    super.componentWillUnmount();
  }
}

BlockWidget.register('button', ButtonView);
