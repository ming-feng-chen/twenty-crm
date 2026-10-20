import { describe, expect, it } from 'vitest';

import { type CadenceActionEntry } from 'src/ui/cadence-actions';
import {
  actionKind,
  actionLabel,
  describeTouch,
  isBackdatable,
  isPrimaryAction,
  OVERFLOW_ITEMS,
  stageLabel,
} from 'src/ui/labels';

const email = { channel: 'EMAIL', direction: 'OUTBOUND', outcome: null };
const entry = (
  action: string,
  touch: CadenceActionEntry['touch'] = email,
): CadenceActionEntry => ({ action, touch });

describe('actionLabel', () => {
  it('uses the old CRM wording for every action', () => {
    expect(
      [
        entry('didIt'),
        entry('theyAccepted', { channel: 'LINKEDIN_CONNECTION', direction: 'INBOUND', outcome: 'ACCEPTED' }),
        entry('theyReplied', { channel: 'EMAIL', direction: 'INBOUND', outcome: 'REPLIED' }),
        entry('sentInMail', { channel: 'INMAIL', direction: 'OUTBOUND', outcome: null }),
        entry('skipToNextStep'),
        entry('iReplied'),
        entry('iFollowedUp'),
        entry('resumeCadence', null),
        entry('addEmailAddress', null),
        entry('somethingElse', null),
      ].map(actionLabel),
    ).toEqual([
      'Did it',
      'They accepted',
      'They replied',
      'Sent InMail',
      'Skip to email',
      'I replied',
      'I followed up',
      'Resume cadence',
      'Add email address',
      'Something else',
    ]);
  });

  it('names where a skip lands when it is not email', () => {
    expect(
      actionLabel(entry('skipToNextStep', { channel: 'CALL', direction: 'OUTBOUND', outcome: null })),
    ).toBe('Skip to call');
  });

  it('humanises an action this UI does not know yet', () => {
    expect(actionLabel(entry('sentPostcard'))).toBe('Sent postcard');
  });
});

describe('actionKind', () => {
  it('maps each action to how it is carried out', () => {
    expect(actionKind(entry('didIt'))).toBe('logTouch');
    expect(actionKind(entry('theyReplied'))).toBe('logTouch');
    expect(actionKind(entry('skipToNextStep'))).toBe('logTouch');
    expect(actionKind(entry('resumeCadence', null))).toBe('resume');
    expect(actionKind(entry('addEmailAddress', null))).toBe('addEmail');
    expect(actionKind(entry('somethingElse', null))).toBe('somethingElse');
  });

  it('never makes a button that would write nothing', () => {
    expect(actionKind(entry('didIt', null))).toBe('unsupported');
    expect(actionKind(entry('somethingNew', null))).toBe('unsupported');
    expect(actionKind(entry('somethingNew'))).toBe('logTouch');
  });
});

describe('secondary controls', () => {
  it('lets the prescribed-step buttons be backdated', () => {
    expect(isBackdatable(entry('didIt'))).toBe(true);
    expect(isBackdatable(entry('iReplied'))).toBe(true);
    expect(isBackdatable(entry('iFollowedUp'))).toBe(true);
    expect(isBackdatable(entry('theyReplied'))).toBe(false);
    expect(isBackdatable(entry('didIt', null))).toBe(false);
  });

  it('marks Did it and I replied as the primary buttons', () => {
    expect(isPrimaryAction(entry('didIt'))).toBe(true);
    expect(isPrimaryAction(entry('iReplied'))).toBe(true);
    expect(isPrimaryAction(entry('theyReplied'))).toBe(false);
  });

  it('lists the overflow menu in the SPEC order', () => {
    expect(OVERFLOW_ITEMS.map((item) => item.label)).toEqual([
      'Snooze…',
      'Hold…',
      'Dead',
      'Opt out…',
      'Change owner…',
      'View',
    ]);
  });
});

describe('value labels', () => {
  it('labels stored values and humanises unknown ones', () => {
    expect(stageLabel('CONTACTED_NO_REPLY')).toBe('Contacted - no reply');
    expect(stageLabel('MEETING_SCHEDULED')).toBe('Meeting scheduled');
    expect(stageLabel(null)).toBe('—');
  });

  it('describes a touch', () => {
    expect(describeTouch({ channel: 'CALL', direction: 'INBOUND', outcome: 'REPLIED' })).toBe(
      'Call, inbound, replied',
    );
  });
});
