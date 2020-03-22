import React from 'react';
import {ClientConn, ValueState, ValueUpdate, DataMap, shallowEqual, ValueSubscriber} from '../../../src/core/editor';
import {batchUpdateReact} from '../util/BatchUpdate';

interface LazyUpdateProps {
  conn: ClientConn;
}

export abstract class LazyUpdateComponent<P extends LazyUpdateProps, S> extends React.Component<P, S> {
  _rendering = false;
  _mounted = false;

  render(): React.ReactNode {
    this._rendering = true;
    let result = this.renderImpl();
    this._rendering = false;
    return result;
  }

  componentDidMount(): void {
    this._mounted = true;
  }

  shouldComponentUpdate(nextProps: Readonly<P>, nextState: Readonly<S>): boolean {
    return !shallowEqual(this.props, nextProps) || !shallowEqual(this.state, nextState);
  }

  abstract renderImpl(): React.ReactNode;

  safeSetState<K extends keyof S>(state: Pick<S, K> | S | null, callback?: () => void): void {
    if (this._mounted) {
      super.setState(state, callback);
    } else {
      this.state = {...this.state, ...state};
    }
  }

  forceUpdate() {
    batchUpdateReact(this.safeForceUpdate, this.props.conn);
  }

  safeForceUpdate = () => {
    console.log(this._mounted, this._rendering);
    if (this._mounted && !this._rendering) {
      super.forceUpdate();
    }
  };

  componentWillUnmount() {
    this._mounted = false;
  }
}

export class LazyUpdateSubscriber extends ValueSubscriber {
  parent: {forceUpdate: Function} | Function;

  value: any;
  bindingPath: string;
  defaultValue: any;

  error: string;

  constructor(parent: {forceUpdate: Function} | Function, defaultValue?: any) {
    super(null);
    this.value = defaultValue;
    this.defaultValue = defaultValue;
    this.parent = parent as {forceUpdate: Function} | Function;
  }

  onUpdate(response: ValueUpdate) {
    this.error = null;
    let newValue = response.cache.value;
    if (newValue === undefined) {
      newValue = this.defaultValue;
    }
    if (!Object.is(newValue, this.value)) {
      this.value = newValue;
      this.update();
    }
    if (response.cache.bindingPath !== this.bindingPath) {
      this.bindingPath = response.cache.bindingPath;
      this.update();
    }
  }

  onError(error: string, data?: DataMap) {
    this.error = error;
    this.update();
  }
  update() {
    console.log(this.path);
    if (typeof this.parent === 'function') {
      this.parent(this.value);
    } else {
      this.parent.forceUpdate();
    }
  }
}
