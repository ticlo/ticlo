import {LazyUpdateSubscriber} from '../LazyUpdateComponent.tsx';

describe('LazyUpdateSubscriber', () => {
  it('publishes value and binding changes together', () => {
    const updates: unknown[] = [];
    const subscriber = new LazyUpdateSubscriber((value: any) => {
      updates.push([value, subscriber.bindingPath, subscriber.error]);
    });

    subscriber.onError('unavailable');
    updates.length = 0;
    subscriber.onUpdate({cache: {value: 42, bindingPath: 'source'}});

    expect(updates).toEqual([[42, 'source', null]]);
    subscriber.onUpdate({cache: {value: 42, bindingPath: 'source', hasListener: true}});
    expect(updates).toHaveLength(1);
  });

  it('notifies when an error clears even if the value and binding are unchanged', () => {
    const errors: string[] = [];
    const subscriber = new LazyUpdateSubscriber(() => errors.push(subscriber.error));
    subscriber.onUpdate({cache: {value: 42}});
    subscriber.onError('unavailable');
    subscriber.onError('unavailable');
    subscriber.onUpdate({cache: {value: 42}});

    expect(errors).toEqual([null, 'unavailable', null]);
  });

  it('preserves default values and Object.is comparisons', () => {
    let updates = 0;
    const subscriber = new LazyUpdateSubscriber(() => ++updates, 10);
    subscriber.onUpdate({cache: {value: undefined}});
    expect(subscriber.value).toBe(10);
    expect(updates).toBe(0);

    subscriber.onUpdate({cache: {value: NaN}});
    subscriber.onUpdate({cache: {value: NaN}});
    expect(updates).toBe(1);
    subscriber.onUpdate({cache: {value: 0}});
    subscriber.onUpdate({cache: {value: -0}});
    expect(updates).toBe(3);
  });
});
