import React from "react";
import {ClientConnection, ValueUpdate} from "../../core/connect/ClientConnection";
import {configDescs, FunctionDesc, PropDesc, PropGroupDesc} from "../../core/block/Descriptor";
import {MultiSelectComponent, MultiSelectLoader} from "./MultiSelectComponent";
import {PropertyList} from "./PropertyList";
import {PropertyEditor} from "./PropertyEditor";

class LengthPropertyEditor extends PropertyEditor {
  onChange = (value: any) => {
    let {conn, keys, name, propDesc} = this.props;
    if (value === propDesc.default) {
      value = undefined;
    }
    for (let key of keys) {
      conn.setLen(`${key}.${name}`, value);
    }
  };
}

class GroupLoader extends MultiSelectLoader<GroupEditor> {

  lenKey: string;

  len: number = 0;
  lenListener = {
    onUpdate: (response: ValueUpdate) => {
      let len = parseInt(response.cache.value);
      if (!(len >= 0)) {
        len = this.parent.props.groupDesc.defaultLen;
      }
      if (len !== this.len) {
        this.len = len;
        this.parent.forceUpdate();
      }
    }
  };

  constructor(key: string, parent: GroupEditor) {
    super(key, parent);
    this.lenKey = `${key}.${parent.props.groupDesc.name}#len`;
  }

  init() {
    this.conn.subscribe(this.lenKey, this.lenListener, true);
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
  isMore?: boolean;
}

interface State {
  length: number;
}


export class GroupEditor extends MultiSelectComponent<Props, State, GroupLoader> {
  constructor(props: Readonly<Props>) {
    super(props);
    this.updateLoaders(props.keys);
  }

  createLoader(key: string) {
    return new GroupLoader(key, this);
  }

  renderImpl(): React.ReactNode {
    let {conn, keys, funcDesc, groupDesc, isMore} = this.props;
    let children: React.ReactNode[] = [];
    let {name: groupName} = groupDesc;

    let lenName = `${groupName}#len`;
    let lenDesc = {...configDescs['#len'], default: groupDesc.defaultLen, name: lenName};

    if (this.loaders.size) {
      let minLen = Infinity;
      for (let [key, loader] of this.loaders) {
        if (loader.len < minLen) minLen = loader.len;
      }
      for (let i = 0; i < minLen; ++i) {
        for (let desc of groupDesc.properties) {
          let name = `${desc.name}${i}`;
          children.push(
            <PropertyEditor key={name} name={name} keys={keys} conn={conn} isMore={isMore}
                            group={groupName} groupName={desc.name}
                            funcDesc={funcDesc} propDesc={desc}/>
          );
        }
      }
    }

    return (
      <div className='ticl-property-group'>
        <LengthPropertyEditor key={groupName} name={lenName} keys={keys} conn={conn} isMore={isMore} group={groupName}
                              funcDesc={funcDesc} propDesc={lenDesc}/>
        {children}
      </div>
    );
  }
}
