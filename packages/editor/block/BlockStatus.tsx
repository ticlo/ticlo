import React from 'react';
import {ExclamationCircleFilled, HourglassFilled, WarningFilled} from '@ant-design/icons';
import {Popover} from 'antd';
import {ErrorEvent, WarningEvent, encodeDisplay, stopPropagation} from '@ticlo/core';
import type {ClientConn} from '@ticlo/core/editor.ts';
import {useConnectionValue} from '../component/useConnectionValue.ts';
import {t} from '../component/LocalizedLabel.tsx';

function selectStatus(value: unknown): ErrorEvent | WarningEvent | undefined {
  return value instanceof ErrorEvent || value instanceof WarningEvent ? value : undefined;
}

export const BlockStatus = React.memo(function BlockStatus({conn, path}: {conn: ClientConn; path: string}) {
  const status = useConnectionValue(conn, `${path}.#emit`, selectStatus);
  const waiting = useConnectionValue(conn, `${path}.#wait`, Boolean);
  if (!status && !waiting) return null;

  const error = status instanceof ErrorEvent;
  let title: React.ReactNode = status?.type;
  if (error && title === ErrorEvent.defaultType) title = t('Error');
  if (!error && title === WarningEvent.OutOfSync) title = 'Out of sync';
  const detail = error ? status.detail : undefined;
  const message =
    detail == null
      ? ''
      : detail instanceof Error
        ? detail.message
        : typeof detail === 'string'
          ? detail
          : encodeDisplay(detail);
  return (
    <span
      className="ticl-e-block-status"
      onMouseDown={stopPropagation}
      onDoubleClick={stopPropagation}
      onClick={stopPropagation}
    >
      {status ? (
        <Popover
          title={title}
          content={message ? <div className="ticl-e-block-error-message">{message}</div> : undefined}
          trigger="click"
          placement="bottomLeft"
        >
          {error ? (
            <ExclamationCircleFilled className="ticl-e-block-error" />
          ) : (
            <WarningFilled className="ticl-e-block-warning" />
          )}
        </Popover>
      ) : null}
      {waiting ? <HourglassFilled className="ticl-e-block-wait" /> : null}
    </span>
  );
});
