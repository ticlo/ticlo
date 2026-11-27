import {afterEach, expect, it, vi} from 'vitest';
import React from 'react';
import {DateTime} from 'luxon';
import {Calendar, luxonLocalizer} from 'ticlo-big-calendar';
import type {View} from 'ticlo-big-calendar';
import {shouldHappen, waitTick} from '@ticlo/core/util/test-util.ts';
import {loadTemplate, removeLastTemplate} from '../../util/test-util.ts';
import {Root} from '@ticlo/core';
import {destroyLastLocalConnection, makeLocalConnection} from '@ticlo/core/connect/LocalConnection.ts';
import {updateGlobalSettings} from '@ticlo/core/util/Settings.ts';
import {DataWrapper} from '@ticlo/core/block/FunctonData.ts';
import {ScheduleLoader} from '../ScheduleLoader.tsx';
import {CalendarEventEditor} from '../CalendarEventEditor.tsx';
import {TimeRangeEditor} from '../editors/TimeRange.tsx';
import {AdvancedSelector} from '../editors/AdvancedSelector.tsx';

afterEach(() => {
  removeLastTemplate();
  destroyLastLocalConnection();
  updateGlobalSettings();
  Root.instance.deleteValue('testCalendarFlow');
});

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

it('ScheduleLoader resolves empty timezone to server default zone and handles eventsLen before timezone', async () => {
  updateGlobalSettings(new DataWrapper({'#timezone': 'America/New_York'}));
  const flow = Root.instance.addFlow('testCalendarFlow');
  const sched = flow.createBlock('sched');
  sched.setValue('#is', 'scheduler');
  sched.setValue('timezone', '');
  sched.setValue('[]', 1);
  sched.setValue('config0', {repeat: 'daily', start: '0:0', duration: 0});
  sched.setValue('value0', 'allday');
  Root.run();

  const [, client] = makeLocalConnection(Root.instance);
  await waitTick(20);

  let forceUpdates = 0;
  const loader = new ScheduleLoader({forceUpdate: () => forceUpdates++}, client, 'testCalendarFlow.sched');
  try {
    await shouldHappen(() => loader.subs.length === 1 && loader.subs[0].event != null);
    expect(loader.zone).toBe('America/New_York');
    const startMs = DateTime.fromISO('2026-09-08T00:00:00', {zone: 'America/New_York'}).valueOf();
    const endMs = DateTime.fromISO('2026-09-08T23:59:59.999', {zone: 'America/New_York'}).valueOf();
    const events = loader.getEvents(startMs, endMs);
    expect(events.length).toBe(1);
    expect(events[0].allDay).toBe(true);
    expect(events[0].start.zoneName).toBe('America/New_York');

    // Simulate eventsLen arriving before timezoneSub
    loader.zoneReady = false;
    loader.subs.forEach((s) => s.destroy());
    loader.subs = [];
    loader.length = undefined;
    loader.updateEventLength(1);
    expect(loader.subs.length).toBe(0);
    loader.updateZone('UTC');
    expect(loader.subs.length).toBe(1);
    expect(loader.zone).toBe('UTC');
  } finally {
    loader.destroy();
  }
});

it('CalendarEventEditor preserves priority=0', async () => {
  const flow = Root.instance.addFlow('testCalendarFlow');
  const sched = flow.createBlock('sched');
  sched.setValue('#is', 'scheduler');
  const [, client] = makeLocalConnection(Root.instance);

  const updates: any[] = [];
  const [, div] = loadTemplate(
    <CalendarEventEditor
      conn={client}
      path="testCalendarFlow.sched"
      index={0}
      zone="America/New_York"
      config={{repeat: 'daily', start: '9:0', duration: 60, priority: 1}}
      onChange={(cfg) => updates.push(cfg)}
    />,
    'editor'
  );
  await shouldHappen(() => div.querySelector('.ticl-e-property-divider .ticl-e-tree-arr'));
  div.querySelector<HTMLElement>('.ticl-e-property-divider .ticl-e-tree-arr').click();
  await shouldHappen(() => div.querySelector('.ticl-e-number-input button'));
  // Click the minus button to decrement priority from 1 to 0
  div.querySelector<HTMLButtonElement>('.ticl-e-number-input button').click();
  await shouldHappen(() => updates.length > 0);
  expect(updates.at(-1).priority).toBe(0);
});

it('TimeRangeEditor renders valid TimePicker and preserves unit M when duration is 60', async () => {
  const trUpdates: any[] = [];
  const [, trDiv] = loadTemplate(
    <TimeRangeEditor current={{start: '9:0', duration: 60}} onChange={(v) => trUpdates.push(v)} />,
    'editor'
  );
  await shouldHappen(() => trDiv.querySelector('.ant-input-number-input'));
  const input = trDiv.querySelector<HTMLInputElement>('.ant-input-number-input');
  expect(input.value).toBe('1');
  const timeInput = trDiv.querySelector<HTMLInputElement>('.ticl-e-date-editor input');
  expect(timeInput.value).toBe('09:00');
});

it('AdvancedSelector updates days and clears range atomically', async () => {
  const advUpdates: any[] = [];
  const [, advDiv] = loadTemplate(
    <AdvancedSelector
      current={{repeat: 'advanced', start: '9:0', duration: 60, days: [1, 10], range: true}}
      onValuesChange={(v, full) => advUpdates.push({v, full})}
    />,
    'editor'
  );
  await shouldHappen(() => advDiv.querySelector('input[type="checkbox"]'));
  const checkbox = advDiv.querySelector<HTMLInputElement>('input[type="checkbox"]');
  expect(checkbox.checked).toBe(true);
  const addBtn = advDiv.querySelector<HTMLButtonElement>('button');
  addBtn.click();
  expect(advUpdates.length).toBe(1);
  expect(advUpdates[0].full).toBe(true);
  expect(advUpdates[0].v.days).toEqual([1, 10, '1>1']);
  expect(advUpdates[0].v.range).toBeUndefined();
});
