import React from "react";
import {ClientConn} from "../../core/client";
import {LazyUpdateComponent} from "../../ui/component/LazyUpdateComponent";

interface MultiSelectProps {
  keys: string[];
  conn: ClientConn;
}


export abstract class MultiSelectLoader<T extends MultiSelectComponent<any, any, any>> {
  parent: T;
  conn: ClientConn;
  key: string;

  constructor(key: string, parent: T) {
    this.key = key;
    this.parent = parent;
    this.conn = (parent.props as MultiSelectProps).conn;
  }

  abstract init(): void;

  abstract destroy(): void;
}

export abstract class MultiSelectComponent<P extends MultiSelectProps, S,
  Loader extends MultiSelectLoader<MultiSelectComponent<P, S, Loader>>>
  extends LazyUpdateComponent<P, S> {

  loaders: Map<string, Loader> = new Map<string, Loader>();

  abstract createLoader(key: string): Loader;

  // update the loaders cache based on input keys
  // the parameter is a constructor of Loader class, this is a work around for the limitation of ts template
  updateLoaders(keys: string[]): [boolean, boolean] {
    let added = false;
    let removed = false;
    for (let key of keys) {
      if (!this.loaders.has(key)) {
        let newLoader = this.createLoader(key);
        this.loaders.set(key, newLoader);
        newLoader.init();
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

  componentWillUnmount() {
    super.componentWillUnmount();
    for (let [key, loader]of this.loaders) {
      loader.destroy();
    }
  }

}
