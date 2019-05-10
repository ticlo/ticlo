declare module 'rc-trigger' {
  import React from 'react';

  interface TriggerProps {
    popup: React.ReactElement | (() => React.ReactElement);
    action: ('hover' | 'click' | 'focus' | 'contextMenu')[];
    popupAlign: any;
  }

  export default class Trigger extends React.Component<TriggerProps, any> {

  }
}