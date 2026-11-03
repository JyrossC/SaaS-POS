import { BadRequestException } from '@nestjs/common';

export const BUSINESS_TIME_ZONE = 'Africa/Dar_es_Salaam';

const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const businessDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function getBusinessDateInputValue(date = new Date()) {
  const parts = businessDateFormatter.formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getBusinessMidnightUtc(date: string) {
  const utcGuess = new Date(`${date}T00:00:00.000Z`);
  const parts = businessDateTimeFormatter.formatToParts(utcGuess);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
  const localTimeAsUtc = Date.UTC(
    values.year,
    values.month - 1,
    values.day,
    values.hour,
    values.minute,
    values.second,
  );
  return new Date(utcGuess.getTime() - (localTimeAsUtc - utcGuess.getTime()));
}

export function getBusinessDateRange(startDate: string, endDate: string) {
  const validDate = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(new Date(`${value}T00:00:00.000Z`).getTime()) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
  if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
    throw new BadRequestException('Report date range must contain valid, ordered calendar dates.');
  }

  const nextDay = new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const exclusiveEnd = getBusinessMidnightUtc(nextDay);
  return {
    start: getBusinessMidnightUtc(startDate),
    end: new Date(exclusiveEnd.getTime() - 1),
  };
}
