import { describe, expect, it } from 'vitest';

import { computeCadence } from '../compute-cadence';
import { DEFAULT_CADENCE_CONFIG } from '../default-cadence-config';
import type { CadenceConfig, CadenceStepDefinition } from '../types';
import { validateCadenceConfig } from '../validate-cadence-config';
import { contact } from './fixtures';

const [CONNECTION_STEP, LINKEDIN_STEP, EMAIL_STEP, DRIP_STEP] =
  DEFAULT_CADENCE_CONFIG.steps;

const withSteps = (steps: unknown[]): unknown => ({
  ...DEFAULT_CADENCE_CONFIG,
  steps,
});

const errorsFor = (config: unknown): string => validateCadenceConfig(config).join('\n');

describe('validateCadenceConfig', () => {
  it('accepts the default cadence', () => {
    expect(validateCadenceConfig(DEFAULT_CADENCE_CONFIG)).toEqual([]);
  });

  it('rejects something that is not a configuration at all', () => {
    expect(validateCadenceConfig(null)).toEqual([
      'The cadence configuration must be an object.',
    ]);
    expect(validateCadenceConfig([])).toEqual([
      'The cadence configuration must be an object.',
    ]);
  });

  it('rejects a cadence with no steps', () => {
    expect(errorsFor(withSteps([]))).toContain('The cadence needs at least one step.');
    expect(errorsFor({ ...DEFAULT_CADENCE_CONFIG, steps: undefined })).toContain(
      'The cadence needs at least one step.',
    );
  });

  it('rejects a step that repeats fewer than once, or a fraction of a time', () => {
    expect(errorsFor(withSteps([{ ...EMAIL_STEP, repeat: 0 }]))).toContain(
      'Step 1 ("Email") must happen at least once.',
    );
    expect(errorsFor(withSteps([{ ...EMAIL_STEP, repeat: 2.5 }]))).toContain(
      'Step 1 ("Email") must repeat a whole number of times, or "forever".',
    );
    expect(errorsFor(withSteps([{ ...EMAIL_STEP, repeat: 'often' }]))).toContain(
      'must repeat a whole number of times',
    );
  });

  it('rejects a negative or fractional gap', () => {
    expect(
      errorsFor(
        withSteps([{ ...EMAIL_STEP, gapBefore: { amount: -1, unit: 'businessDays' } }]),
      ),
    ).toContain('Step 1 ("Email"): the gap before it cannot be negative.');
    expect(
      errorsFor(
        withSteps([{ ...EMAIL_STEP, gapBefore: { amount: 1.5, unit: 'businessDays' } }]),
      ),
    ).toContain('Step 1 ("Email"): the gap before it must be a whole number of days.');
  });

  it('accepts a zero gap on a step that runs a set number of times', () => {
    expect(
      validateCadenceConfig(
        withSteps([{ ...EMAIL_STEP, gapBefore: { amount: 0, unit: 'calendarDays' } }]),
      ),
    ).toEqual([]);
  });

  it('rejects an unknown unit', () => {
    expect(
      errorsFor(withSteps([{ ...EMAIL_STEP, gapBefore: { amount: 3, unit: 'weeks' } }])),
    ).toContain(
      'Step 1 ("Email"): the gap before it has an unknown unit "weeks". Use "businessDays" or "calendarDays".',
    );
    expect(errorsFor(withSteps([{ ...EMAIL_STEP, gapBefore: 3 }]))).toContain(
      'Step 1 ("Email"): the gap before it needs an amount and a unit.',
    );
  });

  it('rejects a forever step that is not last', () => {
    expect(errorsFor(withSteps([DRIP_STEP, EMAIL_STEP]))).toContain(
      'Step 1 ("Drip") repeats forever, so it must be the last step.',
    );
  });

  it('rejects a forever step with no gap, which would never end a period', () => {
    expect(
      errorsFor(
        withSteps([EMAIL_STEP, { ...DRIP_STEP, gapBefore: { amount: 0, unit: 'calendarDays' } }]),
      ),
    ).toContain('Step 2 ("Drip"): the gap before it must be at least 1 day.');
  });

  it('rejects duplicate keys', () => {
    expect(
      errorsFor(withSteps([EMAIL_STEP, { ...DRIP_STEP, key: 'email' }])),
    ).toContain('Two steps use the key "email". Each step needs its own key.');
  });

  it('rejects a gate on the first step', () => {
    expect(errorsFor(withSteps([LINKEDIN_STEP, EMAIL_STEP]))).toContain(
      'Step 1 ("LinkedIn message") is the first step, so it cannot wait for acceptance: no connection request comes before it.',
    );
  });

  it('rejects a gate with no connection request before it', () => {
    expect(errorsFor(withSteps([EMAIL_STEP, LINKEDIN_STEP]))).toContain(
      'Step 2 ("LinkedIn message") waits for acceptance, so a connection request step must come before it.',
    );
    expect(
      errorsFor(withSteps([EMAIL_STEP, LINKEDIN_STEP, CONNECTION_STEP])),
    ).toContain('Step 2 ("LinkedIn message") waits for acceptance');
  });

  it('rejects an unknown gate, data requirement or missing-data rule', () => {
    expect(errorsFor(withSteps([{ ...EMAIL_STEP, gate: 'emailOpened' }]))).toContain(
      'Step 1 ("Email") has an unknown gate "emailOpened". Use "linkedinAccepted".',
    );
    expect(errorsFor(withSteps([{ ...EMAIL_STEP, requiredData: 'phone' }]))).toContain(
      'Step 1 ("Email") requires unknown data "phone". Use "linkedinUrl" or "email".',
    );
    expect(
      errorsFor(withSteps([{ ...EMAIL_STEP, whenDataMissing: undefined }])),
    ).toContain('Step 1 ("Email") must say what happens without email: "skip" or "block".');
    expect(
      errorsFor(
        withSteps([{ key: 'call', label: 'Call', channel: 'phone', repeat: 1, gapBefore: { amount: 1, unit: 'businessDays' }, whenDataMissing: 'skip' }]),
      ),
    ).toContain('says what to do when data is missing, but requires no data.');
  });

  it('rejects blocking on a missing LinkedIn URL, which nothing can resolve', () => {
    expect(
      errorsFor(withSteps([{ ...CONNECTION_STEP, whenDataMissing: 'block' }, EMAIL_STEP])),
    ).toContain(
      'Step 1 ("Connection request") can only be skipped when the LinkedIn URL is missing',
    );
  });

  it('holds the connection request step to one request that needs a LinkedIn URL', () => {
    const errors = errorsFor(
      withSteps([{ ...CONNECTION_STEP, repeat: 2, requiredData: undefined, whenDataMissing: undefined }, EMAIL_STEP]),
    );

    expect(errors).toContain('sends the connection request, so it must happen exactly once.');
    expect(errors).toContain('sends the connection request, so it must require a LinkedIn URL.');
    expect(
      errorsFor(withSteps([CONNECTION_STEP, { ...CONNECTION_STEP, key: 'again' }, EMAIL_STEP])),
    ).toContain('Only one step can send the connection request ("linkedinConnection").');
  });

  it('rejects a step with no key, label or channel', () => {
    const errors = errorsFor(
      withSteps([{ ...EMAIL_STEP, key: '', label: ' ', channel: undefined }]),
    );

    expect(errors).toContain('Step 1 needs a key.');
    expect(errors).toContain('Step 1 needs a label.');
    expect(errors).toContain('Step 1 needs a channel.');
  });

  it('rejects an occurrence noun on a step that does not repeat forever, or an empty one', () => {
    expect(errorsFor(withSteps([{ ...EMAIL_STEP, occurrenceNoun: 'email' }]))).toContain(
      'Step 1 ("Email") only repeats a set number of times, so it has no occurrence noun.',
    );
    expect(errorsFor(withSteps([EMAIL_STEP, { ...DRIP_STEP, occurrenceNoun: ' ' }]))).toContain(
      'Step 2 ("Drip") has an empty occurrence noun.',
    );
  });

  // E4 replaced periodName; a stored one must surface rather than be ignored.
  it('rejects the retired period name', () => {
    expect(errorsFor(withSteps([EMAIL_STEP, { ...DRIP_STEP, periodName: 'month' }]))).toContain(
      'Step 2 ("Drip") has a period name, which is no longer used. Name one occurrence with occurrenceNoun instead, e.g. "email".',
    );
  });

  it('rejects an unknown time zone', () => {
    expect(errorsFor({ ...DEFAULT_CADENCE_CONFIG, timeZone: 'Mars/Olympus' })).toContain(
      '"Mars/Olympus" is not a known time zone. Use an IANA name such as "Europe/London".',
    );
  });

  it('rejects broken strike rules', () => {
    expect(errorsFor({ ...DEFAULT_CADENCE_CONFIG, strikeLimit: 0 })).toContain(
      'The strike limit must be a whole number of at least 1.',
    );
    expect(
      errorsFor({ ...DEFAULT_CADENCE_CONFIG, strikeSilenceGap: { amount: 0, unit: 'businessDays' } }),
    ).toContain('The silence before a strike must be at least 1 day.');
  });

  it('rejects a channel that is both a step and non-advancing or conversational', () => {
    expect(
      errorsFor({ ...DEFAULT_CADENCE_CONFIG, nonAdvancingChannels: ['follow', 'email'] }),
    ).toContain('"email" is a step channel, so it cannot also be non-advancing.');
    expect(
      errorsFor({ ...DEFAULT_CADENCE_CONFIG, conversationalChannels: ['call', 'linkedinMessage'] }),
    ).toContain('"linkedinMessage" is a step channel, so it cannot also be conversational.');
    expect(
      errorsFor({ ...DEFAULT_CADENCE_CONFIG, conversationalChannels: ['call', 'follow'] }),
    ).toContain('"follow" cannot be both non-advancing and conversational.');
  });

  it('needs an InMail channel that is no step, connection, non-advancing or conversational channel', () => {
    const withInMail = (inMailChannel: unknown, overrides: object = {}) => ({
      ...DEFAULT_CADENCE_CONFIG,
      ...overrides,
      connectionRequest: { ...DEFAULT_CADENCE_CONFIG.connectionRequest, inMailChannel },
    });

    expect(errorsFor(withInMail(undefined))).toContain(
      'The connection request rules need the channel "Sent InMail" logs.',
    );
    expect(errorsFor(withInMail(' '))).toContain(
      'The connection request rules need the channel "Sent InMail" logs.',
    );
    expect(errorsFor(withInMail('linkedinConnection'))).toContain(
      `The InMail channel "linkedinConnection" is the connection request's channel; they must differ.`,
    );
    // It would count as an extra email or LinkedIn message.
    expect(errorsFor(withInMail('email'))).toContain(
      '"email" is the InMail channel ("Sent InMail" logs it), so no step can use it.',
    );
    expect(errorsFor(withInMail('linkedinMessage'))).toContain(
      '"linkedinMessage" is the InMail channel ("Sent InMail" logs it), so no step can use it.',
    );
    expect(errorsFor(withInMail('follow'))).toContain(
      '"follow" is the InMail channel, so it cannot also be non-advancing.',
    );
    expect(errorsFor(withInMail('call'))).toContain(
      '"call" is the InMail channel, so it cannot also be conversational.',
    );
    expect(validateCadenceConfig(withInMail('linkedinInMail'))).toEqual([]);
  });

  it('rejects missing identity, calendar, acceptance and bounce rules', () => {
    const errors = errorsFor({
      ...DEFAULT_CADENCE_CONFIG,
      id: '',
      name: undefined,
      skipWeekends: 'yes',
      connectionRequest: { channel: 'linkedinConnection', acceptedOutcome: '', acceptanceTimeout: { amount: -2, unit: 'calendarDays' } },
      bounce: { channel: 'email' },
    });

    expect(errors).toContain('The cadence needs an id.');
    expect(errors).toContain('The cadence needs a name.');
    expect(errors).toContain('Say whether weekends are skipped');
    expect(errors).toContain('The connection request rules need the outcome that means accepted.');
    expect(errors).toContain('The wait for acceptance before offering InMail cannot be negative.');
    expect(errors).toContain('The bounce rule needs a channel and an outcome.');
  });

  it('accepts every configuration the configurability tests use', () => {
    const steps: CadenceStepDefinition[] = [
      CONNECTION_STEP,
      LINKEDIN_STEP,
      { key: 'whatsapp', label: 'WhatsApp', channel: 'whatsapp', repeat: 1, gapBefore: { amount: 2, unit: 'calendarDays' } },
      { ...EMAIL_STEP, repeat: 5 },
    ];
    const config: CadenceConfig = {
      ...DEFAULT_CADENCE_CONFIG,
      steps,
      skipWeekends: false,
      strikeLimit: 2,
      timeZone: 'Asia/Tokyo',
    };

    expect(validateCadenceConfig(config)).toEqual([]);
  });

  it('is enforced by computeCadence, which refuses to run a broken cadence', () => {
    const broken = { ...DEFAULT_CADENCE_CONFIG, steps: [] };

    expect(() =>
      computeCadence({ contact: contact(), touches: [], config: broken, today: '2026-08-17' }),
    ).toThrow(/The cadence "default" is not valid: The cadence needs at least one step\./);
  });
});
