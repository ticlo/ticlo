import React from "react";
import {ClientConnection, ValueUpdate} from "../../common/connect/ClientConnection";
import {DataMap} from "../../common/util/Types";
import {FunctionDesc, PropDesc, PropGroupDesc} from "../../common/block/Descriptor";
import {PropertyEditor} from "./PropertyEditor";
import {GroupEditor} from "./GroupEditor";
import {MultiSelectComponent, MultiSelectLoader} from "./MultiSelectComponent";
import equal from "fast-deep-equal";

class BlockLoader extends MultiSelectLoader<PropertyList> {

  isListener = {
    onUpdate: (response: ValueUpdate) => {
      this.conn.watchDesc(response.cache.value, this.onDesc);
    }
  };

  defs: PropDesc[];
  bDefsListener = {
    onUpdate: (response: ValueUpdate) => {
      let value = response.cache.value;
      if (!Array.isArray(value)) {
        value = null;
      }
      if (!equal(value, this.defs)) {
        this.defs = value;
        this.parent.safeForceUpdate();
      }
    }
  };

  desc: FunctionDesc;
  onDesc = (desc: FunctionDesc) => {
    this.desc = desc;
    this.parent.safeForceUpdate();
  };


  constructor(key: string, parent: PropertyList) {
    super(key, parent);
    this.conn.subscribe(`${key}.#is`, this.isListener);
    this.conn.subscribe(`${key}.#defs`, this.bDefsListener);
  }

  destroy() {
    this.conn.unsubscribe(`${this.key}.#is`, this.isListener);
    this.conn.unsubscribe(`${this.key}.@b-more`, this.bDefsListener);
  }
}

function getPropDescName(prop: PropDesc | PropGroupDesc) {
  if (prop.hasOwnProperty('group')) {
    return `${(prop as PropGroupDesc).group}#len`;
  } else if ((prop as PropDesc).name) {
    return (prop as PropDesc).name;
  }
  return '@invalid';
}

function comparePropDesc(a: PropDesc | PropGroupDesc, b: PropDesc | PropGroupDesc) {
  if (a.hasOwnProperty('group')) {
    if ((a as PropGroupDesc).group !== (b as PropGroupDesc).group) return false;
    if (!(a as PropGroupDesc).properties || !(b as PropGroupDesc).properties
      || (a as PropGroupDesc).properties.length !== (b as PropGroupDesc).properties.length) {
      return false;
    }
    for (let i = 0; i < (a as PropGroupDesc).properties.length; ++i) {
      if (!comparePropDesc((a as PropGroupDesc).properties[i], (b as PropGroupDesc).properties[i])) {
        return false;
      }
    }
  } else {
    if ((a as PropDesc).name !== (b as PropDesc).name) return false;
    if ((a as PropDesc).type !== (b as PropDesc).type) return false;
    if ((a as PropDesc).editor !== (b as PropDesc).editor) return false;
  }

  return true;
}

interface Props {
  conn: ClientConnection;
  keys: string[];
  style?: React.CSSProperties;
}

interface State {
  defsExpanded: boolean;
}

class PropertyDefMerger {
  map: Map<string, PropDesc | PropGroupDesc> = null;

  add(props: (PropDesc | PropGroupDesc)[]) {
    if (this.map) {
      // merge with existing propMap, only show properties exist in all desc
      let checkedProperties: Set<string> = new Set<string>();
      for (let prop of props) {
        let name = getPropDescName(prop);
        if (this.map.has(name) && !comparePropDesc(this.map.get(name), prop)) {
          // hide property if there is a conflict
          this.map.delete(name);
        } else {
          checkedProperties.add(name);
        }
      }
      for (let [name, prop] of this.map) {
        if (!checkedProperties.has(name)) {
          this.map.delete(name);
        }
      }
    } else {
      this.map = new Map<string, PropDesc | PropGroupDesc>();
      for (let prop of props) {
        let name = getPropDescName(prop);
        this.map.set(name, prop);
      }
    }
  }

  render(keys: string[], conn: ClientConnection, funcDesc: FunctionDesc) {
    let children: React.ReactNode[] = [];
    for (let [name, prop] of this.map) {
      if (prop.hasOwnProperty('group')) {
        children.push(
          <GroupEditor key={name} keys={keys} conn={conn}
                       funcDesc={funcDesc} groupDesc={prop as PropGroupDesc}/>
        );
      } else if ((prop as PropDesc).name) {
        children.push(
          <PropertyEditor key={name} name={name} keys={keys} conn={conn}
                          funcDesc={funcDesc} propDesc={prop as PropDesc}/>
        );
      }
    }
    return children;
  }
}

export class PropertyList extends MultiSelectComponent<Props, State, BlockLoader> {

  constructor(props: Readonly<Props>) {
    super(props);
    this.state = {defsExpanded: true};
    this.updateLoaders(props.keys, BlockLoader);
  }

  renderImpl() {
    let {conn, keys, style} = this.props;

    let descChecked: Set<string> = new Set<string>();
    let propMerger: PropertyDefMerger = new PropertyDefMerger();
    let defsMerger: PropertyDefMerger = new PropertyDefMerger();

    this.updateLoaders(keys, BlockLoader);

    for (let [key, subscriber] of this.loaders) {
      if (subscriber.desc) {
        if (!descChecked.has(subscriber.desc.name)) {
          descChecked.add(subscriber.desc.name);
          propMerger.add(subscriber.desc.properties);
        }
      } else {
        // properties not ready
        propMerger.map = null;
        break;
      }
    }
    for (let [key, subscriber] of this.loaders) {
      if (subscriber.defs) {
        defsMerger.add(subscriber.defs);
      } else {
        // properties not ready
        defsMerger.map = null;
        break;
      }
    }
    if (propMerger.map) {
      let funcDesc: FunctionDesc = this.loaders.entries().next().value[1].desc;
      let children = propMerger.render(keys, conn, funcDesc);
      let defsChildren: React.ReactNode[];
      if (defsMerger.map && this.state.defsExpanded) {
        defsChildren = defsMerger.render(keys, conn, funcDesc);
      }
      return (
        <div style={style}>
          {children}
          {propMerger.map ? <div>{defsChildren}</div> : null}
        </div>
      );
    } else {
      return <div style={style}/>;
    }

  }
}