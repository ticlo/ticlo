import React from "react";
import {ClientConnection} from "../../common/connect/ClientConnection";

interface Props {
  keys: string[];
  conn: ClientConnection;
}


export abstract class MultiSelectLoader<T extends MultiSelectComponent<any, any, any>> {
  parent: T;
  conn: ClientConnection;
  key: string;

  constructor(key: string, parent: T) {
    this.key = key;
    this.parent = parent;
    this.conn = (parent.props as Props).conn;
  }

  abstract destroy(): void;
}


export abstract class MultiSelectComponent<P extends Props, S,
  Loader extends MultiSelectLoader<MultiSelectComponent<P, S, Loader>>>
  extends React.Component<P, S> {

  loaders: Map<string, Loader> = new Map<string, Loader>();

  abstract createLoader(key: string): Loader;

  // update the loaders cache based on input keys
  // the parameter is a constructor of Loader class, this is a work around for the limitation of ts template
  updateLoaders(keys: string[]): [boolean, boolean] {
    let added = false;
    let removed = false;
    for (let key of keys) {
      if (!this.loaders.has(key)) {
        this.loaders.set(key, this.createLoader(key));
        added = true;
      }
    }
    if (keys.length < this.loaders.size) {
      for (let [key, subscriber] of this.loaders) {
        if (!keys.includes(key)) {
          subscriber.destroy();
          this.loaders.delete(key);
          removed = true;
        }
      }
    }

    return [added, removed];
  }

  shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>): boolean {
    let {keys} = nextProps;
    let [added, removed] = this.updateLoaders(keys);
    if (added) {
      return false;
    }
    for (let key in this.props) {
      if (!Object.is((this.props as any)[key], (nextProps as any)[key])) {
        return true;
      }
    }
    for (let key in this.state) {
      if (!Object.is((this.state as any)[key], (nextState as any)[key])) {
        return true;
      }
    }
    return false;
  }

  _rendering = false;
  _mounted = false;

  render(): React.ReactNode {
    this._rendering = true;
    let result = this.renderImpl();
    this._rendering = false;
    this._mounted = true;
    return result;
  }

  abstract renderImpl(): React.ReactNode;

  forceUpdate() {
    this.props.conn.callImmediate(this.safeForceUpdate);
  }

  safeForceUpdate = () => {
    if (this._mounted && !this._rendering) {
      super.forceUpdate();
    }
  };

  componentWillUnmount() {
    this._mounted = false;
    for (let [key, loader]of this.loaders) {
      loader.destroy();
    }
  }
}
