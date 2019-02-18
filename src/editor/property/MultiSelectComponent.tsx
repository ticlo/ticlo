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
  extends React.PureComponent<P, S> {

  loaders: Map<string, Loader> = new Map<string, Loader>();

  // update the loaders cache based on input keys
  // the parameter is a constructor of Loader class, this is a work around for the limitation of ts template
  updateLoaders(keys: string[], NewLoader: new(key: string, parent: MultiSelectComponent<P, S, Loader>) => Loader): boolean {
    let changed = false;
    for (let key of keys) {
      if (!this.loaders.has(key)) {
        this.loaders.set(key, new NewLoader(key, this));
        changed = true;
      }
    }
    if (keys.length === this.loaders.size) {
      // rest part of the check won't be necessary
      return changed;
    }
    for (let [key, subscriber] of this.loaders) {
      if (!keys.includes(key)) {
        subscriber.destroy();
        this.loaders.delete(key);
        changed = true;
      }
    }
    return changed;
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

  safeForceUpdate() {
    if (this._mounted && !this._rendering) {
      this.forceUpdate();
    }
  }

  componentWillUnmount() {
    this._mounted = false;
    for (let [key, loader]of this.loaders) {
      loader.destroy();
    }
  }
}
