import React from "react";
import {ClientConnection, ValueUpdate} from "../../common/connect/ClientConnection";
import {FunctionDesc, PropDesc, PropGroupDesc} from "../../common/block/Descriptor";
import {MultiSelectComponent, MultiSelectLoader} from "./MultiSelectComponent";
import {PropertyList} from "./PropertyList";

class GroupLoader extends MultiSelectLoader<GroupEditor> {

  lenKey: string;

  len: number = -1;
  lenListener = {
    onUpdate: (response: ValueUpdate) => {
      let len = parseInt(response.cache.value);
      if (len !== len) len = 2; // default length
      if (len !== this.len) {
        this.len = len;
        this.parent.forceUpdate();
      }
    }
  };

  constructor(key: string, parent: GroupEditor) {
    super(key, parent);
    this.lenKey = `${key}.${parent.props.groupDesc.group}#len`;
    this.conn.subscribe(this.lenKey, this.lenListener);
  }

  destroy() {
    this.conn.unsubscribe(this.lenKey, this.lenListener);
  }
}

interface Props {
  conn: ClientConnection;
  keys: string[];
  funcDesc: FunctionDesc;
  groupDesc: PropGroupDesc;
}

interface State {
  length: number;
}


export class GroupEditor extends MultiSelectComponent<Props, State, GroupLoader> {
  constructor(props: Readonly<Props>) {
    super(props);
    this.updateLoaders(props.keys, GroupLoader);
  }

  render(): React.ReactNode {
    let {conn, keys} = this.props;
    this.updateLoaders(keys, GroupLoader);
    return undefined;
  }
}
