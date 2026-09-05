import {describe, expect, it} from 'vitest';
import {globalFunctions} from '@ticlo/core';
import '../LogTime.js';

describe('LogTimeFunction', () => {
  it('declares its timestamp output as a number', () => {
    const [descriptor] = globalFunctions.getDescToSend('test:log-time');

    expect(descriptor.properties.find((property) => property.name === '#output')?.type).toBe('number');
  });
});
