import React from 'react';
import {ClientConn} from '../../../src/core/editor';

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
      this.getConn().callImmediate(renderer.forceUpdate);
    }
  }
}

export interface DataRendererProps<T extends DataRendererItem> {
  item: T;
}

export abstract class PureDataRenderer<P extends DataRendererProps<any>, S> extends React.PureComponent<P, S> {
  constructor(props: P) {
    super(props);
    if (props.item) {
      props.item.attachedRenderer(this);
    }
  }

  componentDidUpdate(prevProps: P) {
    if (prevProps.item !== this.props.item) {
      if (this.props.item) {
        this.props.item.attachedRenderer(this);
      }
      if (prevProps.item) {
        prevProps.item.detachRenderer(this);
      }
    }
  }

  componentWillUnmount() {
    if (this.props.item) {
      this.props.item.detachRenderer(this);
    }
    this._rendered = false;
  }

  _rendering = false;
  _rendered = false;

  render(): React.ReactNode {
    this._rendering = true;
    let result = this.renderImpl();
    this._rendering = false;
    this._rendered = true;
    return result;
  }

  abstract renderImpl(): React.ReactNode;

  // @ts-ignore
  forceUpdate = () => {
    if (this._rendered && !this._rendering) {
      super.forceUpdate();
    }
  };
}
