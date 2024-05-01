import React, {createContext, KeyboardEventHandler, useCallback, useContext} from 'react';
import {Button} from 'antd';
import {DockLayout} from 'rc-dock';
import {TabData} from 'rc-dock/src/DockData';

export const DialogContext = createContext<{onClose?: () => void}>({});
const {Provider} = DialogContext;

interface Props {
  // return true to allow close
  onApply?: () => boolean;
  saveDisabled?: boolean;
  footerExtra?: React.ReactElement;
  children?: React.ReactNode;
  error?: string;
  onKeyDownCapture?: KeyboardEventHandler;
}

export function DockDialogPane(props: Props) {
  let {children, onApply, error, saveDisabled, footerExtra, onKeyDownCapture} = props;
  const {onClose} = useContext(DialogContext);
  const onOK = useCallback(() => {
    if (onApply()) {
      onClose();
    }
  }, [onApply, onClose]);

  return (
    <div className="ticl-dock-dialog" onKeyDownCapture={onKeyDownCapture}>
      {children}
      {error ? <div className="ticl-error-message">{error}</div> : null}
      <div className="ticl-box-footer">
        {footerExtra}
        <div className="ticl-spacer" />
        {onClose ? (
          <Button size="small" onClick={onClose}>
            Close
          </Button>
        ) : null}
        {onApply ? (
          <Button size="small" disabled={saveDisabled} onClick={onApply}>
            Apply
          </Button>
        ) : null}
        {onClose && onApply ? (
          <Button size="small" disabled={saveDisabled} onClick={onOK}>
            OK
          </Button>
        ) : null}
      </div>
    </div>
  );
}
let uniqueId = 0;
export function createDockDialog(
  layout: DockLayout,
  title: string,
  content: React.ReactElement,
  id?: string,
  options?: {preferredWidth: number; preferredHeight: number}
) {
  if (id) {
    // reuse the existing id if possible
    let oldTab = layout.find(id) as TabData;
    if (oldTab) {
      layout.dockMove(oldTab, null, 'front');
      return;
    }
  } else {
    uniqueId = (uniqueId + 1) % Number.MAX_SAFE_INTEGER;
    id = `float-${uniqueId}`;
  }

  const onClose = () => {
    let tab = layout.find(id) as TabData;
    if (tab) {
      layout.dockMove(tab, null, 'remove');
    }
  };
  const {preferredWidth, preferredHeight} = options;
  let w = preferredWidth || 500;
  let h = preferredHeight || 500;
  let {width, height} = layout.getLayoutSize();
  if (!width || !height) {
    return;
  }

  if (w > width) {
    w = width;
  }
  if (h > height) {
    h = height;
  }
  let x = (width - w) >> 1;
  let y = (height - h) >> 1;

  let newPanel = {
    activeId: id,
    tabs: [
      {
        id,
        closable: true,
        title,
        content: <Provider value={{onClose}}>{content}</Provider>,
      },
    ],
    x,
    y,
    w,
    h,
  };
  layout.dockMove(newPanel, null, 'float');
}
