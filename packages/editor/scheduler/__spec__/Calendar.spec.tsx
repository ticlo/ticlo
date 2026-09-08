import {afterEach, expect, it, vi} from 'vitest';
import React from 'react';
import {DateTime} from 'luxon';
import {Calendar, luxonLocalizer} from 'ticlo-big-calendar';
import type {View} from 'ticlo-big-calendar';
import {shouldHappen} from '@ticlo/core/util/test-util.js';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.js';

afterEach(removeLastTemplate);

it.each<View>(['day', 'week', 'month'])('renders and selects calendar events in %s view', async (view) => {
  const start = DateTime.fromISO('2026-09-08T10:00:00');
  const event = {title: 'Scheduled event', start, end: start.plus({hours: 1})};
  const onSelectEvent = vi.fn();
  const [, div] = loadTemplate(
    <Calendar
      localizer={luxonLocalizer(DateTime)}
      date={start}
      view={view}
      events={[event]}
      onSelectEvent={onSelectEvent}
      selectable
      popup
    />,
    'editor'
  );
  await shouldHappen(() => div.querySelector('.rbc-event'));
  const element = div.querySelector<HTMLElement>('.rbc-event');
  expect(element.textContent).toContain('Scheduled event');
  element.click();
  expect(onSelectEvent).toHaveBeenCalledWith(event, expect.anything());
});
