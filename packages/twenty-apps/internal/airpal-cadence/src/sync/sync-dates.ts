import { toCivilDate } from 'src/engine';

const DATE_ONLY = /^(\d{4}-\d{2}-\d{2})/;

const toInstant = (value: string | null | undefined): Date | null => {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const instant = new Date(value);

  return Number.isNaN(instant.getTime()) ? null : instant;
};

// A message's day: the civil date of its receivedAt in the cadence time zone
// (Gmail's receivedAt is the time Gmail received it, or sent it for our own
// mail). Null when there is no usable timestamp.
export const civilDateOf = (
  timestamp: string | null | undefined,
  timeZone: string,
): string | null => {
  const instant = toInstant(timestamp);

  return instant === null ? null : toCivilDate(instant, timeZone);
};

// A calendar event's day. Timed events: the civil date of the start in the
// cadence time zone. All-day events carry a date, not an instant (Twenty
// stores Google's "2026-10-20" as midnight UTC), so their day is that date
// whatever the time zone.
export const eventDateOf = (
  event: { startsAt: string | null | undefined; isFullDay: boolean | null | undefined },
  timeZone: string,
): string | null => {
  if (event.isFullDay === true) {
    const match =
      typeof event.startsAt === 'string' ? DATE_ONLY.exec(event.startsAt) : null;

    return match === null || toInstant(event.startsAt) === null ? null : match[1];
  }

  return civilDateOf(event.startsAt, timeZone);
};

// Has the meeting begun? Timed: its start is at or before now. All-day: its
// day is today or earlier in the cadence time zone.
export const hasEventStarted = (
  event: { startsAt: string | null | undefined; isFullDay: boolean | null | undefined },
  { now, today, timeZone }: { now: Date; today: string; timeZone: string },
): boolean => {
  if (event.isFullDay === true) {
    const day = eventDateOf(event, timeZone);

    return day !== null && day <= today;
  }

  const start = toInstant(event.startsAt);

  return start !== null && start.getTime() <= now.getTime();
};
