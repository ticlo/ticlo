import {message} from 'antd';
import type {ClientCallbacks} from '@ticlo/core/connect/ClientRequests.ts';

export const requestCallbacks: ClientCallbacks = {
  onError(error) {
    message.error(error);
  },
};
