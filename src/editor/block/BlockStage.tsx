import React from "react";
import {ClientConnection} from "../../common/connect/ClientConnection";
import {DataMap} from "../../common/util/Types";
import {BlockItem, FieldItem, Stage, BlockView} from "./Block";
import {WireItem, WireView} from "./Wire";

interface Props {
  conn: ClientConnection;
  basePath: string;
  style?: React.CSSProperties;
}

interface State {

}

export default class BlockStage extends React.Component<Props, State> implements Stage {


  _blocks: Map<string, BlockItem> = new Map<string, BlockItem>();
  _wires: Map<string, WireItem> = new Map<string, WireItem>();
  _fields: Map<string, FieldItem> = new Map<string, FieldItem>();
  _fieldLinks: Map<string, Set<FieldItem>> = new Map<string, Set<FieldItem>>();

  linkField(souceKey: string, targetField: FieldItem) {
    if (!this._fieldLinks.has(souceKey)) {
      this._fieldLinks.set(souceKey, new Set<FieldItem>());
    }
    this._fieldLinks.get(souceKey).add(targetField);
    targetField.sourceChanged(this._fields.get(souceKey));
  }

  unlinkField(sourceKey: string, targetField: FieldItem) {
    let links = this._fieldLinks.get(sourceKey);
    if (links) {
      links.delete(targetField);
      if (links.size === 0) {
        this._fieldLinks.delete(sourceKey);
      }
    }
  }

  registerField(key: string, item: FieldItem) {
    this._fields.set(key, item);
    if (this._fieldLinks.has(key)) {
      for (let target of this._fieldLinks.get(key)) {
        target.sourceChanged(item);
      }
    }
  }

  unregisterField(key: string, item: FieldItem) {
    if (this._fields.get(key) === item) {
      this._fields.delete(key);
      if (this._fieldLinks.has(key)) {
        for (let target of this._fieldLinks.get(key)) {
          target.sourceChanged(null);
        }
      }
    }
  }

  watchListener = {
    onUpdate: (response: DataMap) => {
      let changes = response.changes;
      for (let name in changes) {
        let change = changes[name];
        if (change === null) {
          if (this._blocks.has(name)) {
            this._blocks.delete(name);
            this.forceUpdate();
          }
        } else {
          if (!this._blocks.has(name)) {
            this._blocks.set(name, new BlockItem(this.props.conn, this, `${this.props.basePath}.${name}`));
            this.forceUpdate();
          }
        }
      }
    }
  };

  constructor(props: Props) {
    super(props);
    props.conn.watch(props.basePath, this.watchListener);
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    if (nextProps.basePath !== this.props.basePath) {
      // TODO clear cached blocks
      this.props.conn.unwatch(this.props.basePath, this.watchListener);
      this.props.conn.watch(nextProps.basePath, this.watchListener);
    }
    return true;
  }

  render() {
    let {style} = this.props;

    let children: React.ReactNode[] = [];

    // add wires
    for (let [key, fieldItem] of this._fields) {
      if (fieldItem.inWire) {
        children.push(<WireView key={`~${key}`} item={fieldItem.inWire}/>);
      }
    }
    // add blocks
    for (let [key, blockItem] of this._blocks) {
      children.push(<BlockView key={key} item={blockItem}/>);
    }

    return (
      <div style={style} className="ticl-block-stage">
        {children}
      </div>
    );
  }

  componentWillUnmount() {
    this.props.conn.unwatch(this.props.basePath, this.watchListener);
  }
}
