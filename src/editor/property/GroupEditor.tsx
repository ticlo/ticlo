import React from 'react';
import {
  ClientConn,
  lengthPropDesc,
  ValueSubscriber,
  ValueUpdate,
  FunctionDesc,
  PropGroupDesc,
} from '../../../src/core/editor';
import {MultiSelectComponent, MultiSelectLoader} from './MultiSelectComponent';
import {PropertyEditor} from './PropertyEditor';
import {CustomGroupPropertyReorder, CustomPropertyReorder, GroupPropertyReorder} from './PropertyReorder';

class LengthPropertyEditor extends PropertyEditor {
  onChange = (value: any) => {
    let {conn, paths, name, propDesc} = this.props;
    if (name.endsWith('[]')) {
      let group = name.substring(0, name.length - 2);
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
  len: number = -1;
  lenListener = new ValueSubscriber({
    onUpdate: (response: ValueUpdate) => {
      let len = parseInt(response.cache.value);
      if (!(len >= 0)) {
        len = this.parent.props.groupDesc.defaultLen;
      }
      if (len !== this.len) {
        this.len = len;
        this.parent.forceUpdate();
      }
    },
  });

  init() {
    this.lenListener.subscribe(this.conn, `${this.path}.${this.parent.props.groupDesc.name}[]`);
  }

  destroy() {
    this.lenListener.unsubscribe();
  }
}

interface Props {
  conn: ClientConn;
  paths: string[];
  funcDesc: FunctionDesc;
  groupDesc: PropGroupDesc;
  isCustom?: boolean;
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
    let {conn, paths, funcDesc, groupDesc, isCustom} = this.props;
    let children: React.ReactNode[] = [];
    let {name: group} = groupDesc;

    let lenName = `${group}[]`;
    let lenDesc = {...lengthPropDesc, default: groupDesc.defaultLen, name: lenName};

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
              isCustom={isCustom}
              group={group}
              baseName={desc.name}
              funcDesc={funcDesc}
              propDesc={desc}
              reorder={isCustom ? CustomGroupPropertyReorder : GroupPropertyReorder}
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
          isCustom={isCustom}
          group={group}
          funcDesc={funcDesc}
          propDesc={lenDesc}
          reorder={isCustom ? CustomPropertyReorder : null}
        />
        {children}
      </div>
    );
  }
}
