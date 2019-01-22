import React from "react";
import {ClientConnection, ValueUpdate} from "../../common/connect/ClientConnection";
import {DataMap} from "../../common/util/Types";
import {FunctionDesc, PropDesc, PropGroupDesc} from "../../common/block/Descriptor";


class BlockSubscriber {
  editor: PropertyEditor;
  conn: ClientConnection;
  key: string;

  isListener = {
    onUpdate: (response: ValueUpdate) => {
      this.conn.watchDesc(response.cache.value, this.onDesc);
    }
  };

  bMoreListener = {
    onUpdate: (response: ValueUpdate) => {
      // todo implement b-more
    }
  };

  desc: FunctionDesc;
  onDesc = (desc: FunctionDesc) => {
    this.desc = desc;
    this.editor.forceUpdate();
  };


  constructor(key: string, editor: PropertyEditor) {
    this.key = key;
    this.editor = editor;
    this.conn = editor.props.conn;
    this.conn.subscribe(`${key}.#is`, this.isListener);
    this.conn.subscribe(`${key}.@b-more`, this.bMoreListener);
  }

  // onDone?(): void;
  onUpdate(response: ValueUpdate) {
    this.conn.watchDesc(response.cache.value, this.onDesc);
  }

  // onError?(error: string, data?: DataMap): void;


  destroy() {
    this.conn.unsubscribe(`${this.key}.#is`, this.isListener);
    this.conn.unsubscribe(`${this.key}.@b-more`, this.bMoreListener);
  }
}

interface Props {
  conn: ClientConnection;
  keys: string[];
  name: string;
}

function getPropDescName(prop: PropDesc | PropGroupDesc) {
  if ((prop as PropDesc).name) {
    return (prop as PropDesc).name;
  } else if ((prop as PropGroupDesc).group) {
    return `${(prop as PropGroupDesc).group}0`;
  }
  return '@invalid';
}

function comparePropDesc(a: PropDesc | PropGroupDesc, b: PropDesc | PropGroupDesc) {
  if ((a as PropDesc).name !== (b as PropDesc).name) return false;
  if ((a as PropGroupDesc).group !== (b as PropGroupDesc).group) return false;
  if (a.type !== b.type) return false;
  if (a.editor !== b.editor) return false;
  return true;
}

class PropertyEditor extends React.Component<Props, any> {

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
    let descChecked: Set<string> = new Set<string>();
    let propMap: Map<string, PropDesc | PropGroupDesc> = null; // new Map<string, PropDesc | PropGroupDesc>();
    let morePropMap: Map<string, PropDesc> = null; // new Map<string, PropDesc>();

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
      return <div/>;
    } else {
      return <div/>;
    }

  }
}