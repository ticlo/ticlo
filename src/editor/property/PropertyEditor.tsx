import React from "react";
import {ClientConnection, ValueState, ValueUpdate} from "../../common/connect/ClientConnection";
import {FunctionDesc, PropDesc} from "../../common/block/Descriptor";
import {translateProperty} from "../../common/util/i18n";
import {MultiSelectComponent, MultiSelectLoader} from "./MultiSelectComponent";
import {GroupEditor} from "./GroupEditor";
import {NumberEditor} from "./value/NumberEditor";
import {StringEditor} from "./value/StringEditor";
import {ToggleEditor} from "./value/ToggleEditor";
import {SelectEditor} from "./value/SelectEditor";
import {DragStore} from "../../ui/util/DragStore";
import equal from "fast-deep-equal";

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

  onDragStart = (event: React.DragEvent) => {
    let {conn, keys, name} = this.props;

    let fields = keys.map((s) => `${s}.${name}`);
    event.dataTransfer.setData('text/plain', fields.join(','));

    DragStore.dragStart(conn, {fields});
  };
  onDragOver = (event: React.DragEvent) => {
    let {conn, keys, name, propDesc} = this.props;

    if (propDesc.readonly) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }

    let dragFields: string[] = DragStore.getData(conn, 'fields');
    if (Array.isArray(dragFields) &&
      (dragFields.length === 1 || dragFields.length === keys.length)) {
      let fields = keys.map((s) => `${s}.${name}`);
      if (!equal(fields, dragFields)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'link';
        return;
      }
    }
    event.dataTransfer.dropEffect = 'none';
  };
  onDrop = (event: React.DragEvent) => {
    let {conn, keys, name} = this.props;

    let dragFields: string[] = DragStore.getData(conn, 'fields');
    if (Array.isArray(dragFields)) {
      let fields = keys.map((s) => `${s}.${name}`);
      if (dragFields.length === 1) {
        for (let field of fields) {
          if (dragFields[0] !== field) {
            conn.setBinding(field, dragFields[0], true);
          }
        }
      } else if (dragFields.length === fields.length) {
        for (let i = 0; i < fields.length; ++i) {
          if (dragFields[i] !== fields[i]) {
            conn.setBinding(fields[i], dragFields[i], true);
          }
        }
      }
    }
  };
  onDragEnd = (event: React.DragEvent) => {
    DragStore.dragEnd();
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
          break;
        }
        case 'toggle': {
          editor = <ToggleEditor value={value} desc={propDesc} onChange={onChange}/>;
          break;
        }
        case 'select': {
          editor = <SelectEditor value={value} desc={propDesc} onChange={onChange}/>;
          break;
        }
      }
      return (
        <div className='ticl-property'>
          <div className='ticl-property-name' draggable={true} onDragStart={this.onDragStart}
               onDragOver={this.onDragOver} onDrop={this.onDrop} onDragEnd={this.onDragEnd}>
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