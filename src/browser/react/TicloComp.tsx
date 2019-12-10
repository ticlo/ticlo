import React from 'react';
import {Block} from '../../core/block/Block';
import {Dispatcher} from '../../core/block/Dispatcher';

const reactTypeof = ((<div />) as any).$$typeof;

interface Props {
  block: Block;
}

export function validateReactComponent(component: any) {
  if (typeof component === 'object' && !(Object.isExtensible(component) || component.$$typeof !== reactTypeof)) {
    return null;
  }
  return component;
}

export class TicloComp extends React.Component<Props, any> {
  static toJsonEsc() {
    return '\u001b:<TicloComp>';
  }

  constructor(props: Props) {
    super(props);
  }

  onSourceChange?(prop: Dispatcher) {
    // ignore
  }

  onChange(val: any) {
    this.forceUpdate();
  }

  _property: Dispatcher;
  componentDidMount(): void {
    this._property = this.props.block.getProperty('#render');
    this._property.listen(this);
  }

  componentWillUnmount(): void {
    if (this._property) {
      this._property.unlisten(this);
    }
  }

  render() {
    let rendered = this.props.block.getValue('#render');
    return validateReactComponent(rendered);
  }
}
