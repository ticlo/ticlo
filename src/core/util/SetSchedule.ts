type ScheduleCallback = (actualTime?: number) => void;
const CHECK_INTERVAL = 60_000;

export class ScheduleEvent {
  #expire: number;
  constructor(
    public readonly callback: ScheduleCallback,
    public readonly start: number,
    expire: number = Infinity
  ) {
    this.#expire = expire;
  }
  cancel() {
    if (this.#expire !== -Infinity) {
      this.#expire = -Infinity;
      scheduleGroups.get(this.start)?.events.delete(this);
    }
  }
  run(current: number) {
    if (current < this.#expire) {
      this.callback(current);
    }
  }
}

export class ScheduleGroup {
  events = new Set<ScheduleEvent>();
  constructor(public readonly time: number) {}
  next: ScheduleGroup;
  prev: ScheduleGroup;

  static groups = new Map<number, ScheduleGroup>();

  static find(ms: number): ScheduleGroup {
    // align ms to next whole seconds
    const time = Math.ceil(ms / 1000) * 1000;
    if (ScheduleGroup.groups.has(time)) {
      return ScheduleGroup.groups.get(time);
    }
    const head = ScheduleGroup.head;
    const newGroup = new ScheduleGroup(time);
    ScheduleGroup.groups.set(time, newGroup);
    if (!(time >= head.next.time)) {
      // time is smaller or list is empty (compare to NaN)
      head.insertAfter(newGroup);
    } else {
      // search from the last one;
      let p = head.prev;
      while (time < p.time) {
        p = p.prev;
      }
      p.insertAfter(newGroup);
    }
    return newGroup;
  }

  insertAfter(g: ScheduleGroup) {
    this.next.prev = g;
    g.next = this.next;
    this.next = g;
    g.prev = this;
  }

  run(current: number) {
    if (current >= this.time) {
      for (const event of this.events) {
        event.run(current);
      }
      // remove the current group
      this.next.prev = this.prev;
      this.prev.next = this.next;
      ScheduleGroup.groups.delete(this.time);
      return this.next;
    }
    return null;
  }

  static run(current: number) {
    let p = ScheduleGroup.head.next;
    while ((p = p.run(current))) {}
  }
  static nextTime() {
    return ScheduleGroup.head.next.time;
  }

  static #initHead() {
    const head = new ScheduleGroup(NaN);
    head.prev = head;
    head.next = head;
    return head;
  }
  static readonly head = ScheduleGroup.#initHead();
  static reset() {
    const head = ScheduleGroup.head;
    head.prev = head;
    head.next = head;
    ScheduleGroup.groups.clear();
  }
}

const scheduleGroups = new Map<number, ScheduleGroup>();

let timeout: [any, number] = null;
function checkSchedule(expectedTime: number) {
  const current = new Date().getTime();
  timeout = null;
  ScheduleGroup.run(current);
  nextTimeout();
}
function nextTimeout() {
  const nextTime = ScheduleGroup.nextTime();
  // nextTime should not be NaN
  if (nextTime === nextTime) {
    if (timeout?.[1] > nextTime) {
      // clear previous timeout and create a new one at earlier time
      clearTimeout(timeout[0]);
      timeout = null;
    }
    if (!timeout) {
      const current = new Date().getTime();
      let delay = nextTime - current;
      if (delay > CHECK_INTERVAL) {
        // do not wait to long, in case of computer sleep/hibernate
        delay = CHECK_INTERVAL;
      }
      timeout = [setTimeout(checkSchedule, delay, current + delay), current + delay];
    }
  }
}

export function setSchedule(callback: ScheduleCallback, time: number, expire = Infinity) {
  if (!Number.isFinite(time)) {
    return null;
  }
  const current = new Date().getTime();
  if (time <= current) {
    callback(current);
    return null;
  }
  const event = new ScheduleEvent(callback, time, expire);
  ScheduleGroup.find(time).events.add(event);
  nextTimeout();
  return event;
}

export function setScheduledTimeout(callback: ScheduleCallback, delay: number) {
  return setSchedule(callback, new Date().getTime() + delay);
}
