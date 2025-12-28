import React from 'react';
import {ClientConn} from '@ticlo/core/editor.js';
import {Modal, Input} from 'antd';
import {DragState} from 'rc-dock';

export function onDragBlockOver(conn: ClientConn, e: DragState) {
  const blockData = DragState.getData('blockData', conn.getBaseConn());

  if (blockData && Object.hasOwn(blockData, '#is')) {
    e.accept('tico-fas-plus');
  }
}

type CreateBlockCallback = (name: string, data: {[key: string]: any}, shared: boolean) => void;

function alignXY(val: number) {
  return Math.floor((val - 12) / 24) * 24 + 12;
}

export function onDropBlock(conn: ClientConn, e: DragState, createBlock: CreateBlockCallback, bgElement: HTMLElement) {
  const blockData = DragState.getData('blockData', conn.getBaseConn());
  if (blockData && Object.hasOwn(blockData, '#is')) {
    const rect = bgElement.getBoundingClientRect();
    const scaleX = bgElement.offsetWidth / Math.round(rect.width);
    const scaleY = bgElement.offsetHeight / Math.round(rect.height);
    const offsetX = (e.clientX - rect.left) * scaleX;
    const offsetY = (e.clientY - rect.top) * scaleY;

    let blockName = DragState.getData('blockName', conn.getBaseConn()) || blockData['#is'];

    const onConfirmedBlockName = (name: string) => {
      let width = 143;
      let xyw = [alignXY(offsetX), alignXY(offsetY), width];
      if (Object.hasOwn(blockData, '@b-xyw')) {
        const dataXyw = blockData['@b-xyw'];
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
      const onInputChange = (change: React.ChangeEvent<HTMLInputElement>) => {
        blockName = change.target.value;
      };
      const onEnter = () => {
        if (blockName) {
          Modal.destroyAll();
          onConfirmedBlockName(blockName);
        }
      };
      const onGetRef = (ref: {select: () => void}) => {
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
