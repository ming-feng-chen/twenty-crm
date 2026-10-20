import { describe, expect, it } from 'vitest';

import { DEFAULT_CADENCE_CONFIG } from '../default-cadence-config';
import { isReplyInCurrentRun, isTouchAtOrAfter, sequenceTouches, sortTouches } from '../touches';
import { contact, touch } from './fixtures';

const CONFIG = DEFAULT_CADENCE_CONFIG;
const timed = (time: string, direction: 'inbound' | 'outbound') => ({
  ...touch('2026-08-10', 'email', direction),
  occurredAtInstant: `2026-08-10T${time}:00Z`,
});

describe('precise reply ordering', () => {
  it('compares instants, including offsets, while retaining a single civil day', () => {
    const [sent, reply] = sortTouches([
      timed('14:00', 'inbound'),
      { ...timed('09:00', 'outbound'), occurredAtInstant: '2026-08-10T12:00:00+02:00' },
    ], CONFIG);

    expect(isTouchAtOrAfter(sent, reply)).toBe(false);
    expect(isTouchAtOrAfter(reply, sent)).toBe(true);
  });

  it('retains the legacy same-day rule when either time is unknown', () => {
    const [legacy] = sortTouches([touch('2026-08-10', 'email')], CONFIG);
    const [reply] = sortTouches([timed('14:00', 'inbound')], CONFIG);

    expect(isTouchAtOrAfter(legacy, reply)).toBe(true);
    expect(isTouchAtOrAfter(reply, legacy)).toBe(true);
  });

  it('preserves day-level sequence counting when the day contains a reply', () => {
    const sent = timed('09:00', 'outbound');
    const answer = timed('16:00', 'outbound');
    const sequence = sequenceTouches(contact(), [answer, timed('14:00', 'inbound'), sent], CONFIG);

    expect(sequence).toEqual([]);
  });
});

describe('start-fresh reply cutoff', () => {
  const subject = contact({ ownerSince: '2026-08-10', replyResetAt: '2026-08-10T12:00:00Z' });
  const counts = (value: ReturnType<typeof touch>) =>
    isReplyInCurrentRun(sortTouches([value], CONFIG)[0], subject, CONFIG);

  it('clears earlier and exactly-at-cutoff replies but retains later replies', () => {
    expect(counts(timed('09:00', 'inbound'))).toBe(false);
    expect(counts(timed('12:00', 'inbound'))).toBe(false);
    expect(counts(timed('14:00', 'inbound'))).toBe(true);
  });

  it('uses recording time only for manual replies without an exact occurrence time', () => {
    expect(counts({ ...touch('2026-08-10', 'linkedinMessage', 'inbound'), recordedAtInstant: '2026-08-10T14:00:00Z' })).toBe(true);
    expect(counts({ ...timed('09:00', 'inbound'), recordedAtInstant: '2026-08-10T14:00:00Z' })).toBe(false);
    expect(counts({ ...touch('2026-08-09', 'email', 'inbound'), recordedAtInstant: '2026-08-10T14:00:00Z' })).toBe(false);
  });

  it('clears date-only history on reset day without suppressing future days', () => {
    expect(counts(touch('2026-08-10', 'email', 'inbound'))).toBe(false);
    expect(counts(touch('2026-08-11', 'email', 'inbound'))).toBe(true);
  });
});
