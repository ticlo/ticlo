import {expect} from 'vitest';
import {ScheduleEvent} from '../ScheduleEvent';

describe('ScheduleEvent', function () {
  it('parse', function () {
    const event = ScheduleEvent.fromProperty({repeat: 'daily', start: [1, 23]});
    expect(event.repeat).toBe('daily');
    expect(event.start).toEqual([1, 23]);
  });

  it('parse invalid', function () {
    const event = ScheduleEvent.fromProperty({repeat: 'daily', start: [99, 23]});
    expect(event).toBeNull();
  });
});
