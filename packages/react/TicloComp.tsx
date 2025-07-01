import React, {ErrorInfo} from 'react';
import {Block} from '@ticlo/core/block/Block';
import {PropDispatcher} from '@ticlo/core/block/Dispatcher';
import {validateReactComponent} from './validateReactComponent';
import {BlockProperty} from '@ticlo/core/block/BlockProperty';

interface Props {
  block: Block;
}

interface State {
  toRender?: React.ReactNode;
}

export class TicloComp extends React.Component<Props, State> {
  static toArrow() {
    return '͢:<TicloComp>';
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render will show the fallback UI.

    return {toRender: <div style={{textAlign: 'center'}}>🔥 {error.name}</div>};
  }

  _property: BlockProperty;

  constructor(props: Props) {
    super(props);
    this._property = this.props.block.getProperty('#render');
    this.state = {toRender: this._property.getValue()};
    this._property.listen(this);
  }

  onSourceChange?(prop: PropDispatcher) {
    // ignore
  }

  onChange(val: any) {
    if (!Object.is(val, this.state.toRender)) {
      this.setState({toRender: val});
    }
  }

  componentWillUnmount(): void {
    this._property.unlisten(this);
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // TODO log this error
  }
  render() {
    let {toRender} = this.state;
    return validateReactComponent(toRender);
  }
}
