import {ScheduleGroup, setSchedule, setScheduledTimeout} from '../SetSchedule';
import {CallbackLogger, shouldHappen} from '../test-util';

describe('Schedule', function () {
  beforeAll(function () {
    ScheduleGroup.reset();
  });
  it('add schedule', async function () {
    expect(ScheduleGroup.head.next).toBe(ScheduleGroup.head);

    const logger = new CallbackLogger();

    setSchedule(logger.log, 0);
    // callback should be run immediately
    expect(logger.logs[0]).toBeGreaterThan(0);
    // nothing to be run next time
    expect(ScheduleGroup.nextTime()).toBeNaN();

    const targetTime1 = new Date().getTime() + 1000;
    const alignedTime1 = Math.ceil(targetTime1 / 1000) * 1000;
    const targetTime2 = new Date().getTime() + 2000;
    const alignedTime2 = Math.ceil(targetTime2 / 1000) * 1000;
    const targetTime3 = new Date().getTime() + 3000;
    const alignedTime3 = Math.ceil(targetTime3 / 1000) * 1000;
    const targetTime4 = new Date().getTime() + 4000;
    const alignedTime4 = Math.ceil(targetTime4 / 1000) * 1000;

    logger.clear();
    // schedule it to run later
    setSchedule(logger.log, targetTime1);
    setSchedule(logger.log, targetTime4);
    setSchedule(logger.log, targetTime3, targetTime3 + 1);
    const listener = setSchedule(logger.log, targetTime3 + 1);
    setSchedule(logger.log, targetTime2);
    // time should not be changed
    expect(logger.logs).toEqual([]);
    expect(ScheduleGroup.nextTime()).toBe(alignedTime1);

    // run schedule 1 2
    ScheduleGroup.run(alignedTime2);
    expect(logger.logs).toEqual([alignedTime2, alignedTime2]);
    expect(ScheduleGroup.nextTime()).toBe(alignedTime3);

    // run schedule 3 4
    logger.clear();
    listener.cancel();
    ScheduleGroup.run(alignedTime4 + 1);
    // only run once, one should expire, one should be canceled
    expect(logger.logs).toEqual([alignedTime4 + 1]);
    expect(ScheduleGroup.nextTime()).toBeNaN();

    logger.clear();
    setScheduledTimeout(logger.log, 1);
    const currentTime = new Date().getTime();
    await shouldHappen(() => logger.logs.length && (logger.logs[0] as number) - currentTime < 2000, 1500);
  });
});
