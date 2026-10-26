import React, {Component, isValidElement, type CSSProperties, type ReactNode, type RefObject} from 'react';
import {Block} from '@ticlo/core';
import {renderChildren} from '../comp/Component.tsx';
import {animateDeckLayer, getDeckAnimation} from './ViewDeckAnimation.ts';

type Child = ReactNode | Block;
type Page = {key: number; child: Child};
interface Props {
  children: Child[];
  index: number;
  designMode: boolean;
  animation: unknown;
  showEffect: unknown;
  hideEffect: unknown;
  style: CSSProperties;
  className: string;
  handlers: Record<string, unknown>;
  elementRef: RefObject<HTMLDivElement>;
}
interface State {
  children?: Child[];
  index?: number;
  designMode?: boolean;
  nextKey: number;
  current?: Page;
  outgoing?: Page;
  transition?: {frames: ReturnType<typeof getDeckAnimation>; forward: boolean};
}
type Size = {width: number; height: number};

function sameChild(a: Child, b: Child) {
  return a === b || (isValidElement(a) && isValidElement(b) && a.key != null && a.key === b.key && a.type === b.type);
}

/** Owns page retention and takes layout snapshots before React updates the DOM. */
export class ViewDeckContent extends Component<Props, State> {
  state: State = {nextKey: 0};
  private layers = new Map<number, HTMLDivElement>();
  private animations?: Animation[];
  private resizeObserver?: ResizeObserver;

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.children === state.children && props.index === state.index && props.designMode === state.designMode) {
      return null;
    }
    const child = props.children[props.index];
    const retained = [state.current, state.outgoing].find((page) => page && sameChild(page.child, child));
    const current = child === undefined ? undefined : {key: retained?.key ?? state.nextKey, child};
    const forward = props.index > state.index;
    const frames = getDeckAnimation(props.animation, forward, props.showEffect, props.hideEffect);
    const animate =
      current &&
      state.current &&
      current.key !== state.current.key &&
      props.children === state.children &&
      props.index !== state.index &&
      !props.designMode &&
      !state.outgoing &&
      frames &&
      typeof Element !== 'undefined' &&
      typeof Element.prototype.animate === 'function';
    return {
      children: props.children,
      index: props.index,
      designMode: props.designMode,
      nextKey: current && !retained ? state.nextKey + 1 : state.nextKey,
      current,
      outgoing: animate ? state.current : undefined,
      transition: animate ? {frames, forward} : undefined,
    };
  }

  getSnapshotBeforeUpdate(_props: Props, state: State): Size | null {
    if (!this.state.outgoing || this.state.outgoing.key === state.outgoing?.key) return null;
    const layer = this.layers.get(state.current?.key);
    return layer ? {width: layer.offsetWidth, height: layer.offsetHeight} : null;
  }

  componentDidUpdate(_props: Props, state: State, size: Size | null) {
    if (this.state.outgoing?.key === state.outgoing?.key) return;
    this.cancelAnimations();
    const {current, outgoing, transition} = this.state;
    if (!outgoing) return;
    const oldLayer = this.layers.get(outgoing.key);
    const newLayer = this.layers.get(current.key);
    if (size) {
      oldLayer.style.width = `${size.width}px`;
      oldLayer.style.height = `${size.height}px`;
    }
    newLayer.style.setProperty('--ticl-view-deck-x', transition.forward ? '100%' : '-100%');
    oldLayer.style.setProperty('--ticl-view-deck-x', transition.forward ? '-100%' : '100%');
    const incoming = animateDeckLayer(newLayer, transition.frames.incoming);
    const outgoingAnimations = animateDeckLayer(oldLayer, transition.frames.outgoing);
    const outgoingAbove = outgoingAnimations.length > 0 && incoming.length === 0;
    oldLayer.style.zIndex = outgoingAbove ? '1' : '0';
    newLayer.style.zIndex = outgoingAbove ? '0' : '1';
    const animations = [...incoming, ...outgoingAnimations];
    this.animations = animations;
    const finish = () => {
      if (this.animations === animations) this.setState({outgoing: undefined, transition: undefined});
    };
    Promise.all(animations.map((animation) => animation.finished)).then(finish, finish);
    const element = this.props.elementRef.current;
    const width = element.clientWidth;
    const height = element.clientHeight;
    this.resizeObserver = new ResizeObserver(() => {
      if (element.clientWidth !== width || element.clientHeight !== height) finish();
    });
    this.resizeObserver.observe(element);
  }

  private cancelAnimations() {
    const animations = this.animations;
    this.animations = undefined;
    animations?.forEach((animation) => animation.cancel());
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    for (const layer of this.layers.values()) {
      layer.style.width = '';
      layer.style.height = '';
      layer.style.zIndex = '';
      layer.style.animation = '';
      layer.style.removeProperty('--ticl-view-deck-x');
    }
  }

  componentWillUnmount() {
    this.cancelAnimations();
  }

  render() {
    const {style, className, handlers} = this.props;
    const {current, outgoing} = this.state;
    const classes = ['ticl-view-deck', className, outgoing ? 'ticl-view-deck-animating' : ''].filter(Boolean).join(' ');
    return (
      <div {...handlers} style={style} className={classes}>
        {[outgoing, current].filter(Boolean).map((page) => (
          <div
            key={page.key}
            ref={(element) => {
              if (element) this.layers.set(page.key, element);
              else this.layers.delete(page.key);
            }}
            className={page === outgoing ? 'ticl-view-deck-page ticl-view-deck-outgoing' : 'ticl-view-deck-page'}
            inert={page === outgoing}
          >
            {renderChildren([page.child])}
          </div>
        ))}
      </div>
    );
  }
}
