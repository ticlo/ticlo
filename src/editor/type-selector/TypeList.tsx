import React from 'react';
import {ClientConn} from '../../core/client';
import {TypeView} from './TypeView';

let _lastType: string;
let _typeSet: Set<string> = new Set<string>();
let _recentTypeList: string[] = [];
let _recentTypeListener: Set<TypeList> = new Set<TypeList>();

export function addRecentType(type: string) {
  if (type === _lastType) {
    return;
  }
  _lastType = type;

  let types = _typeSet;
  types.delete(type);
  types.add(type);
  if (types.size > 32) {
    for (let type of types) {
      types.delete(type);
      if (types.size <= 32) {
        break;
      }
    }
  }
  _recentTypeList = Array.from(types.keys()).reverse();
  for (let instance of _recentTypeListener) {
    instance.forceUpdate();
  }
}

interface Props {
  conn: ClientConn;
  recent?: boolean;
  types?: string[];
  style?: React.CSSProperties;
}

export class TypeList extends React.PureComponent<Props, any> {
  constructor(props: Props) {
    super(props);
    if (props.recent) {
      this.state = {types: _recentTypeList};
    } else {
      this.state = {};
    }
  }

  render() {
    let {conn, recent, types, style} = this.props;
    if (recent) {
      types = _recentTypeList;
    }
    let children: React.ReactNode[] = [];
    for (let type of types) {
      let desc = conn.watchDesc(type);
      if (desc) {
        children.push(<TypeView key={type} conn={conn} desc={desc} />);
      }
    }
    return (
      <div className="ticl-type-list" style={style}>
        {children}
      </div>
    );
  }

  componentDidMount(): void {
    if (this.props.recent) {
      _recentTypeListener.add(this);
    }
  }

  componentWillUnmount(): void {
    if (this.props.recent) {
      _recentTypeListener.delete(this);
    }
  }
}
