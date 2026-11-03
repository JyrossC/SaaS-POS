import { BadRequestException } from '@nestjs/common';
import { getBusinessDateInputValue, getBusinessDateRange } from './business-time';

describe('business-time utilities', () => {
  it('formats calendar dates in the configured Tanzania timezone', () => {
    expect(getBusinessDateInputValue(new Date('2026-11-01T22:00:00.000Z'))).toBe('2026-11-02');
  });

  it('converts inclusive business dates into exact UTC boundaries', () => {
    expect(getBusinessDateRange('2026-11-02', '2026-11-02')).toEqual({
      start: new Date('2026-11-01T21:00:00.000Z'),
      end: new Date('2026-11-02T20:59:59.999Z'),
    });
  });

  it('rejects invalid or reversed calendar dates', () => {
    expect(() => getBusinessDateRange('2026-02-30', '2026-03-01')).toThrow(BadRequestException);
    expect(() => getBusinessDateRange('2026-11-03', '2026-11-02')).toThrow(BadRequestException);
  });
});
