import React from "react";
import {ClientConnection, ValueState, ValueUpdate} from "../../common/connect/ClientConnection";
import {FunctionDesc, PropDesc} from "../../common/block/Descriptor";
import {translateProperty} from "../../common/util/i18n";
import {MultiSelectComponent, MultiSelectLoader} from "./MultiSelectComponent";
import {GroupEditor} from "./GroupEditor";
import {NumberEditor} from "./value/NumberEditor";
import {StringEditor} from "./value/StringEditor";


class PropertyLoader extends MultiSelectLoader<PropertyEditor> {
  valueKey: string;
  name: string;

  constructor(key: string, parent: PropertyEditor) {
    super(key, parent);
    this.name = parent.props.name;
    this.valueKey = `${key}.${this.name}`;
    this.conn.subscribe(this.valueKey, this.listener);
  }

  cache: ValueState;
  subBlock = false;
  listener = {
    onUpdate: (response: ValueUpdate) => {
      this.cache = response.cache;
      if (response.change.hasOwnProperty('value') || response.change.hasOwnProperty('bindingPath')) {
        this.subBlock = response.cache.bindingPath === `~${this.name}.output`;
        this.parent.safeForceUpdate();
      }
    }
  };


  destroy() {
    this.conn.unsubscribe(this.valueKey, this.listener);
  }

}

interface Props {
  conn: ClientConnection;
  keys: string[];
  name: string; // name is usually same as propDesc.name, but when it's in group, it will have a number after
  funcDesc: FunctionDesc;
  propDesc: PropDesc;
}

export class PropertyEditor extends MultiSelectComponent<Props, any, PropertyLoader> {

  constructor(props: Readonly<Props>) {
    super(props);
    this.updateLoaders(props.keys, PropertyLoader);
  }

  onChange = (value: any) => {
    let {keys, name, conn} = this.props;
    for (let key of keys) {
      conn.setValue(`${key}.${name}`, value);
    }
  };

  renderImpl() {
    let {keys, funcDesc, propDesc, name} = this.props;

    this.updateLoaders(keys, PropertyLoader);

    ready: {
      let it = this.loaders[Symbol.iterator]();
      let [firstKey, firstLoader] = it.next().value;
      let firstCache = firstLoader.cache;
      if (!firstCache) {
        break ready;
      }

      let onChange = propDesc.readonly ? null : this.onChange;

      let value = firstCache.value;
      let valueSame = true;

      let bindingPath = firstCache.bindingPath;
      let bindingSame = true;
      let subBlock = firstLoader.subBlock;

      for (let [key, loader] of it) {
        let cache = loader.cache;
        if (!cache) {
          break ready;
        }
        if (Object.is(value, cache.value)) {
          valueSame = false;
        }
        if (bindingPath !== cache.bindingPath) {
          bindingSame = false;
        }
        if (!loader.subBlock) {
          subBlock = false;
        }
      }

      let editor: React.ReactNode;
      switch (propDesc.type) {
        case 'number': {
          editor = <NumberEditor value={value} desc={propDesc} onChange={onChange}/>;
          break;
        }
        case 'string': {
          editor = <StringEditor value={value} desc={propDesc} onChange={onChange}/>;
        }
      }
      return (
        <div className='ticl-property'>
          <div className='ticl-property-name'>
            {translateProperty(funcDesc.name, name, funcDesc.ns)}
          </div>
          <div className='ticl-property-value'>
            {editor}
          </div>
        </div>
      );
    }
    // loaders are not ready
    return <div className='ticl-property'/>;
  }
}