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

export class WorkerEditor extends FunctionEditor {
  static contextType = TicloLayoutContextType;
  declare context: TicloLayoutContext;

  static filterWorkerFunction(desc: FunctionDesc) {
    return desc.src === 'worker';
  }

  canEditWorker(policy?: EditPolicyView) {
    const {conn, keys, desc, value, onChange, locked} = this.props;
    return (
      value != null &&
      onChange != null &&
      !locked &&
      keys?.length > 0 &&
      (policy ?? conn.getEditPolicyView()).can({cmd: 'editWorker', path: `${keys[0]}.#edit-${desc.name}`})
    );
  }

  editWorker = () => {
    if (!this.canEditWorker()) return;
    const {conn, keys, desc} = this.props;
    const flowEditorPath = `${keys[0]}.#edit-${desc.name}`;
    conn.editWorker(flowEditorPath, desc.name);
    this.context.editFlow(flowEditorPath, () => {
      conn.applyFlowChange(flowEditorPath);
    });
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
    const {desc, locked, conn, funcLib} = this.props;
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
      <DragDropDiv className="ticl-worker-editor ticl-hbox" onDragOverT={this.onDragOver} onDropT={this.onDrop}>
        <div className="ticl-object-editor" style={{flexGrow: 1}}>
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
              funcLib={funcLib}
            />
          }
        >
          <Button
            className="ticl-square-icon-btn"
            size="small"
            disabled={onChange == null}
            icon={<DownOutlined />}
            onClick={this.openPopup}
          />
        </Popup>
        <EditPolicyContext.Consumer>
          {(policy) => (
            <Button
              className="ticl-square-icon-btn"
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
