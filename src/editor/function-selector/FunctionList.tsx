import React from 'react';
import {ClientConn} from '../../../src/core/editor';
import {FunctionView} from './FunctionView';

let _lastFunction: string;
let _typeSet: Set<string> = new Set<string>();
let _recentFunctionList: string[] = [];
let _recentFunctionListener: Set<FunctionList> = new Set<FunctionList>();

export function addRecentFunction(type: string) {
  if (type === _lastFunction) {
    return;
  }
  _lastFunction = type;

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
  _recentFunctionList = Array.from(types.keys()).reverse();
  for (let instance of _recentFunctionListener) {
    instance.forceUpdate();
  }
}

interface Props {
  conn: ClientConn;
  recent?: boolean;
  types?: string[];
  style?: React.CSSProperties;
}

export class FunctionList extends React.PureComponent<Props, any> {
  constructor(props: Props) {
    super(props);
    if (props.recent) {
      this.state = {types: _recentFunctionList};
    } else {
      this.state = {};
    }
  }

  render() {
    let {conn, recent, types, style} = this.props;
    if (recent) {
      types = _recentFunctionList;
    }
    let children: React.ReactNode[] = [];
    for (let type of types) {
      let desc = conn.watchDesc(type);
      if (desc) {
        children.push(<FunctionView key={type} conn={conn} desc={desc} />);
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
      _recentFunctionListener.add(this);
    }
  }

  componentWillUnmount(): void {
    if (this.props.recent) {
      _recentFunctionListener.delete(this);
    }
  }
}
