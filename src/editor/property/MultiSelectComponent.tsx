import React from "react";
import {Destroyable} from "../../common/interfaces";


interface Props {
  keys: string[];
}

export class MultiSelectComponent<P extends Props, S,
  Loader extends Destroyable>
  extends React.Component<P, S> {

  loaders: Map<string, Loader> = new Map<string, Loader>();

  updateLoaders(NewLoader: new(key: string, parent: MultiSelectComponent<P, S, Loader>) => Loader): boolean {
    let {keys} = this.props;
    let changed = false;
    for (let [key, subscriber] of this.loaders) {
      if (!keys.includes(key)) {
        subscriber.destroy();
        this.loaders.delete(key);
        changed = true;
      }
    }
    for (let key of keys) {
      if (!this.loaders.has(key)) {
        this.loaders.set(key, new NewLoader(key, this));
        changed = true;
      }
    }
    return changed;
  }

  componentWillUnmount() {
    for (let [key, loader]of this.loaders) {
      loader.destroy();
    }
  }
}
