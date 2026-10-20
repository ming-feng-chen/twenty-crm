import { describe, expect, it } from 'vitest';

import {
  CADENCE_HEALTH_OPTIONS,
  CADENCE_STAGE_OPTIONS,
  CADENCE_STATE_OPTIONS,
  cadenceHealth,
  cadenceStage,
  cadenceState,
  camelToUpperSnake,
  FIELD_OPTIONS,
  fromEngineChannel,
  GAP_UNIT_OPTIONS,
  isOptionValue,
  gapUnit,
  REQUIRED_DATA_OPTIONS,
  requiredData,
  STEP_GATE_OPTIONS,
  stepGate,
  TOUCH_CHANNEL_OPTIONS,
  TOUCH_DIRECTION_OPTIONS,
  TOUCH_OUTCOME_OPTIONS,
  touchDirection,
  touchOutcome,
  toEngineChannel,
  upperSnakeToCamel,
  WHEN_DATA_MISSING_OPTIONS,
  whenDataMissing,
} from 'src/constants/cadence-values';
import { DEFAULT_CADENCE_CONFIG } from 'src/engine';

describe('naming rule', () => {
  it.each([
    ['LINKEDIN_CONNECTION', 'linkedinConnection'],
    ['PROFILE_VIEW', 'profileView'],
    ['EMAIL', 'email'],
    ['ASKED_US_TO_STOP', 'askedUsToStop'],
    ['WHATS_APP', 'whatsApp'],
    ['WHATSAPP_GROUP', 'whatsappGroup'],
    // A part starting with a digit keeps its underscore, so the way back is
    // unambiguous: CHANNEL_2 and CHANNEL2 stay two channels.
    ['CHANNEL_2', 'channel_2'],
    ['CHANNEL2', 'channel2'],
    ['SMS_2FA_CODE', 'sms_2faCode'],
    ['A1_B2_C3', 'a1B2C3'],
    // After a one-letter part a capital would merge into it on the way back.
    ['PLAN_B_TEST', 'planB_test'],
    ['A_A_A', 'a_a_a'],
    ['A_AA', 'a_aa'],
  ])('%s <-> %s', (upper, camel) => {
    expect(upperSnakeToCamel(upper)).toBe(camel);
    expect(camelToUpperSnake(camel)).toBe(upper);
  });
});

describe('every option maps both ways', () => {
  const cases = [
    ['channel', TOUCH_CHANNEL_OPTIONS, { toEngine: toEngineChannel, fromEngine: fromEngineChannel }],
    ['direction', TOUCH_DIRECTION_OPTIONS, touchDirection],
    ['outcome', TOUCH_OUTCOME_OPTIONS, touchOutcome],
    ['stage', CADENCE_STAGE_OPTIONS, cadenceStage],
    ['health', CADENCE_HEALTH_OPTIONS, cadenceHealth],
    ['state', CADENCE_STATE_OPTIONS, cadenceState],
    ['gap unit', GAP_UNIT_OPTIONS, gapUnit],
    ['required data', REQUIRED_DATA_OPTIONS, requiredData],
    ['when data missing', WHEN_DATA_MISSING_OPTIONS, whenDataMissing],
    ['gate', STEP_GATE_OPTIONS, stepGate],
  ] as const;

  it.each(cases)('%s', (_name, options, lookup) => {
    for (const option of options) {
      expect(lookup.toEngine(option.value)).toBe(option.engine);
      expect(lookup.fromEngine(option.engine)).toBe(option.value);
    }

    expect(new Set(options.map((option) => option.value)).size).toBe(
      options.length,
    );
  });

  it('follows the naming rule for every engine literal it lists', () => {
    for (const [, options] of cases) {
      for (const option of options) {
        expect(upperSnakeToCamel(option.value)).toBe(option.engine);
      }
    }
  });
});

describe('SPEC §2 option lists', () => {
  it('offers exactly the touch channels the spec lists', () => {
    expect(TOUCH_CHANNEL_OPTIONS.map((option) => option.value)).toEqual([
      'LINKEDIN_CONNECTION',
      'LINKEDIN_MESSAGE',
      'INMAIL',
      'EMAIL',
      'CALL',
      'MEETING',
      'FOLLOW',
      'COMMENT',
      'LIKE',
      'PROFILE_VIEW',
      'WHATSAPP',
    ]);
  });

  it('offers exactly the stages, states and outcomes the spec lists', () => {
    expect(CADENCE_STAGE_OPTIONS.map((option) => option.value)).toEqual([
      'NOT_CONTACTED',
      'CONTACTED_NO_REPLY',
      'REPLIED_IN_CONVERSATION',
      'MEETING_SCHEDULED',
      'DECK_SENT',
      'DECK_REVIEWED_FOLLOW_UP',
      'PILOT_DISCUSSION',
      'PILOT_AGREED',
      'DEAD',
    ]);
    expect(CADENCE_STATE_OPTIONS.map((option) => option.value)).toEqual([
      'OPTED_OUT',
      'DEAD',
      'BOUNCED',
      'REPLY_OWED',
      'HOLD',
      'SNOOZED',
      'AWAITING_RESUME',
      'IN_CONVERSATION',
      'RUNNING',
    ]);
    expect(TOUCH_OUTCOME_OPTIONS.map((option) => option.value)).toEqual([
      'SENT',
      'DELIVERED',
      'REPLIED',
      'IGNORED',
      'BOUNCED',
      'ACCEPTED',
    ]);
  });

  it('maps every channel and outcome the default cadence uses to an option', () => {
    const channels = [
      ...DEFAULT_CADENCE_CONFIG.steps.map((step) => step.channel),
      DEFAULT_CADENCE_CONFIG.connectionRequest.channel,
      DEFAULT_CADENCE_CONFIG.bounce.channel,
      ...DEFAULT_CADENCE_CONFIG.nonAdvancingChannels,
      ...DEFAULT_CADENCE_CONFIG.conversationalChannels,
    ];
    const values = TOUCH_CHANNEL_OPTIONS.map((option) => option.value as string);

    for (const channel of channels) {
      expect(values).toContain(fromEngineChannel(channel));
    }

    expect(touchOutcome.fromEngine(DEFAULT_CADENCE_CONFIG.bounce.outcome)).toBe(
      'BOUNCED',
    );
    expect(
      touchOutcome.fromEngine(
        DEFAULT_CADENCE_CONFIG.connectionRequest.acceptedOutcome,
      ),
    ).toBe('ACCEPTED');
  });

  it('maps LIKE and PROFILE_VIEW to the engine default non-advancing channels', () => {
    expect(toEngineChannel('LIKE')).toBe('like');
    expect(toEngineChannel('PROFILE_VIEW')).toBe('profileView');
    expect(DEFAULT_CADENCE_CONFIG.nonAdvancingChannels).toEqual(
      expect.arrayContaining(['like', 'profileView']),
    );
  });

  it('builds field options with positions and keeps existing option ids', () => {
    expect(FIELD_OPTIONS.touchChannel[0]).toEqual({
      id: 'cda889c2-65b5-41af-b122-3d51def38295',
      value: 'LINKEDIN_CONNECTION',
      label: 'LinkedIn connection',
      color: 'blue',
      position: 0,
    });
    expect(FIELD_OPTIONS.touchChannel.map((option) => option.position)).toEqual(
      TOUCH_CHANNEL_OPTIONS.map((_, index) => index),
    );
  });
});

describe('unknown values', () => {
  it('converts an admin-added channel by naming rule', () => {
    expect(toEngineChannel('SMS_TEXT')).toBe('smsText');
    expect(fromEngineChannel('smsText')).toBe('SMS_TEXT');
    expect(toEngineChannel('WHATSAPP_GROUP')).toBe('whatsappGroup');
    expect(fromEngineChannel('whatsappGroup')).toBe('WHATSAPP_GROUP');
  });

  it('gives every built-in channel the key the naming rule gives it', () => {
    for (const option of TOUCH_CHANNEL_OPTIONS) {
      expect(upperSnakeToCamel(option.value)).toBe(option.engine);
    }
  });

  it('maps every value Twenty can hold to a key and back, and no two to one key', () => {
    // Every option value of up to three parts drawn from these, as Twenty
    // allows them (isSnakeCaseString).
    const parts = ['A', 'AB', 'X1', 'Z9Z', '1', '22', '3B', 'IN', 'MAIL', 'INMAIL'];
    const values = new Set<string>();

    for (const first of parts.filter((part) => /^[A-Z]/.test(part))) {
      values.add(first);

      for (const second of parts) {
        values.add(`${first}_${second}`);

        for (const third of parts) {
          values.add(`${first}_${second}_${third}`);
        }
      }
    }

    const keys = new Map<string, string>();

    for (const value of values) {
      expect(isOptionValue(value), value).toBe(true);

      const key = toEngineChannel(value);

      expect(key, value).not.toBeNull();
      expect(fromEngineChannel(key), value).toBe(value);
      expect(keys.get(key!), `${value} and ${keys.get(key!)}`).toBeUndefined();
      keys.set(key!, value);
    }

    expect(keys.size).toBe(values.size);
  });

  it('refuses what is not an option value, either way', () => {
    for (const value of ['email', 'Email', 'E-MAIL', 'A__B', '_A', 'A_', '1A', 'A B']) {
      expect(isOptionValue(value), value).toBe(false);
      expect(toEngineChannel(value), value).toBeNull();
    }

    // Keys no option value maps to.
    for (const key of ['Email', 'a__b', 'a_B', 'email_', '_email']) {
      expect(fromEngineChannel(key), key).toBeNull();
    }
  });

  it('returns null for missing or unknown closed-set values', () => {
    expect(toEngineChannel(null)).toBeNull();
    expect(toEngineChannel('')).toBeNull();
    expect(cadenceStage.toEngine('NOPE')).toBeNull();
    expect(cadenceStage.toEngine(undefined)).toBeNull();
  });
});
