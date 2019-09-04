import React from "react";
import {Button, Icon, Input} from "antd";
import {DragDropDiv, DragState} from "rc-dock";
import {TypeSelect} from "../../type-selector/TypeSelector";
import {Popup} from "../../component/ClickPopup";
import {TypeEditor} from "./TypeEditor";
import {FunctionDesc} from "../../../core/block/Descriptor";

export class WorkerEditor extends TypeEditor {

  static filterWorkerFunction(desc: FunctionDesc) {
    return desc.src === 'worker';
  }

  editWorker = () => {
    let {conn, keys, desc} = this.props;
    if (keys.length) {
      conn.editJob(`${keys[0]}.#edit-${desc.name}`, desc.name);
      // TODO send event to context
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
      <DragDropDiv className='ticl-worker-editor ticl-hbox' onDragOverT={this.onDragOver} onDropT={this.onDrop}>
        <Input value={value} disabled={true} size='small'/>
        <Popup popupVisible={opened}
               onPopupVisibleChange={this.onPopupClose}
               popup={
                 <TypeSelect conn={conn} onTypeClick={this.onTypeClick} filter={WorkerEditor.filterWorkerFunction}/>
               }>
          <Button className='ticl-prop-editor-btn' size='small' shape="circle" icon="down" onClick={this.openPopup}/>
        </Popup>
        <Button className='ticl-prop-editor-btn' size='small' shape="circle" icon="edit" onClick={this.editWorker}/>
      </DragDropDiv>
    );
  }
}
