import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CADENCE_RULES,
  normalizeCadenceRules,
} from 'src/utils/cadence-rules';
import {
  addStep,
  describeSettings,
  describeStep,
  draftInputProblems,
  draftToRules,
  isSameRules,
  mapServerErrors,
  moveStep,
  parseWholeNumber,
  removeStep,
  rulesFingerprint,
  rulesToDraft,
  uniqueStepKey,
  updateStep,
} from 'src/ui/rules-form';
import { channelLabel, rememberChannelLabels } from 'src/ui/labels';
import { channelChoicesWith } from 'src/ui/touch-channels';

describe('rules ↔ form', () => {
  it('round-trips the default rules exactly', () => {
    const rules = draftToRules(rulesToDraft(DEFAULT_CADENCE_RULES));

    expect(rules).toEqual(DEFAULT_CADENCE_RULES);
  });

  it('survives the server normalising what the form sends', () => {
    const sent = draftToRules(rulesToDraft(DEFAULT_CADENCE_RULES));

    expect(normalizeCadenceRules(JSON.parse(JSON.stringify(sent)))).toEqual(sent);
  });

  it('keeps for ever as null repeat and drops fields that do not apply', () => {
    const draft = rulesToDraft(DEFAULT_CADENCE_RULES);
    const steps = updateStep(draft.steps, 2, { occurrenceNoun: 'mail', requiredData: '' });
    const rules = draftToRules({ ...draft, steps });

    // A counted step has no occurrence noun; a step needing no data has no
    // missing-data rule.
    expect(rules.steps[2]).toMatchObject({ repeat: 7, occurrenceNoun: null, requiredData: null, whenDataMissing: null });
    expect(rules.steps[3]).toMatchObject({ repeat: null, occurrenceNoun: 'email' });
  });

  it('sends the acceptance gate only when ticked', () => {
    const draft = rulesToDraft(DEFAULT_CADENCE_RULES);

    expect(draftToRules(draft).steps[1].gate).toBe('LINKEDIN_ACCEPTED');
    expect(
      draftToRules({ ...draft, steps: updateStep(draft.steps, 1, { waitsForAcceptance: false }) }).steps[1].gate,
    ).toBeNull();
  });

  it('parses whole numbers only', () => {
    expect(parseWholeNumber(' 7 ')).toBe(7);
    expect(parseWholeNumber('0')).toBe(0);
    expect(parseWholeNumber('2.5')).toBeNull();
    expect(parseWholeNumber('seven')).toBeNull();
    expect(parseWholeNumber('')).toBeNull();
  });
});

describe('draftInputProblems', () => {
  it('finds nothing wrong with the defaults', () => {
    expect(draftInputProblems(rulesToDraft(DEFAULT_CADENCE_RULES)).count).toBe(0);
  });

  it('stops a repeat count that would otherwise be read as for ever', () => {
    const draft = rulesToDraft(DEFAULT_CADENCE_RULES);
    const problems = draftInputProblems({
      ...draft,
      steps: updateStep(draft.steps, 2, { repeat: '2.5' }),
    });

    expect(problems.steps[2]).toEqual({ repeat: 'Enter a whole number.' });
    expect(problems.count).toBe(1);
  });

  it('checks settings, gaps and names', () => {
    const draft = rulesToDraft(DEFAULT_CADENCE_RULES);
    const problems = draftInputProblems({
      ...draft,
      strikeLimit: '0',
      acceptanceTimeoutAmount: '',
      steps: updateStep(draft.steps, 3, { gapBeforeAmount: '0', label: ' ' }),
    });

    expect(problems.settings).toEqual({ strikeLimit: 'At least 1.', acceptanceTimeout: 'Required.' });
    expect(problems.steps[3]).toEqual({ gapBeforeAmount: 'At least 1.', label: 'Give the step a name.' });
  });
});

describe('step list editing', () => {
  it('adds a new step before the for-ever step', () => {
    const steps = addStep(rulesToDraft(DEFAULT_CADENCE_RULES).steps);

    expect(steps.map((step) => step.key)).toEqual([
      'connectionRequest',
      'linkedinMessage',
      'email',
      'newStep',
      'drip',
    ]);
  });

  it('moves and removes steps', () => {
    const steps = rulesToDraft(DEFAULT_CADENCE_RULES).steps;

    expect(moveStep(steps, 2, -1).map((step) => step.key)).toEqual([
      'connectionRequest',
      'email',
      'linkedinMessage',
      'drip',
    ]);
    expect(moveStep(steps, 0, -1).map((step) => step.key)).toEqual(steps.map((step) => step.key));
    expect(removeStep(steps, 0).map((step) => step.key)).toEqual(['linkedinMessage', 'email', 'drip']);
  });

  it('picks a sensible missing-data rule when the needed data changes', () => {
    const steps = rulesToDraft(DEFAULT_CADENCE_RULES).steps;

    expect(updateStep(steps, 2, { requiredData: 'LINKEDIN_URL' })[2].whenDataMissing).toBe('SKIP');
    expect(updateStep(steps, 2, { requiredData: '' })[2].whenDataMissing).toBe('');
  });

  it('makes unique keys', () => {
    expect(uniqueStepKey('Follow-up call', [])).toBe('followUpCall');
    expect(uniqueStepKey('Email', ['email', 'email2'])).toBe('email3');
    expect(uniqueStepKey('!!!', [])).toBe('step');
  });
});

describe('fingerprints', () => {
  it('ignores key order but not values', () => {
    const rules = draftToRules(rulesToDraft(DEFAULT_CADENCE_RULES));
    const reordered = Object.fromEntries(
      Object.entries(rules).reverse(),
    ) as typeof rules;

    expect(Object.keys(reordered)[0]).toBe('steps');
    expect(rulesFingerprint(reordered)).toBe(rulesFingerprint(rules));
    expect(isSameRules(rules, { ...rules, strikeLimit: 4 })).toBe(false);
  });
});

describe('plain English', () => {
  it('describes the default steps', () => {
    expect(DEFAULT_CADENCE_RULES.steps.map(describeStep)).toEqual([
      'Connection request (LinkedIn connection), once, 3 business days after the previous touch. Needs a LinkedIn URL; skipped when missing.',
      'LinkedIn message ×2, 3 business days apart. Only once they accept the connection request. Needs a LinkedIn URL; skipped when missing.',
      'Email ×7, 3 business days apart. Needs an email address; waits until one is added.',
      'Drip (Email), for ever: one every 30 calendar days, shown as "Drip, email 1", "Drip, email 2" and so on. Needs an email address; waits until one is added.',
    ]);
  });

  it('describes the settings', () => {
    expect(describeSettings(DEFAULT_CADENCE_RULES)).toEqual([
      'Dates are worked out in the Europe/London time zone, and weekends are skipped.',
      'After we reply, 3 business days of silence counts as a strike; after 3 strikes the cadence stops until someone presses "Resume cadence".',
      'If a connection request is not accepted within 14 calendar days, the row offers "Sent InMail" and "Skip to email". "Sent InMail" logs a touch on the InMail channel, and the sequence moves on.',
      'Inbound follow, comment, like, profile view are logged but do not count as replies.',
    ]);
  });
});

describe('mapServerErrors', () => {
  it('puts each validator error next to its field', () => {
    const mapped = mapServerErrors([
      'Step 2 ("LinkedIn message") waits for acceptance, so a connection request step must come before it.',
      'Step 4 repeats forever, so it must be the last step.',
      'The silence before a strike must be at least 1 day.',
      'The strike limit must be a whole number of at least 1.',
      'The wait for acceptance before offering InMail cannot be negative.',
      '"Mars/Base" is not a known time zone. Use an IANA name such as "Europe/London".',
      '"email" is a step channel, so it cannot also be non-advancing.',
      'Two steps use the key "email". Each step needs its own key.',
      'Something nobody expected.',
    ]);

    expect(mapped.steps).toEqual({
      1: ['Step 2 ("LinkedIn message") waits for acceptance, so a connection request step must come before it.'],
      3: ['Step 4 repeats forever, so it must be the last step.'],
    });
    expect(Object.keys(mapped.settings).sort()).toEqual([
      'acceptanceTimeout',
      'nonAdvancingChannels',
      'steps',
      'strikeLimit',
      'strikeSilenceGap',
      'timeZone',
    ]);
    expect(mapped.general).toEqual(['Something nobody expected.']);
  });
});

describe('admin-added channels and the InMail channel', () => {
  const groupRules = {
    ...DEFAULT_CADENCE_RULES,
    nonAdvancingChannels: [...(DEFAULT_CADENCE_RULES.nonAdvancingChannels ?? []), 'REACTION'],
    inMailChannel: 'SALES_NAV_IN_MAIL',
    steps: DEFAULT_CADENCE_RULES.steps.map((step, index) =>
      index === 2 ? { ...step, channel: 'WHATSAPP_GROUP' } : step,
    ),
  };

  it('carries any channel value and the InMail channel through the form unchanged', () => {
    expect(draftToRules(rulesToDraft(groupRules))).toEqual(groupRules);
    expect(rulesToDraft(DEFAULT_CADENCE_RULES).inMailChannel).toBe('INMAIL');
  });

  it('says in plain English what Sent InMail logs, with the live label', () => {
    rememberChannelLabels([{ value: 'SALES_NAV_IN_MAIL', label: 'Sales Navigator InMail' }]);

    expect(describeSettings(groupRules)[2]).toBe(
      'If a connection request is not accepted within 14 calendar days, the row offers "Sent InMail" and "Skip to email". "Sent InMail" logs a touch on the Sales Navigator InMail channel, and the sequence moves on.',
    );
    expect(describeStep(groupRules.steps[2])).toBe(
      'Email (Whatsapp group) ×7, 3 business days apart. Needs an email address; waits until one is added.',
    );
  });

  it('puts InMail channel errors next to the InMail channel', () => {
    const mapped = mapServerErrors([
      '"email" is the InMail channel ("Sent InMail" logs it), so no step can use it.',
      '"follow" is the InMail channel, so it cannot also be non-advancing.',
      'The InMail channel: "SALES_NAV" is not in the outreach channel list. Add it on the Cadence rules page first.',
      'Non-advancing channels: "REACTION" is not in the outreach channel list. Add it on the Cadence rules page first.',
      'Step 3 ("Email"): "WHATSAPP_GROUP" is not in the outreach channel list. Add it on the Cadence rules page first.',
    ]);

    expect(mapped.settings.inMailChannel).toHaveLength(3);
    expect(mapped.settings.nonAdvancingChannels).toHaveLength(1);
    expect(mapped.steps[2]).toHaveLength(1);
    expect(mapped.general).toEqual([]);
  });
});

describe('channel pickers', () => {
  const live = [
    { value: 'EMAIL', label: 'Email' },
    { value: 'WHATSAPP_GROUP', label: 'WhatsApp group' },
  ];

  it('list the live options, plus a current value the field no longer offers', () => {
    expect(channelChoicesWith(live, 'WHATSAPP_GROUP', channelLabel)).toEqual(live);
    expect(channelChoicesWith(live, '', channelLabel)).toEqual(live);
    expect(channelChoicesWith(live, 'PIGEON_POST', channelLabel)).toEqual([
      ...live,
      { value: 'PIGEON_POST', label: 'Pigeon post (not offered any more)' },
    ]);
  });
});
