import React from "react";
import {ClientConnection} from "../../common/connect/ClientConnection";
import {DragStore} from "../../ui/util/DragStore";
import {Modal, Input, Icon} from "antd";


export function onDragBlockOver(conn: ClientConnection, event: React.DragEvent) {
  let blockData = DragStore.getData(conn, 'block');

  if (blockData && blockData.hasOwnProperty('#is')) {
    event.dataTransfer.dropEffect = 'link';
    event.preventDefault();
    event.stopPropagation();
  } else {
    event.dataTransfer.dropEffect = 'none';
  }
}

type CreateBlockCallback = (name: string, data: {[key: string]: any}) => void;

export function onDropBlock(conn: ClientConnection, event: React.DragEvent, createBlock: CreateBlockCallback) {
  let blockData = DragStore.getData(conn, 'block');
  if (blockData && blockData.hasOwnProperty('#is')) {
    let {offsetX, offsetY} = event.nativeEvent;

    let blockName = DragStore.getData(conn, 'name');
    if (blockName == null && event.ctrlKey) {
      // drop with ctrl to use default name
      blockName = blockData['#is'];
    }

    let onConfirmedBlockName = (name: string) => {
      let width = 150;
      let xyw = [offsetX - 12, offsetY - 12, width];
      if (blockData.hasOwnProperty('@b-xyw')) {
        let dataXyw = blockData['@b-xyw'];
        if (Array.isArray(xyw)) {
          if (dataXyw.length >= 3 && dataXyw[2] > 80 && dataXyw[2] < 9999) {
            xyw = [offsetX - 12, offsetY - 12, width];
          } else {
            xyw = [offsetX - 12, offsetY - 12];
          }
        }
      }
      blockData['@b-xyw'] = xyw;
      createBlock(name, blockData);
    };

    if (blockName == null || event.shiftKey) {
      // drop with shift to force change name
      blockName = blockName || blockData['#is'];
      let onInputChange = (change: React.ChangeEvent<HTMLInputElement>) => {
        blockName = change.target.value;
      };
      let onEnter = () => {
        if (blockName) {
          Modal.destroyAll();
          onConfirmedBlockName(blockName);
        }
      };
      let onGetRef = (ref: Input) => {
        if (ref) {
          ref.select();
        }
      };
      Modal.confirm({
        title: "Block Name",
        content: (
          <Input defaultValue={blockName} autoFocus={true} onChange={onInputChange} onPressEnter={onEnter}
                 ref={onGetRef}
          />
        ),
        icon: <span/>, // hide icon
        autoFocusButton: null,
        centered: true,
        onOk() {
          if (blockName) {
            onConfirmedBlockName(blockName);
          }
        }
      });
    } else {
      onConfirmedBlockName(blockName);
    }

  }
}
