import { estimateReadingTime } from '../../packages/core/src/stats.js';

describe('estimateReadingTime', () => {
  it('counts words and keeps the minimum at one minute', () => {
    expect(estimateReadingTime('one two three')).toEqual({ words: 3, minutes: 1 });
  });
});
