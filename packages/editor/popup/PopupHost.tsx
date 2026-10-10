import React, {useCallback, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {message, Modal, notification} from 'antd';
import type {ClientCallbacks} from '@ticlo/core/connect/ClientRequests.ts';

export interface PopupActions {
  message: ReturnType<typeof message.useMessage>[0];
  notification: ReturnType<typeof notification.useNotification>[0];
  modal: ReturnType<typeof Modal.useModal>[0];
  showModal: (component: React.ReactElement | null) => void;
  requestCallbacks: ClientCallbacks;
}

export function usePopups() {
  const [messageApi, messageHolder] = message.useMessage();
  const [notificationApi, notificationHolder] = notification.useNotification();
  const [modalApi, modalHolder] = Modal.useModal();
  const [dialog, setDialog] = useState<React.ReactElement | null>(null);
  const key = useRef(0);
  const showModal = useCallback((component: React.ReactElement | null) => {
    setDialog(component ? React.cloneElement(component, {key: ++key.current}) : null);
  }, []);
  const actions = useMemo<PopupActions>(
    () => ({
      message: messageApi,
      notification: notificationApi,
      modal: modalApi,
      showModal,
      requestCallbacks: {
        onError: (error) => {
          void messageApi.error(error);
        },
      },
    }),
    [messageApi, notificationApi, modalApi, showModal]
  );
  return [
    actions,
    <>
      {messageHolder}
      {notificationHolder}
      {modalHolder}
      {dialog}
    </>,
  ] as const;
}

export function PopupHost({ref}: {ref: React.Ref<PopupActions>}) {
  const [actions, holder] = usePopups();
  useImperativeHandle(ref, () => actions, [actions]);
  return holder;
}
