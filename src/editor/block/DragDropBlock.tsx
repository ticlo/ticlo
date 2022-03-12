import React from 'react';
import {ClientConn} from '../../../src/core/editor';
import {Modal, Input} from 'antd';
import {DragState} from 'rc-dock';

export function onDragBlockOver(conn: ClientConn, e: DragState) {
  let blockData = DragState.getData('blockData', conn.getBaseConn());

  if (blockData && blockData.hasOwnProperty('#is')) {
    e.accept('tico-fas-plus');
  }
}

type CreateBlockCallback = (name: string, data: {[key: string]: any}, shared: boolean) => void;

function alignXY(val: number) {
  return Math.floor((val - 12) / 24) * 24 + 12;
}

export function onDropBlock(conn: ClientConn, e: DragState, createBlock: CreateBlockCallback, bgElement: HTMLElement) {
  let blockData = DragState.getData('blockData', conn.getBaseConn());
  if (blockData && blockData.hasOwnProperty('#is')) {
    let rect = bgElement.getBoundingClientRect();
    let scaleX = bgElement.offsetWidth / Math.round(rect.width);
    let scaleY = bgElement.offsetHeight / Math.round(rect.height);
    let offsetX = (e.clientX - rect.left) * scaleX;
    let offsetY = (e.clientY - rect.top) * scaleY;

    let blockName = DragState.getData('blockName', conn.getBaseConn()) || blockData['#is'];

    let onConfirmedBlockName = (name: string) => {
      let width = 143;
      let xyw = [alignXY(offsetX), alignXY(offsetY), width];
      if (blockData.hasOwnProperty('@b-xyw')) {
        let dataXyw = blockData['@b-xyw'];
        if (Array.isArray(dataXyw)) {
          width = dataXyw[2];
          if (width > 80 && width < 9999) {
            xyw = [offsetX - 12, offsetY - 12, width];
          }
        }
      }
      blockData['@b-xyw'] = xyw;
      createBlock(name, blockData, e.event.altKey);
    };
    if (blockName.includes('.')) {
      blockName = blockName.split('.').pop();
    }
    if (blockName === '' || e.event.shiftKey) {
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
      let onGetRef = (ref: any) => {
        if (ref) {
          ref.select();
        }
      };
      Modal.confirm({
        title: 'Block Name',
        content: (
          <Input
            defaultValue={blockName}
            autoFocus={true}
            onChange={onInputChange}
            onPressEnter={onEnter}
            ref={onGetRef}
          />
        ),
        icon: <span />, // hide icon
        autoFocusButton: null,
        centered: true,
        onOk() {
          if (blockName) {
            onConfirmedBlockName(blockName);
          }
        },
      });
    } else {
      onConfirmedBlockName(blockName);
    }
  }
}
