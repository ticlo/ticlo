import React from 'react';
import {relative} from 'path';

interface Props {
  itemCount: number;
  itemHeight: number;
  renderer: (idx: number, style: React.CSSProperties) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

interface State {
  offset: number;
  height: number;
}

export default class VirtualList extends React.Component<Props, State> {
  static defaultProps = {};

  state = {offset: 0, height: 0};
  resizeObserver: any;

  private rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this.rootNode = node;
  };

  componentDidMount() {
    this.rootNode.addEventListener('scroll', this.handleScroll, {
      passive: true,
    });
    if (window.hasOwnProperty('ResizeObserver')) {
      this.resizeObserver = new (window as any).ResizeObserver((resizes: any) => {
        this.setState({
          height: this.rootNode.clientHeight
        });
      });
      this.resizeObserver.observe(this.rootNode);
    } else {
      this.setState({
        height: this.rootNode.offsetHeight
      });
    }
  }

  componentWillUnmount() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.rootNode.removeEventListener('scroll', this.handleScroll);
  }


  render() {
    const {itemCount, itemHeight, renderer, className, style} = this.props;
    const {height, offset} = this.state;

    if (this.state.height > 0 && itemCount > 0) {
      let contentHeight = itemCount * itemHeight;
      let start = Math.floor(offset / itemHeight);
      let end = Math.ceil((offset + height) / itemHeight);
      if (end > itemCount) {
        end = itemCount;
      }
      let children: React.ReactNode[] = [];
      let paddingTop = '';
      if (end > start) {
        let heightStyle = `${itemHeight}px`;
        for (let i = start; i < end; ++i) {
          children.push(renderer(i, {height: heightStyle}));
        }
        paddingTop = `${start * itemHeight}px`;
      }

      return (
        <div ref={this.getRef} className={`ticl-v-scroll ${className}`} style={style}>
          <div className='ticl-v-scroll-content' style={{height: `${contentHeight}px`, paddingTop}}>{children}</div>
        </div>
      );
    } else {
      // not mounted or not visible, create dummy div to measure size
      return (
        <div ref={this.getRef} className='ticl-v-scroll' style={style}>
        </div>
      );
    }
  }

  handleScroll = (event: UIEvent) => {
    const offset = this.rootNode.scrollTop;

    if (
      offset < 0 ||
      this.state.offset === offset ||
      event.target !== this.rootNode
    ) {
      return;
    }

    this.setState({
      offset
    });
  }


}
