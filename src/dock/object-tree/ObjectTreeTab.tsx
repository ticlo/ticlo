import React from 'react';
import {Spin} from 'antd';
import {ClientConn} from '../../core/connect/ClientConn';
import {DataMap, isDataTruncated} from '../../core/util/DataTypes';
import {LazyUpdateComponent} from '../../react/component/LazyUpdateComponent';
import {ObjectTree} from '../../editor/object-tree/ObjectTree';
import {DockLayout} from 'rc-dock/lib';
import {mapPointsBetweenElement} from '../../react/util/Position';

interface Props {
  conn: ClientConn;
  path: string;
  val: any;
}

export class ObjectTreeTab extends LazyUpdateComponent<Props, any> {
  static dockGroup = {
    disableDock: true,
    maximizable: false
  };

  static openFloatPanel(
    layout: DockLayout,
    path: string,
    conn: ClientConn,
    val: any,
    fromElement: HTMLElement,
    source: any,
    offsetX = 0,
    offsetY = 0
  ) {
    let id = `objectTree-${path}`;
    let oldTab = layout.find(id);
    if (oldTab) {
      layout.dockMove(oldTab, null, 'remove');
    }

    let [x, y] = mapPointsBetweenElement(fromElement, layout._ref, offsetX, offsetY);

    let tabName = path.split('.').pop();
    let newPanel = {
      activeId: id,
      tabs: [
        {
          id,
          closable: true,
          title: tabName,
          group: 'objectTree',
          source,
          content: <ObjectTreeTab conn={conn} path={path} val={val} />
        }
      ],
      x,
      y,
      w: 200,
      h: 200
    };
    layout.dockMove(newPanel, null, 'float');
  }

  static closeFloatPanel(layout: DockLayout, path: string, source: any) {
    let id = `objectTree-${path}`;
    let tab = layout.find(id);
    if (tab && (tab as any).source === source) {
      layout.dockMove(tab, null, 'remove');
    }
  }

  renderImpl() {
    let {path, conn, val} = this.props;

    return <ObjectTree conn={conn} path={path} data={val} />;
  }
}
