import React from "react";
import {ClientConnection, ValueUpdate} from "../../common/connect/ClientConnection";
import {DataMap} from "../../common/util/Types";
import {FunctionDesc, PropDesc, PropGroupDesc} from "../../common/block/Descriptor";
import {PropertyEditor} from "./PropertyEditor";
import {GroupEditor} from "./GroupEditor.tsx";


class BlockSubscriber {
  editor: PropertyList;
  conn: ClientConnection;
  key: string;

  isListener = {
    onUpdate: (response: ValueUpdate) => {
      this.conn.watchDesc(response.cache.value, this.onDesc);
    }
  };

  bDefListener = {
    onUpdate: (response: ValueUpdate) => {
      // todo implement #def
    }
  };

  desc: FunctionDesc;
  onDesc = (desc: FunctionDesc) => {
    this.desc = desc;
    this.editor.forceUpdate();
  };


  constructor(key: string, editor: PropertyList) {
    this.key = key;
    this.editor = editor;
    this.conn = editor.props.conn;
    this.conn.subscribe(`${key}.#is`, this.isListener);
    this.conn.subscribe(`${key}.#def`, this.bDefListener);
  }

  // onDone?(): void;
  onUpdate(response: ValueUpdate) {
    this.conn.watchDesc(response.cache.value, this.onDesc);
  }

  // onError?(error: string, data?: DataMap): void;


  destroy() {
    this.conn.unsubscribe(`${this.key}.#is`, this.isListener);
    this.conn.unsubscribe(`${this.key}.@b-more`, this.bDefListener);
  }
}

interface Props {
  conn: ClientConnection;
  keys: string[];
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

class PropertyList extends React.Component<Props, any> {

  subscriptions: Map<string, BlockSubscriber> = new Map<string, BlockSubscriber>();

  updateSubscriptions() {
    let {keys, conn} = this.props;
    for (let [key, subscriber] of this.subscriptions) {
      if (!keys.includes(key)) {
        subscriber.destroy();
        this.subscriptions.delete(key);
      }
    }
    for (let key of keys) {
      if (!this.subscriptions.has(key)) {
        this.subscriptions.set(key, new BlockSubscriber(key, this));
      }
    }
  }

  constructor(props: Readonly<Props>) {
    super(props);
    this.updateSubscriptions();
  }

  render() {
    let {conn, keys} = this.props;
    let descChecked: Set<string> = new Set<string>();
    let propMap: Map<string, PropDesc | PropGroupDesc> = null; // new Map<string, PropDesc | PropGroupDesc>();
    let defPropMap: Map<string, PropDesc> = null; // new Map<string, PropDesc>();

    for (let [key, subscriber] of this.subscriptions) {
      if (subscriber.desc) {
        if (!descChecked.has(subscriber.desc.name)) {
          descChecked.add(subscriber.desc.name);
          if (propMap) {
            // merge with existing propMap, only show properties exist in all desc
            let checkedProperties: Set<string> = new Set<string>();
            for (let prop of subscriber.desc.properties) {
              let name = getPropDescName(prop);
              if (propMap.has(name) && !comparePropDesc(propMap.get(name), prop)) {
                // hide property if there is a conflict
                propMap.delete(name);
              } else {
                checkedProperties.add(name);
              }
            }
            if (checkedProperties.size !== propMap.size) {
              for (let [name, prop] of propMap) {
                if (!checkedProperties.has(name)) {
                  propMap.delete(name);
                }
              }
            }
          } else {
            propMap = new Map<string, PropDesc | PropGroupDesc>();
            for (let prop of subscriber.desc.properties) {
              let name = getPropDescName(prop);
              propMap.set(name, prop);
            }
          }

        }
      } else {
        // properties not ready
        propMap = null;
        break;
      }
    }
    if (propMap) {
      let children: React.ReactNode[] = [];
      for (let [name, prop] of propMap) {
        if (prop.hasOwnProperty('group')) {
          children.push(<GroupEditor key={name} keys={keys} conn={conn} group={(prop as PropGroupDesc).group}/>);
        } else if ((prop as PropDesc).name) {
          children.push(<PropertyEditor key={name} keys={keys} conn={conn} name={name}/>);
        }
      }
      return (
        <div>
          {children}
        </div>
      );
    } else {
      return <div/>;
    }

  }
}