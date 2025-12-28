import React from 'react';
import ResizeObserver_ from 'resize-observer-polyfill';
const ResizeObserver = (ResizeObserver_ as any).default || ResizeObserver_;

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
  itemStyle?: React.CSSProperties;
}

export default class VirtualList extends React.Component<Props, State> {
  static getDerivedStateFromProps(props: Props, state: State) {
    if (state?.itemStyle?.height !== props.itemHeight) {
      // cache children style in state to reduce re-render
      return {itemStyle: {height: props.itemHeight}};
    }
    return {};
  }

  static defaultProps = {};

  state: State = {offset: 0, height: 0};
  resizeObserver: any;

  private rootNode!: HTMLElement;
  private getRef = (node: HTMLDivElement): void => {
    this.rootNode = node;
  };

  componentDidMount() {
    this.rootNode.addEventListener('scroll', this.handleScroll, {
      passive: true,
    });

    this.resizeObserver = new ResizeObserver((resizes: any) => {
      this.setState({
        height: this.rootNode.clientHeight,
      });
    });
    this.resizeObserver.observe(this.rootNode);
  }

  componentWillUnmount() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.rootNode.removeEventListener('scroll', this.handleScroll);
  }

  onPointerDown = (e: React.PointerEvent) => {
    if (e.shiftKey) {
      // not allow shift key to select range in virtual scroller
      e.preventDefault();
    }
  };

  render() {
    const {itemCount, itemHeight, renderer, className, style} = this.props;
    const {height, offset, itemStyle} = this.state;

    if (this.state.height > 0 && itemCount > 0) {
      const contentHeight = itemCount * itemHeight;
      const start = Math.floor(offset / itemHeight);
      let end = Math.ceil((offset + height) / itemHeight);
      if (end > itemCount) {
        end = itemCount;
      }
      const children: React.ReactNode[] = [];
      let paddingTop = '';
      if (end > start) {
        for (let i = start; i < end; ++i) {
          children.push(renderer(i, itemStyle));
        }
        paddingTop = `${start * itemHeight}px`;
      }

      return (
        <div
          ref={this.getRef}
          className={`ticl-v-scroll ${className}`}
          style={style}
          onPointerDown={this.onPointerDown}
        >
          <div className="ticl-v-scroll-content" style={{height: `${contentHeight}px`, paddingTop}}>
            {children}
          </div>
        </div>
      );
    } else {
      // not mounted or not visible, create dummy div to measure size
      return <div ref={this.getRef} className={`ticl-v-scroll ${className}`} style={style}></div>;
    }
  }

  handleScroll = (event: UIEvent) => {
    const offset = this.rootNode.scrollTop;

    if (offset < 0 || this.state.offset === offset || event.target !== this.rootNode) {
      return;
    }

    this.setState({
      offset,
    });
  };
}
