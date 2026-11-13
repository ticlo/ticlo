import React from 'react';
import {afterEach, expect, it} from 'vitest';
import {Flow, setSecretCipher} from '@ticlo/core';
import {shouldHappen} from '@ticlo/core/util/test-util.ts';
import {initBrowserSecretCipher} from '@ticlo/remote-storage';
import {AppTheme} from '../../../../app/AppHeader.tsx';
import {SecretPreferences} from '../../../../app/SecretPreferences.tsx';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';

afterEach(() => {
  removeLastTemplate();
  setSecretCipher(undefined);
});

it('positions the missing-secret notification in the viewport', async () => {
  loadTemplate(
    <AppTheme locale={undefined}>
      <SecretPreferences />
    </AppTheme>,
    'editor'
  );
  await initBrowserSecretCipher();
  const flow = new Flow();
  try {
    flow.createBlock('example')._load({'#secret': new Uint8Array([1, 2, 3])});
    const notice = (await shouldHappen(() => document.querySelector('.ant-notification-notice'), 2000)) as HTMLElement;
    const holder = notice.closest('.ant-notification') as HTMLElement;
    const rect = (await shouldHappen(() => {
      const bounds = notice.getBoundingClientRect();
      return getComputedStyle(holder).position === 'fixed' && bounds.right <= innerWidth && bounds;
    }, 2000)) as DOMRect;
    expect(holder.parentElement).toBe(document.body);
    expect(holder.style.getPropertyValue('--notification-top')).toBe('16px');
    expect(rect.top).toBeCloseTo(16, 0);
    expect(rect.right).toBeGreaterThan(innerWidth - 50);
    expect(rect.right).toBeLessThanOrEqual(innerWidth);
  } finally {
    flow.destroy();
  }
});
