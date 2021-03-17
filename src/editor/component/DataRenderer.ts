import React from 'react';
import {ClientConn} from '../../../src/core/editor';
import {batchUpdateReact} from '../util/BatchUpdate';

export abstract class DataRendererItem<T = any> {
  _renderers: Set<PureDataRenderer<any, any> & T> = new Set<PureDataRenderer<any, any> & T>();

  attachedRenderer(renderer: PureDataRenderer<any, any> & T) {
    this.getConn().lockImmediate(this);
    if (this._renderers.size === 0) {
      this._renderers.add(renderer);
      this.onAttached();
    } else {
      this._renderers.add(renderer);
    }
    this.getConn().unlockImmediate(this);
  }

  detachRenderer(renderer: PureDataRenderer<any, any> & T) {
    this._renderers.delete(renderer);
    if (this._renderers.size === 0) {
      this.onDetached();
    }
  }

  onAttached() {
    // to be overridden
  }

  onDetached() {
    // to be overridden
  }

  abstract getConn(): ClientConn;

  forceUpdate() {
    for (let renderer of this._renderers) {
      batchUpdateReact(renderer.forceUpdate, this.getConn());
    }
  }
}

export interface DataRendererProps<T extends DataRendererItem> {
  item: T;
}

export abstract class PureDataRenderer<P extends DataRendererProps<any>, S> extends React.PureComponent<P, S> {
  // value is undefined when not mounted
  _rendering: boolean = undefined;

  constructor(props: P) {
    super(props);
    if (props.item) {
      props.item.attachedRenderer(this);
    }
  }

  // attach renderer in UNSAFE_componentWillReceiveProps instead of componentDidUpdate
  // because it's possible that item's state changed between render() and componentDidUpdate(), causing a forceUpdate() to be ignored
  UNSAFE_componentWillReceiveProps(nextProps: P) {
    if (nextProps.item !== this.props.item) {
      nextProps.item?.attachedRenderer(this);
      this.props.item?.detachRenderer(this);
    }
  }

  componentWillUnmount() {
    this.props.item?.detachRenderer(this);
    this._rendering = undefined;
  }

  render(): React.ReactNode {
    this._rendering = true;
    let result = this.renderImpl();
    this._rendering = false;
    return result;
  }

  safeSetState<K extends keyof S>(state: Pick<S, K> | S | null, callback?: () => void): void {
    if (this._rendering !== undefined) {
      super.setState(state, callback);
    } else {
      this.state = {...this.state, ...state};
    }
  }

  abstract renderImpl(): React.ReactNode;

  // @ts-ignore
  forceUpdate = () => {
    if (this._rendering === false) {
      // can't be true or undefined
      super.forceUpdate();
    }
  };
}
