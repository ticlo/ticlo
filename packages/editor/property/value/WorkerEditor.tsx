import React from 'react';
import {Button} from 'antd';
import {DownOutlined, EditOutlined} from '@ant-design/icons';

import {DragDropDiv, DragState} from 'rc-dock';
import {FunctionSelect} from '../../function-selector/FunctionSelect.tsx';
import {Popup} from '../../component/ClickPopup.tsx';
import {FunctionEditor} from './FunctionEditor.tsx';
import {FunctionDesc, type EditPolicyView} from '@ticlo/core';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext.ts';
import {t} from '../../component/LocalizedLabel.tsx';
import {defaultWorkerData} from '@ticlo/core/defaults/DefaultFlows.ts';
import {EditPolicyContext} from '../../component/EditPolicyContext.tsx';
import {requestCallbacks} from '../../util/RequestCallbacks.ts';

export class WorkerEditor extends FunctionEditor {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  static filterWorkerFunction(desc: FunctionDesc) {
    return desc.src === 'worker';
  }

  canEditWorker(policy?: EditPolicyView) {
    const {conn, keys, desc, name, inline, value, onChange, locked, onEditWorker} = this.props;
    return (
      value != null &&
      onChange != null &&
      !locked &&
      (!inline || this.context?.editFlow != null) &&
      (onEditWorker ||
        (keys?.length > 0 &&
          (policy ?? conn.getEditPolicyView()).can({
            cmd: 'editWorker',
            path: `${keys[0]}.#edit-${inline ? name : desc.name}`,
          })))
    );
  }

  editWorker = () => {
    if (!this.canEditWorker()) return;
    if (this.props.onEditWorker) {
      this.props.onEditWorker();
      return;
    }
    const {conn, keys, desc, name, inline, funcModule} = this.props;
    const fromField = inline ? name : desc.name;
    const path = `${keys[0]}.#edit-${fromField}`;
    const open = () =>
      this.context.editFlow?.(path, () => {
        conn.simpleRequest({cmd: 'applyFlowChange', path, unbound: inline}, requestCallbacks);
      });
    if (inline) {
      void conn
        .simpleRequest({cmd: 'editWorker', path, fromField, funcModule, unbound: true})
        .then(open, requestCallbacks.onError);
    } else {
      conn.editWorker(path, fromField);
      open();
    }
  };

  onFunctionClick = (name: string, desc: FunctionDesc) => {
    if (desc.id === '{}') {
      const {onChange, name} = this.props;
      this._pendingValue = null;
      onChange?.(defaultWorkerData, name);
    } else {
      this.commitChange(desc.id);
    }

    this.setState({opened: false});
  };

  render() {
    const {desc, locked, conn, funcModule} = this.props;
    let {value, onChange} = this.props;
    const {opened} = this.state;

    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked) {
      onChange = null;
    }

    let label: string | React.ReactNode;
    if (typeof value === 'string') {
      label = value;
    } else if (value && value.constructor === Object) {
      label = t('Inline');
    }

    return (
      <DragDropDiv className="ticl-e-worker-editor ticl-e-hbox" onDragOverT={this.onDragOver} onDropT={this.onDrop}>
        <div className="ticl-e-object-editor" style={{flexGrow: 1}}>
          {label}
        </div>
        <Popup
          popupVisible={opened && onChange != null}
          onPopupVisibleChange={this.onPopupClose}
          popup={
            <FunctionSelect
              useFlow={true}
              conn={conn}
              onFunctionClick={this.onFunctionClick}
              filter={WorkerEditor.filterWorkerFunction}
              currentValue={value}
              funcModule={funcModule}
            />
          }
        >
          <Button
            className="ticl-e-square-icon-btn"
            size="small"
            disabled={onChange == null}
            icon={<DownOutlined />}
            onClick={this.openPopup}
          />
        </Popup>
        <EditPolicyContext.Consumer>
          {(policy) => (
            <Button
              className="ticl-e-square-icon-btn"
              disabled={!this.canEditWorker(policy)}
              size="small"
              icon={<EditOutlined />}
              onClick={this.editWorker}
            />
          )}
        </EditPolicyContext.Consumer>
      </DragDropDiv>
    );
  }
}
