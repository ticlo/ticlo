import React from 'react';
import {ClientConn, PropDesc, PropGroupDesc} from '../../../../src/core/editor';

export interface BlockWidgetProps {
  conn: ClientConn;
  path: string;

  // directly notify the model about the height of the special view
  updateViewHeight(h: number): void;
}

type BlockWidgetType = (new (props: any) => React.Component<BlockWidgetProps>) & {
  viewProperties: (PropDesc | PropGroupDesc)[];
};

export class BlockWidget {
  static widgetDesc: PropDesc = {
    name: '@b-widget',
    type: 'select',
    options: ['none'],
    default: 'none',
  };
  static _widgets = new Map<string, BlockWidgetType>();
  static register(name: string, component: BlockWidgetType) {
    if (!BlockWidget.widgetDesc.options.includes(name)) {
      BlockWidget.widgetDesc.options = [...BlockWidget.widgetDesc.options, name];
    }
    BlockWidget._widgets.set(name, component);
  }
  static get(name: string) {
    return BlockWidget._widgets.get(name);
  }
}
