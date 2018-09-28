import * as React from "react";

export class DataRendererItem {
  _renderer: PureDataRenderer<any, any>;

  attachedRenderer(renderer: PureDataRenderer<any, any>) {
    this._renderer = renderer;
  }

  detachRenderer(renderer: PureDataRenderer<any, any>) {
    if (this._renderer === renderer) {
      this._renderer = null;
    }
  }
}

export interface DataRendererProps<T extends DataRendererItem> {
  item: T;
}

export class PureDataRenderer<P extends DataRendererProps<any>, S> extends React.PureComponent<P, S> {
  constructor(props: P) {
    super(props);
    this.props.item.attachedRenderer(this);
  }

  componentDidUpdate(prevProps: P) {
    if (prevProps.item !== this.props.item) {
      this.props.item.attachedRenderer(this);
    }
  }

  componentWillUnmount() {
    this.props.item.detachRenderer(this);
  }
}
