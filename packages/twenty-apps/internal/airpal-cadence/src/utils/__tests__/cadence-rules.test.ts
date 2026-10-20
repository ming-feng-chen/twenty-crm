import { describe, expect, it } from 'vitest';

import { BUILT_IN_TOUCH_CHANNEL_OPTIONS } from 'src/utils/touch-channels';
import { DEFAULT_CADENCE_CONFIG } from 'src/engine';
import { selectActiveConfig } from 'src/utils/active-config';
import {
  buildRulesSnapshot,
  type CadenceRules,
  channelsOfRules,
  configFromRules,
  DEFAULT_CADENCE_RULES,
  normalizeCadenceRules,
  parseRulesSnapshot,
  rulesFromConfig,
  rulesFromRecords,
} from 'src/utils/cadence-rules';
import { describeRulesChange } from 'src/utils/describe-rules-change';

const CADENCE_ID = 'cadence-1';

const withStep = (
  rules: CadenceRules,
  index: number,
  changes: Partial<CadenceRules['steps'][number]>,
): CadenceRules => ({
  ...rules,
  steps: rules.steps.map((step, stepIndex) =>
    stepIndex === index ? { ...step, ...changes } : step,
  ),
});

describe('default rules', () => {
  it('are the engine default cadence in Twenty values', () => {
    expect(DEFAULT_CADENCE_RULES).toEqual({
      touchChannels: BUILT_IN_TOUCH_CHANNEL_OPTIONS,
      name: 'Outreach cadence',
      timeZone: 'Europe/London',
      skipWeekends: true,
      strikeSilenceGapAmount: 3,
      strikeSilenceGapUnit: 'BUSINESS_DAYS',
      strikeLimit: 3,
      acceptanceTimeoutAmount: 14,
      acceptanceTimeoutUnit: 'CALENDAR_DAYS',
      nonAdvancingChannels: ['FOLLOW', 'COMMENT', 'LIKE', 'PROFILE_VIEW'],
      inMailChannel: 'INMAIL',
      steps: [
        {
          key: 'connectionRequest',
          label: 'Connection request',
          channel: 'LINKEDIN_CONNECTION',
          repeat: 1,
          gapBeforeAmount: 3,
          gapBeforeUnit: 'BUSINESS_DAYS',
          occurrenceNoun: null,
          requiredData: 'LINKEDIN_URL',
          whenDataMissing: 'SKIP',
          gate: null,
        },
        {
          key: 'linkedinMessage',
          label: 'LinkedIn message',
          channel: 'LINKEDIN_MESSAGE',
          repeat: 2,
          gapBeforeAmount: 3,
          gapBeforeUnit: 'BUSINESS_DAYS',
          occurrenceNoun: null,
          requiredData: 'LINKEDIN_URL',
          whenDataMissing: 'SKIP',
          gate: 'LINKEDIN_ACCEPTED',
        },
        {
          key: 'email',
          label: 'Email',
          channel: 'EMAIL',
          repeat: 7,
          gapBeforeAmount: 3,
          gapBeforeUnit: 'BUSINESS_DAYS',
          occurrenceNoun: null,
          requiredData: 'EMAIL',
          whenDataMissing: 'BLOCK',
          gate: null,
        },
        {
          key: 'drip',
          label: 'Drip',
          channel: 'EMAIL',
          repeat: null,
          gapBeforeAmount: 30,
          gapBeforeUnit: 'CALENDAR_DAYS',
          occurrenceNoun: 'email',
          requiredData: 'EMAIL',
          whenDataMissing: 'BLOCK',
          gate: null,
        },
      ],
    });
  });

  it('load back into exactly the engine default config', () => {
    const result = configFromRules(DEFAULT_CADENCE_RULES, CADENCE_ID);

    expect(result.errors).toEqual([]);
    expect(result.config).toEqual({ ...DEFAULT_CADENCE_CONFIG, id: CADENCE_ID });
  });

  it('round-trip through rulesFromConfig', () => {
    const { config } = configFromRules(DEFAULT_CADENCE_RULES, CADENCE_ID);

    expect(config).not.toBeNull();
    expect(rulesFromConfig(config!)).toEqual(DEFAULT_CADENCE_RULES);
  });
});

describe('configFromRules', () => {
  it('reads an empty repeat as for ever and drops a blank occurrence noun', () => {
    const rules = withStep(DEFAULT_CADENCE_RULES, 3, { occurrenceNoun: null });
    const { config } = configFromRules(rules, CADENCE_ID);

    expect(config?.steps[3]).toEqual({
      key: 'drip',
      label: 'Drip',
      channel: 'email',
      repeat: 'forever',
      gapBefore: { amount: 30, unit: 'calendarDays' },
      requiredData: 'email',
      whenDataMissing: 'block',
    });
  });

  it('applies a changed gap', () => {
    const rules = withStep(DEFAULT_CADENCE_RULES, 2, { gapBeforeAmount: 5 });

    expect(configFromRules(rules, CADENCE_ID).config?.steps[2].gapBefore).toEqual(
      { amount: 5, unit: 'businessDays' },
    );
  });

  it.each([
    ['a forever step before the end', withStep(DEFAULT_CADENCE_RULES, 1, { repeat: null }), /must be the last step/],
    ['a missing gap', withStep(DEFAULT_CADENCE_RULES, 2, { gapBeforeAmount: null }), /whole number/],
    ['a negative gap', withStep(DEFAULT_CADENCE_RULES, 2, { gapBeforeAmount: -1 }), /negative/],
    ['an unknown unit', withStep(DEFAULT_CADENCE_RULES, 2, { gapBeforeUnit: 'FORTNIGHTS' }), /unknown unit "FORTNIGHTS"/],
    ['a missing channel', withStep(DEFAULT_CADENCE_RULES, 2, { channel: null }), /needs a channel/],
    ['duplicate keys', withStep(DEFAULT_CADENCE_RULES, 2, { key: 'drip' }), /Two steps use the key "drip"/],
    ['an unknown gate', withStep(DEFAULT_CADENCE_RULES, 1, { gate: 'NOPE' }), /unknown gate "NOPE"/],
    ['an occurrence noun on a counted step', withStep(DEFAULT_CADENCE_RULES, 2, { occurrenceNoun: 'email' }), /./],
  ])('rejects %s', (_name, rules, message) => {
    const result = configFromRules(rules, CADENCE_ID);

    expect(result.config).toBeNull();
    expect(result.errors.join(' ')).toMatch(message);
  });

  it('rejects a bad time zone and a zero strike limit', () => {
    const result = configFromRules(
      { ...DEFAULT_CADENCE_RULES, timeZone: 'Mars/Olympus', strikeLimit: 0 },
      CADENCE_ID,
    );

    expect(result.config).toBeNull();
    expect(result.errors.join(' ')).toMatch(/not a known time zone/);
    expect(result.errors.join(' ')).toMatch(/strike limit/);
  });

  it('passes extra errors through', () => {
    expect(
      configFromRules(DEFAULT_CADENCE_RULES, CADENCE_ID, ['order unknown']).errors,
    ).toEqual(['order unknown']);
  });
});

describe('channels and the live touch channel options (SPEC §2)', () => {
  const BUILT_IN = [
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
  ];
  const WITH_GROUP = [...BUILT_IN, 'WHATSAPP_GROUP'];
  const groupStep = {
    key: 'whatsappGroup',
    label: 'WhatsApp group',
    channel: 'WHATSAPP_GROUP',
    repeat: 1,
    gapBeforeAmount: 2,
    gapBeforeUnit: 'BUSINESS_DAYS',
    occurrenceNoun: null,
    requiredData: null,
    whenDataMissing: null,
    gate: null,
  };
  const withGroupStep: CadenceRules = {
    ...DEFAULT_CADENCE_RULES,
    steps: [...DEFAULT_CADENCE_RULES.steps.slice(0, 3), groupStep, DEFAULT_CADENCE_RULES.steps[3]],
  };
  const NOT_OFFERED =
    "is not in the outreach channel list. Add it on the Cadence rules page first.";

  it('accepts the default rules against the built-in options', () => {
    expect(configFromRules(DEFAULT_CADENCE_RULES, CADENCE_ID, [], BUILT_IN).errors).toEqual([]);
  });

  it('accepts an admin-added channel the field offers, as a stable engine key', () => {
    const result = configFromRules(withGroupStep, CADENCE_ID, [], WITH_GROUP);

    expect(result.errors).toEqual([]);
    expect(result.config?.steps[3].channel).toBe('whatsappGroup');
    expect(rulesFromConfig(result.config!)).toEqual(withGroupStep);
  });

  it('refuses a step channel the field does not offer, next to the step', () => {
    const result = configFromRules(withGroupStep, CADENCE_ID, [], BUILT_IN);

    expect(result.config).toBeNull();
    expect(result.errors).toEqual([`Step 4 ("WhatsApp group"): "WHATSAPP_GROUP" ${NOT_OFFERED}`]);
  });

  it('refuses non-advancing and InMail channels the field does not offer', () => {
    const result = configFromRules(
      { ...DEFAULT_CADENCE_RULES, nonAdvancingChannels: ['FOLLOW', 'REACTION'], inMailChannel: 'SALES_NAV' },
      CADENCE_ID,
      [],
      BUILT_IN,
    );

    expect(result.config).toBeNull();
    expect(result.errors).toEqual([
      `The InMail channel: "SALES_NAV" ${NOT_OFFERED}`,
      `Non-advancing channels: "REACTION" ${NOT_OFFERED}`,
    ]);
  });

  it('refuses a value the field could never hold, with or without the live list', () => {
    for (const touchChannels of [undefined, BUILT_IN]) {
      const result = configFromRules(
        withStep(DEFAULT_CADENCE_RULES, 2, { channel: 'email' }),
        CADENCE_ID,
        [],
        touchChannels,
      );

      expect(result.config).toBeNull();
      expect(result.errors.join(' ')).toContain(
        'Step 3 ("Email"): "email" is not a channel value (UPPER_SNAKE_CASE',
      );
    }
  });

  it('requires a custom channel in the managed list', () => {
    expect(configFromRules(withGroupStep, CADENCE_ID).errors.join(' ')).toContain('WHATSAPP_GROUP');
    expect(configFromRules({ ...withGroupStep, touchChannels: [...BUILT_IN_TOUCH_CHANNEL_OPTIONS, { value: 'WHATSAPP_GROUP', label: 'WhatsApp group' }] }, CADENCE_ID).errors).toEqual([]);
  });

  it('reads the InMail channel into the engine config, and refuses none', () => {
    expect(
      configFromRules(DEFAULT_CADENCE_RULES, CADENCE_ID).config?.connectionRequest.inMailChannel,
    ).toBe('inmail');
    expect(
      configFromRules(
        { ...DEFAULT_CADENCE_RULES, inMailChannel: 'LINKEDIN_IN_MAIL' },
        CADENCE_ID,
        [],
        [...BUILT_IN, 'LINKEDIN_IN_MAIL'],
      ).config?.connectionRequest.inMailChannel,
    ).toBe('linkedinInMail');

    const none = configFromRules({ ...DEFAULT_CADENCE_RULES, inMailChannel: null }, CADENCE_ID);

    expect(none.config).toBeNull();
    expect(none.errors).toContain('The connection request rules need the channel "Sent InMail" logs.');
  });

  it('refuses an InMail channel that a step uses: it would count as an extra email', () => {
    const result = configFromRules({ ...DEFAULT_CADENCE_RULES, inMailChannel: 'EMAIL' }, CADENCE_ID);

    expect(result.config).toBeNull();
    expect(result.errors).toContain(
      '"email" is the InMail channel ("Sent InMail" logs it), so no step can use it.',
    );
  });

  it('lists every channel the rules name once', () => {
    expect(channelsOfRules(withGroupStep)).toEqual([
      'LINKEDIN_CONNECTION',
      'LINKEDIN_MESSAGE',
      'EMAIL',
      'WHATSAPP_GROUP',
      'FOLLOW',
      'COMMENT',
      'LIKE',
      'PROFILE_VIEW',
      'INMAIL',
    ]);
  });

  it('names an InMail channel change in the audit summary', () => {
    expect(
      describeRulesChange(DEFAULT_CADENCE_RULES, { ...DEFAULT_CADENCE_RULES, inMailChannel: 'WHATSAPP' }),
    ).toEqual(['InMail channel: INMAIL → WHATSAPP']);
  });

  it('keeps an explicit empty InMail channel empty, so it is refused', () => {
    expect(normalizeCadenceRules({ ...DEFAULT_CADENCE_RULES, inMailChannel: '  ' }).inMailChannel).toBeNull();
    expect(normalizeCadenceRules({ ...DEFAULT_CADENCE_RULES, inMailChannel: null }).inMailChannel).toBeNull();
  });

  it('runs an old snapshot without an InMail channel on the default one, as unchanged rules', () => {
    const old: Partial<CadenceRules> = { ...DEFAULT_CADENCE_RULES };

    delete old.inMailChannel;

    const snapshot = parseRulesSnapshot({ version: 1, cadenceId: CADENCE_ID, rules: old });

    expect(snapshot?.rules).toEqual(DEFAULT_CADENCE_RULES);
  });
});

describe('rulesFromRecords', () => {
  const records = DEFAULT_CADENCE_RULES.steps.map((step, index) => ({
    ...step,
    id: `step-${index}`,
    position: index,
  }));

  it('orders steps by position', () => {
    const shuffled = [records[2], records[0], records[3], records[1]];
    const { rules, errors } = rulesFromRecords(DEFAULT_CADENCE_RULES, shuffled);

    expect(errors).toEqual([]);
    expect(rules.steps.map((step) => step.key)).toEqual([
      'connectionRequest',
      'linkedinMessage',
      'email',
      'drip',
    ]);
  });

  it('flags two steps on one position and a step with none', () => {
    const { errors } = rulesFromRecords(DEFAULT_CADENCE_RULES, [
      records[0],
      { ...records[1], position: 0 },
      { ...records[2], position: null },
      records[3],
    ]);

    expect(errors.join(' ')).toMatch(/share position 0/);
    expect(errors.join(' ')).toMatch(/has no position/);
  });
});

describe('normalizeCadenceRules', () => {
  it('keeps known keys with the right types only', () => {
    expect(
      normalizeCadenceRules({
        name: 'X',
        strikeLimit: '3',
        nonAdvancingChannels: ['FOLLOW', 7],
        steps: [{ key: 'a', repeat: 2, occurrenceNoun: '  ', extra: true }],
        evil: 'ignored',
      }),
    ).toEqual({
      touchChannels: BUILT_IN_TOUCH_CHANNEL_OPTIONS,
      name: 'X',
      timeZone: null,
      skipWeekends: null,
      strikeSilenceGapAmount: null,
      strikeSilenceGapUnit: null,
      strikeLimit: null,
      acceptanceTimeoutAmount: null,
      acceptanceTimeoutUnit: null,
      nonAdvancingChannels: ['FOLLOW'],
      // Rules from before the InMail had a channel meant the default.
      inMailChannel: 'INMAIL',
      steps: [
        {
          key: 'a',
          label: null,
          channel: null,
          repeat: 2,
          gapBeforeAmount: null,
          gapBeforeUnit: null,
          occurrenceNoun: null,
          requiredData: null,
          whenDataMissing: null,
          gate: null,
        },
      ],
    });
    expect(normalizeCadenceRules(null).steps).toEqual([]);
  });
});

describe('snapshots', () => {
  it('parse what they build and reject other shapes', () => {
    const snapshot = buildRulesSnapshot(CADENCE_ID, DEFAULT_CADENCE_RULES);

    expect(parseRulesSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(
      snapshot,
    );
    expect(parseRulesSnapshot({ version: 2, cadenceId: 'x', rules: {} })).toBeNull();
    expect(parseRulesSnapshot(null)).toBeNull();
  });
});

describe('selectActiveConfig (fallback to the last valid rules)', () => {
  const valid = buildRulesSnapshot(CADENCE_ID, DEFAULT_CADENCE_RULES);
  const recordsFor = (rules: CadenceRules) =>
    rules.steps.map((step, index) => ({ ...step, id: `s${index}`, position: index }));
  const fiveDayRules = withStep(DEFAULT_CADENCE_RULES, 2, { gapBeforeAmount: 5 });
  const invalidRules = withStep(DEFAULT_CADENCE_RULES, 1, { repeat: null });

  it('runs on the snapshot even when the records hold an invalid edit', () => {
    const active = selectActiveConfig(
      { id: CADENCE_ID, ...invalidRules, lastValidRules: valid },
      recordsFor(invalidRules),
    );

    expect(active.source).toBe('lastValidRules');
    expect(active.config.steps[1].repeat).toBe(2);
  });

  it('runs on the snapshot, not on records not yet applied', () => {
    const active = selectActiveConfig(
      { id: CADENCE_ID, ...fiveDayRules, lastValidRules: valid },
      recordsFor(fiveDayRules),
    );

    expect(active.config.steps[2].gapBefore.amount).toBe(3);
  });

  it('uses valid records when there is no snapshot yet', () => {
    const active = selectActiveConfig(
      { id: CADENCE_ID, ...fiveDayRules, lastValidRules: null },
      recordsFor(fiveDayRules),
    );

    expect(active.source).toBe('records');
    expect(active.config.steps[2].gapBefore.amount).toBe(5);
  });

  it('falls back to the engine default with the reasons when nothing is usable', () => {
    const active = selectActiveConfig(
      { id: CADENCE_ID, ...invalidRules, lastValidRules: null },
      recordsFor(invalidRules),
    );

    expect(active.source).toBe('default');
    expect(active.config).toBe(DEFAULT_CADENCE_CONFIG);
    expect(active.problems.join(' ')).toMatch(/must be the last step/);
    expect(selectActiveConfig(null, []).source).toBe('default');
  });
});

describe('describeRulesChange', () => {
  it('names each difference in plain words', () => {
    const after = {
      ...withStep(DEFAULT_CADENCE_RULES, 2, { gapBeforeAmount: 4 }),
      strikeLimit: 2,
    };

    expect(describeRulesChange(DEFAULT_CADENCE_RULES, after)).toEqual([
      'strike limit: 3 → 2',
      'step "Email" gap: 3 → 4',
    ]);
  });

  it('reports added, removed and moved steps', () => {
    const steps = DEFAULT_CADENCE_RULES.steps;
    const after: CadenceRules = {
      ...DEFAULT_CADENCE_RULES,
      steps: [
        steps[0],
        steps[2],
        steps[1],
        { ...steps[3], key: 'drip2', label: 'Drip two' },
      ],
    };

    expect(describeRulesChange(DEFAULT_CADENCE_RULES, after)).toEqual([
      'step "Drip" removed',
      'step "Email" moved from position 3 to 2',
      'step "LinkedIn message" moved from position 2 to 3',
      'step "Drip two" added at position 4',
    ]);
  });
});
