import React from 'react';
import {ClientConn} from '../../core/client';
import {LazyUpdateComponent} from '../../ui/component/LazyUpdateComponent';

interface MultiSelectProps {
  paths: string[];
  conn: ClientConn;
}

export abstract class MultiSelectLoader<T extends MultiSelectComponent<any, any, any>> {
  conn: ClientConn;

  constructor(public path: string, public parent: T) {
    this.conn = (parent.props as MultiSelectProps).conn;
  }

  abstract init(): void;

  abstract destroy(): void;
}

export abstract class MultiSelectComponent<
  P extends MultiSelectProps,
  S,
  Loader extends MultiSelectLoader<MultiSelectComponent<P, S, Loader>>
> extends LazyUpdateComponent<P, S> {
  loaders: Map<string, Loader> = new Map<string, Loader>();

  abstract createLoader(paths: string): Loader;

  // update the loaders cache based on input paths
  // the parameter is a constructor of Loader class, this is a work around for the limitation of ts template
  updateLoaders(paths: string[]): [boolean, boolean] {
    let added = false;
    let removed = false;
    for (let key of paths) {
      if (!this.loaders.has(key)) {
        let newLoader = this.createLoader(key);
        this.loaders.set(key, newLoader);
        newLoader.init();
        added = true;
      }
    }
    if (paths.length < this.loaders.size) {
      for (let [key, subscriber] of this.loaders) {
        if (!paths.includes(key)) {
          subscriber.destroy();
          this.loaders.delete(key);
          removed = true;
        }
      }
    }

    return [added, removed];
  }

  shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>): boolean {
    let {paths} = nextProps;
    let [added, removed] = this.updateLoaders(paths);
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
    for (let [key, loader] of this.loaders) {
      loader.destroy();
    }
  }
}
