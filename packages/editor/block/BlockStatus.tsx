import React from 'react';
import {Popover} from 'antd';
import {ErrorEvent, encodeDisplay, stopPropagation} from '@ticlo/core';
import type {ClientConn} from '@ticlo/core/editor.ts';
import {useConnectionValue} from '../component/useConnectionValue.ts';
import {t} from '../component/LocalizedLabel.tsx';

function selectError(value: unknown): ErrorEvent | undefined {
  return value instanceof ErrorEvent ? value : undefined;
}

export const BlockStatus = React.memo(function BlockStatus({conn, path}: {conn: ClientConn; path: string}) {
  const error = useConnectionValue(conn, `${path}.#emit`, selectError);
  const waiting = useConnectionValue(conn, `${path}.#wait`, Boolean);
  if (!error && !waiting) return null;

  const type = !error || error.type === ErrorEvent.defaultType ? t('Error') : error.type;
  const message =
    error?.detail instanceof Error
      ? error.detail.message
      : error?.detail == null
        ? ''
        : typeof error.detail === 'string'
          ? error.detail
          : encodeDisplay(error.detail);
  return (
    <span
      className="ticl-e-block-status"
      onMouseDown={stopPropagation}
      onDoubleClick={stopPropagation}
      onClick={stopPropagation}
    >
      {error ? (
        <Popover
          title={type}
          content={<div className="ticl-e-block-error-message">{message}</div>}
          trigger="click"
          placement="bottomLeft"
        >
          <span className="ticl-e-block-error">!</span>
        </Popover>
      ) : null}
      {waiting ? <span className="ticl-e-block-wait">⏳︎</span> : null}
    </span>
  );
});
