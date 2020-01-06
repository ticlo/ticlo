import React from 'react';
import {ClientConn, ValueUpdate} from '../../../src/core/editor';
import {configDescs, FunctionDesc, PropDesc, PropGroupDesc} from '../../../src/core/editor';
import {MultiSelectComponent, MultiSelectLoader} from './MultiSelectComponent';
import {PropertyList} from './PropertyList';
import {PropertyEditor} from './PropertyEditor';

class LengthPropertyEditor extends PropertyEditor {
  onChange = (value: any) => {
    let {conn, paths, name, propDesc} = this.props;
    if (name.endsWith('#len')) {
      let group = name.substring(0, name.length - 4);
      if (value === propDesc.default) {
        value = undefined;
      }
      for (let key of paths) {
        conn.setLen(key, group, value);
      }
    }
  };
}

class GroupLoader extends MultiSelectLoader<GroupEditor> {
  lenKey: string;

  len: number = -1;
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
  conn: ClientConn;
  paths: string[];
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
    this.updateLoaders(props.paths);
  }

  createLoader(key: string) {
    return new GroupLoader(key, this);
  }

  renderImpl(): React.ReactNode {
    let {conn, paths, funcDesc, groupDesc, isMore} = this.props;
    let children: React.ReactNode[] = [];
    let {name: group} = groupDesc;

    let lenName = `${group}#len`;
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
            <PropertyEditor
              key={name}
              name={name}
              paths={paths}
              conn={conn}
              isMore={isMore}
              group={group}
              baseName={desc.name}
              funcDesc={funcDesc}
              propDesc={desc}
            />
          );
        }
      }
    }

    return (
      <div className="ticl-property-group">
        <LengthPropertyEditor
          key={group}
          name={lenName}
          paths={paths}
          conn={conn}
          isMore={isMore}
          group={group}
          funcDesc={funcDesc}
          propDesc={lenDesc}
        />
        {children}
      </div>
    );
  }
}
