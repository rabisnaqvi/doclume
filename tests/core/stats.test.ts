import { estimateReadingTime } from '@doclume/core';

describe('estimateReadingTime', () => {
  it('counts words and keeps the minimum at one minute', () => {
    expect(estimateReadingTime('one two three')).toEqual({ words: 3, minutes: 1 });
  });
});
