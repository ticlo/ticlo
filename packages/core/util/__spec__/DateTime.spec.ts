import {DateTime} from 'luxon';
import * as DateTimeUtil from '../DateTime.ts';
import {
  addGlobalSettingsListener,
  getDefaultZone,
  getFirstDayOfWeek,
  getGlobalSettingsData,
  isWeekDay,
  removeGlobalSettingsListener,
  systemZone,
  updateGlobalSettings,
} from '../Settings.ts';
import {DataWrapper} from '../../block/FunctonData.ts';

describe('DateTime', () => {
  afterEach(() => {
    updateGlobalSettings();
  });
  describe('formatDate', () => {
    it('should format dates correctly', () => {
      const dt = DateTime.fromISO('2025-05-28T12:34:56');
      const formatted = DateTimeUtil.formatDate(dt, true);
      expect(formatted).toMatch(/2025-05-28 12:34:56/);
      expect(formatted).toContain('PDT'); // System is using Pacific Time
      expect(DateTimeUtil.formatDate(dt, false)).toBe('2025-05-28');

      const invalidDt = DateTimeUtil.invalidDate;
      expect(DateTimeUtil.formatDate(invalidDt, true)).toBe('invalid input');
    });
  });

  describe('isDateSame', () => {
    it('should compare dates correctly', () => {
      const dt1 = DateTime.fromISO('2025-05-28T12:34:56');
      const dt2 = DateTime.fromISO('2025-05-28T12:34:56');
      const dt3 = DateTime.fromISO('2025-05-28T12:34:56', {zone: 'America/New_York'});
      const dt4 = DateTime.fromISO('2025-05-28T12:34:57');

      expect(DateTimeUtil.isDateSame(dt1, dt2)).toBe(true);
      expect(DateTimeUtil.isDateSame(dt1, dt3)).toBe(false); // different zones
      expect(DateTimeUtil.isDateSame(dt1, dt4)).toBe(false); // different times

      const invalidDt1 = DateTimeUtil.invalidDate;
      const invalidDt2 = DateTime.invalid('different reason');
      expect(DateTimeUtil.isDateSame(invalidDt1, invalidDt1)).toBe(true);
      expect(DateTimeUtil.isDateSame(invalidDt1, invalidDt2)).toBe(false);
    });
  });

  describe('encode/decode', () => {
    it('should encode and decode dates correctly', () => {
      const dt = DateTime.fromISO('2025-05-28T12:34:56');
      const encoded = DateTimeUtil.encodeDateTime(dt);
      const decoded = DateTimeUtil.decodeDateTime(encoded);
      expect(DateTimeUtil.isDateSame(dt, decoded)).toBe(true);

      const dtWithZone = DateTime.fromISO('2025-05-28T12:34:56', {zone: 'America/New_York'});
      const encodedWithZone = DateTimeUtil.encodeDateTime(dtWithZone);
      expect(encodedWithZone).toContain('@America/New_York');
      const decodedWithZone = DateTimeUtil.decodeDateTime(encodedWithZone);
      expect(DateTimeUtil.isDateSame(dtWithZone, decodedWithZone)).toBe(true);

      const invalidDt = DateTimeUtil.invalidDate;
      const encodedInvalid = DateTimeUtil.encodeDateTime(invalidDt);
      expect(encodedInvalid).toBe('\bTs:!invalid input');
      const decodedInvalid = DateTimeUtil.decodeDateTime(encodedInvalid);
      expect(decodedInvalid.invalidReason).toBe('invalid input');
    });

    it('should handle DST correctly', () => {
      // Test a date in DST
      const dtDST = DateTime.fromISO('2025-06-28T12:34:56', {zone: 'America/New_York'});
      const encodedDST = DateTimeUtil.encodeDateTime(dtDST);
      expect(encodedDST).toContain('*');

      // Test a date not in DST
      const dtNoDST = DateTime.fromISO('2025-01-28T12:34:56', {zone: 'America/New_York'});
      const encodedNoDST = DateTimeUtil.encodeDateTime(dtNoDST);
      expect(encodedNoDST).not.toContain('*');
    });
  });

  describe('toDateTime', () => {
    it('should convert various inputs to DateTime', () => {
      // From number (timestamp)
      const timestamp = new Date('2025-05-28T12:34:56').getTime();
      const dtFromNumber = DateTimeUtil.toDateTime(timestamp);
      expect(dtFromNumber.toISO()).toMatch(/^2025-05-28T12:34:56/);

      // From string
      const dtFromString = DateTimeUtil.toDateTime('2025-05-28T12:34:56');
      expect(dtFromString.toISO()).toMatch(/^2025-05-28T12:34:56/);

      // From Date object
      const jsDate = new Date('2025-05-28T12:34:56');
      const dtFromDate = DateTimeUtil.toDateTime(jsDate);
      expect(dtFromDate.toISO()).toMatch(/^2025-05-28T12:34:56/);

      // Invalid input
      const invalidDt = DateTimeUtil.toDateTime('invalid');
      expect(invalidDt.invalidReason).toBeDefined();
    });

    it('should handle zones correctly', () => {
      const dtWithZone = DateTimeUtil.toDateTime('2025-05-28T12:34:56', 'America/New_York');
      expect(dtWithZone.zoneName).toBe('America/New_York');

      const dtWithSystemZone = DateTimeUtil.toDateTime('2025-05-28T12:34:56');
      expect(dtWithSystemZone.zoneName).toBeDefined();
    });

    it('resolves empty and special zones to default zone', () => {
      updateGlobalSettings(new DataWrapper({'#timezone': 'America/New_York'}));
      expect(getDefaultZone()).toBe('America/New_York');
      expect(DateTimeUtil.resolveZone('')).toBe('America/New_York');
      expect(DateTimeUtil.resolveZone(undefined)).toBe('America/New_York');
      expect(DateTimeUtil.resolveZone('Factory')).toBe('America/New_York');
      expect(DateTimeUtil.resolveZone('auto')).toBe('America/New_York');
      expect(DateTimeUtil.resolveZone('Invalid/Timezone')).toBe('America/New_York');
      expect(DateTimeUtil.resolveZone('UTC')).toBe('UTC');
      expect(DateTimeUtil.getZoneObject('')).toEqual({zone: 'America/New_York'});
    });

    it('round-trips encodeDateTime/decodeDateTime with server default zone', () => {
      updateGlobalSettings(new DataWrapper({'#timezone': 'America/New_York'}));
      const dtEast = DateTime.fromISO('2025-05-28T12:34:56', {zone: 'America/New_York'});
      const encoded = DateTimeUtil.encodeDateTime(dtEast);
      expect(encoded).not.toContain('@');
      const decoded = DateTimeUtil.decodeDateTime(encoded);
      expect(decoded.zoneName).toBe('America/New_York');
      expect(DateTimeUtil.isDateSame(dtEast, decoded)).toBe(true);
    });
  });

  describe('global settings sync', () => {
    it('round-trips getGlobalSettingsData into updateGlobalSettings and notifies listeners', () => {
      let notifications = 0;
      const listener = () => {
        notifications++;
      };
      addGlobalSettingsListener(listener);
      try {
        updateGlobalSettings(
          new DataWrapper({
            '#timezone': 'America/New_York',
            '#firstDayOfWeek': 1,
            '#weekDays': [1, 2, 3, 4],
          })
        );
        expect(notifications).toBe(1);
        const exported = getGlobalSettingsData();
        expect(exported).toEqual({
          '#timezone': 'America/New_York',
          '#firstDayOfWeek': 1,
          '#weekDays': [1, 2, 3, 4],
        });

        updateGlobalSettings();
        expect(getDefaultZone()).toBe(systemZone);
        expect(getFirstDayOfWeek()).toBe(7);
        expect(isWeekDay(5)).toBe(true);

        updateGlobalSettings(new DataWrapper(exported));
        expect(getDefaultZone()).toBe('America/New_York');
        expect(getFirstDayOfWeek()).toBe(1);
        expect(isWeekDay(5)).toBe(false);
        expect(isWeekDay(4)).toBe(true);
      } finally {
        removeGlobalSettingsListener(listener);
      }
    });

    it('ignores empty or invalid timezone in updateGlobalSettings', () => {
      updateGlobalSettings(new DataWrapper({'#timezone': ''}));
      expect(getDefaultZone()).toBe(systemZone);
      updateGlobalSettings(new DataWrapper({'#timezone': 'Invalid/Zone'}));
      expect(getDefaultZone()).toBe(systemZone);
    });
  });
});
