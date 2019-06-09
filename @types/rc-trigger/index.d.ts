declare module 'rc-trigger' {
  import React from 'react';
  type RenderFunction = () => React.ReactNode;

  interface TriggerProps {
    action?: string[];
    showAction?: any;
    hideAction?: any;
    getPopupClassNameFromAlign?: any;
    onPopupVisibleChange?: (visible: boolean) => void;
    afterPopupVisibleChange?: Function;
    popup: React.ReactNode | RenderFunction;
    popupStyle?: object;
    prefixCls?: string;
    popupClassName?: string;
    className?: string;
    popupPlacement?: string;
    builtinPlacements?: object;
    popupTransitionName?: string | object;
    popupAnimation?: any;
    mouseEnterDelay?: number;
    mouseLeaveDelay?: number;
    zIndex?: number;
    focusDelay?: number;
    blurDelay?: number;
    getPopupContainer?: Function;
    getDocument?: Function;
    forceRender?: boolean;
    destroyPopupOnHide?: boolean;
    mask?: boolean;
    maskClosable?: boolean;
    onPopupAlign?: Function;
    popupAlign?: object;
    popupVisible?: boolean;
    defaultPopupVisible?: boolean;
    maskTransitionName?: string | object;
    maskAnimation?: string;
    stretch?: string;
    alignPoint?: boolean;
  }

  interface TriggerState {

  }

  export default class Trigger extends React.Component<TriggerProps, TriggerState> {
    close(): void;
  }
}
