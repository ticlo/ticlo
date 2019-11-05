import React from 'react';
import {Spin} from 'antd';
import {ClientConn} from '../../core/connect/ClientConn';
import {DataMap, isDataTruncated} from '../../core/util/DataTypes';
import {LazyUpdateComponent} from '../../ui/component/LazyUpdateComponent';
import {ObjectTree} from './ObjectTree';

interface Props {
  conn: ClientConn;
  path: string;
  val: any;
}

export class ObjectTreePanel extends LazyUpdateComponent<Props, any> {
  static createDockTab(path: string, conn: ClientConn, val: any, fromElement: HTMLElement, offset: [number, number]) {
    let id = `objectTree-${path}`;
    let tabName = path.split('.').pop();
    return {
      id,
      closable: true,
      title: tabName,
      group: 'objectTree',
      cacjed: true,
      content: <ObjectTreePanel conn={conn} path={path} val={val} />
    };
  }

  renderImpl() {
    let {path, conn, val} = this.props;

    return <ObjectTree conn={conn} path={path} data={val} />;
  }
}
