import React from 'react';
import {Button, Input} from 'antd';
import DownIcon from '@ant-design/icons/DownOutlined';
import EditIcon from '@ant-design/icons/EditOutlined';
import {DragDropDiv, DragState} from 'rc-dock';
import {FunctionSelect} from '../../function-selector/FunctionSelector';
import {Popup} from '../../component/ClickPopup';
import {FunctionEditor} from './FunctionEditor';
import {FunctionDesc} from '../../../../src/core/editor';
import {TicloLayoutContext, TicloLayoutContextType} from '../../component/LayoutContext';

export class WorkerEditor extends FunctionEditor {
  static contextType = TicloLayoutContextType;
  context!: TicloLayoutContext;

  static filterWorkerFunction(desc: FunctionDesc) {
    return desc.src === 'worker';
  }

  editWorker = () => {
    let {conn, keys, desc} = this.props;
    if (keys.length) {
      let flowEditorPath = `${keys[0]}.#edit-${desc.name}`;
      conn.editWorker(flowEditorPath, desc.name);
      this.context.editFlow(flowEditorPath, () => {
        conn.applyFlowChange(flowEditorPath);
      });
    }
  };

  render() {
    let {desc, value, locked, onChange, conn} = this.props;
    let {opened} = this.state;

    if (this._pendingValue != null) {
      value = this._pendingValue;
    } else if (locked) {
      onChange = null;
    }

    let label: string;
    if (typeof value === 'string') {
      label = value;
    } else if (value && value.constructor === Object) {
      label = '{}';
    }

    return (
      <DragDropDiv className="ticl-worker-editor ticl-hbox" onDragOverT={this.onDragOver} onDropT={this.onDrop}>
        <Input value={value} disabled={true} size="small" />
        <Popup
          popupVisible={opened}
          onPopupVisibleChange={this.onPopupClose}
          popup={
            <FunctionSelect
              conn={conn}
              onFunctionClick={this.onFunctionClick}
              filter={WorkerEditor.filterWorkerFunction}
            />
          }
        >
          <Button className="ticl-square-icon-btn" size="small" icon={<DownIcon />} onClick={this.openPopup} />
        </Popup>
        <Button className="ticl-square-icon-btn" size="small" icon={<EditIcon />} onClick={this.editWorker} />
      </DragDropDiv>
    );
  }
}
