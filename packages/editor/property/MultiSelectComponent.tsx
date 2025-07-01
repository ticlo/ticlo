import React from 'react';
import {ClientConn} from '@ticlo/core';
import {LazyUpdateComponent} from '../component/LazyUpdateComponent';

interface MultiSelectProps {
  paths: string[];
  conn: ClientConn;
}

export abstract class MultiSelectLoader<T extends MultiSelectComponent<any, any, any>> {
  conn: ClientConn;

  constructor(
    public path: string,
    public parent: T
  ) {
    this.conn = (parent.props as MultiSelectProps).conn;
  }

  abstract init(): void;

  abstract destroy(): void;
}

export abstract class MultiSelectComponent<
  P extends MultiSelectProps,
  S,
  Loader extends MultiSelectLoader<MultiSelectComponent<P, S, Loader>>,
> extends LazyUpdateComponent<P, S> {
  loaders: Map<string, Loader> = new Map<string, Loader>();

  abstract createLoader(paths: string): Loader;

  _checkedPaths: string[];
  // update the loaders cache based on input paths
  // the parameter is a constructor of Loader class, this is a work around for the limitation of ts template
  updateLoaders(paths: string[]): [boolean, boolean] {
    if (paths === this._checkedPaths) {
      return [false, false];
    }
    this._checkedPaths = paths;

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
    return super.shouldComponentUpdate(nextProps, nextState);
  }

  render() {
    // shouldComponentUpdate can be skipped if forceUpdate is called
    // double check here to make sure loaders are updated
    this.updateLoaders(this.props.paths);
    return super.render();
  }

  componentWillUnmount() {
    super.componentWillUnmount();
    for (let [key, loader] of this.loaders) {
      loader.destroy();
    }
  }
}
