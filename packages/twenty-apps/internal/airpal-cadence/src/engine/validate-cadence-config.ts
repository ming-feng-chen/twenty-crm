import type {
  CadenceConfig,
  CadenceRequiredData,
  CadenceStepGate,
  CadenceWhenDataMissing,
  GapUnit,
} from './types';

const GAP_UNITS: readonly GapUnit[] = ['businessDays', 'calendarDays'];
const REQUIRED_DATA: readonly CadenceRequiredData[] = ['linkedinUrl', 'email'];
const WHEN_DATA_MISSING: readonly CadenceWhenDataMissing[] = ['skip', 'block'];
const STEP_GATES: readonly CadenceStepGate[] = ['linkedinAccepted'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isOneOf = <TValue extends string>(
  values: readonly TValue[],
  value: unknown,
): value is TValue => (values as readonly unknown[]).includes(value);

const quoteList = (values: readonly string[]): string =>
  values.map((value) => `"${value}"`).join(' or ');

const isKnownTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });

    return true;
  } catch {
    return false;
  }
};

const validateDuration = (
  value: unknown,
  subject: string,
  minimum: number,
  errors: string[],
): void => {
  if (!isRecord(value)) {
    errors.push(`${subject} needs an amount and a unit.`);

    return;
  }

  const { amount, unit } = value;

  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    errors.push(`${subject} must be a whole number of days.`);
  } else if (amount < 0) {
    errors.push(`${subject} cannot be negative.`);
  } else if (amount < minimum) {
    errors.push(`${subject} must be at least ${minimum} day.`);
  }

  if (!isOneOf(GAP_UNITS, unit)) {
    errors.push(
      `${subject} has an unknown unit "${String(unit)}". Use ${quoteList(GAP_UNITS)}.`,
    );
  }
};

const validateChannelList = (
  value: unknown,
  name: string,
  errors: string[],
): string[] => {
  if (!Array.isArray(value) || !value.every(isText)) {
    errors.push(`${name} must be a list of channel names.`);

    return [];
  }

  return value;
};

const describeStep = (step: unknown, index: number): string => {
  const label = isRecord(step) && isText(step.label) ? ` ("${step.label}")` : '';

  return `Step ${index + 1}${label}`;
};

const validateStep = (step: unknown, subject: string, errors: string[]): void => {
  if (!isRecord(step)) {
    errors.push(`${subject} is not a step definition.`);

    return;
  }

  if (!isText(step.key)) {
    errors.push(`${subject} needs a key.`);
  }

  if (!isText(step.label)) {
    errors.push(`${subject} needs a label.`);
  }

  if (!isText(step.channel)) {
    errors.push(`${subject} needs a channel.`);
  }

  const isForever = step.repeat === 'forever';

  if (!isForever) {
    if (typeof step.repeat !== 'number' || !Number.isInteger(step.repeat)) {
      errors.push(
        `${subject} must repeat a whole number of times, or "forever".`,
      );
    } else if (step.repeat < 1) {
      errors.push(`${subject} must happen at least once.`);
    }
  }

  // A forever step with no gap would be due again the moment it was sent.
  validateDuration(
    step.gapBefore,
    `${subject}: the gap before it`,
    isForever ? 1 : 0,
    errors,
  );

  // Renamed when the drip label moved from months to touches sent (E4).
  if (step.periodName !== undefined) {
    errors.push(
      `${subject} has a period name, which is no longer used. Name one occurrence with occurrenceNoun instead, e.g. "email".`,
    );
  }

  if (step.occurrenceNoun !== undefined) {
    if (!isForever) {
      errors.push(
        `${subject} only repeats a set number of times, so it has no occurrence noun.`,
      );
    } else if (!isText(step.occurrenceNoun)) {
      errors.push(`${subject} has an empty occurrence noun.`);
    }
  }

  if (step.requiredData === undefined) {
    if (step.whenDataMissing !== undefined) {
      errors.push(
        `${subject} says what to do when data is missing, but requires no data.`,
      );
    }
  } else if (!isOneOf(REQUIRED_DATA, step.requiredData)) {
    errors.push(
      `${subject} requires unknown data "${String(step.requiredData)}". Use ${quoteList(REQUIRED_DATA)}.`,
    );
  } else if (!isOneOf(WHEN_DATA_MISSING, step.whenDataMissing)) {
    errors.push(
      `${subject} must say what happens without ${step.requiredData}: ${quoteList(WHEN_DATA_MISSING)}.`,
    );
  } else if (
    step.requiredData === 'linkedinUrl' &&
    step.whenDataMissing === 'block'
  ) {
    errors.push(
      `${subject} can only be skipped when the LinkedIn URL is missing; nothing offers a way to add one.`,
    );
  }

  if (step.gate !== undefined && !isOneOf(STEP_GATES, step.gate)) {
    errors.push(
      `${subject} has an unknown gate "${String(step.gate)}". Use ${quoteList(STEP_GATES)}.`,
    );
  }
};

const validateSteps = (
  steps: readonly unknown[],
  connectionChannel: string | null,
  errors: string[],
): void => {
  steps.forEach((step, index) =>
    validateStep(step, describeStep(step, index), errors),
  );

  const records = steps.filter(isRecord);
  const keys = records.map((step) => step.key).filter(isText);

  for (const key of new Set(keys)) {
    if (keys.filter((candidate) => candidate === key).length > 1) {
      errors.push(`Two steps use the key "${key}". Each step needs its own key.`);
    }
  }

  steps.forEach((step, index) => {
    if (
      isRecord(step) &&
      step.repeat === 'forever' &&
      index !== steps.length - 1
    ) {
      errors.push(
        `${describeStep(step, index)} repeats forever, so it must be the last step.`,
      );
    }
  });

  const connectionIndexes = steps
    .map((step, index) =>
      isRecord(step) && step.channel === connectionChannel ? index : -1,
    )
    .filter((index) => index >= 0);

  if (connectionIndexes.length > 1) {
    errors.push(
      `Only one step can send the connection request ("${String(connectionChannel)}").`,
    );
  }

  for (const index of connectionIndexes) {
    const step = steps[index];
    const subject = describeStep(step, index);

    if (!isRecord(step)) {
      continue;
    }

    if (step.repeat !== 1) {
      errors.push(`${subject} sends the connection request, so it must happen exactly once.`);
    }

    if (step.requiredData !== 'linkedinUrl') {
      errors.push(`${subject} sends the connection request, so it must require a LinkedIn URL.`);
    }

    if (step.gate !== undefined) {
      errors.push(`${subject} sends the connection request, so it cannot wait for acceptance.`);
    }
  }

  steps.forEach((step, index) => {
    if (!isRecord(step) || step.gate === undefined) {
      return;
    }

    const subject = describeStep(step, index);

    if (index === 0) {
      errors.push(
        `${subject} is the first step, so it cannot wait for acceptance: no connection request comes before it.`,
      );
    } else if (!connectionIndexes.some((connectionIndex) => connectionIndex < index)) {
      errors.push(
        `${subject} waits for acceptance, so a connection request step must come before it.`,
      );
    }

    if (step.requiredData !== 'linkedinUrl') {
      errors.push(`${subject} waits for LinkedIn acceptance, so it must require a LinkedIn URL.`);
    }
  });
};

// Returns every problem in plain words; an empty list means the cadence is safe
// to save and run.
export const validateCadenceConfig = (config: unknown): string[] => {
  const errors: string[] = [];

  if (!isRecord(config)) {
    return ['The cadence configuration must be an object.'];
  }

  if (!isText(config.id)) {
    errors.push('The cadence needs an id.');
  }

  if (!isText(config.name)) {
    errors.push('The cadence needs a name.');
  }

  if (!isText(config.timeZone)) {
    errors.push('The cadence needs a time zone.');
  } else if (!isKnownTimeZone(config.timeZone)) {
    errors.push(
      `"${config.timeZone}" is not a known time zone. Use an IANA name such as "Europe/London".`,
    );
  }

  if (typeof config.skipWeekends !== 'boolean') {
    errors.push('Say whether weekends are skipped (skipWeekends: true or false).');
  }

  let connectionChannel: string | null = null;
  let inMailChannel: string | null = null;

  if (!isRecord(config.connectionRequest)) {
    errors.push('The cadence needs connection request rules.');
  } else {
    const { channel, acceptedOutcome, acceptanceTimeout } =
      config.connectionRequest;

    if (isText(channel)) {
      connectionChannel = channel;
    } else {
      errors.push('The connection request rules need a channel.');
    }

    if (isText(config.connectionRequest.inMailChannel)) {
      inMailChannel = config.connectionRequest.inMailChannel;
    } else {
      errors.push('The connection request rules need the channel "Sent InMail" logs.');
    }

    if (inMailChannel !== null && inMailChannel === connectionChannel) {
      errors.push(
        `The InMail channel "${inMailChannel}" is the connection request's channel; they must differ.`,
      );
    }

    if (!isText(acceptedOutcome)) {
      errors.push('The connection request rules need the outcome that means accepted.');
    }

    validateDuration(
      acceptanceTimeout,
      'The wait for acceptance before offering InMail',
      0,
      errors,
    );
  }

  if (
    !isRecord(config.bounce) ||
    !isText(config.bounce.channel) ||
    !isText(config.bounce.outcome)
  ) {
    errors.push('The bounce rule needs a channel and an outcome.');
  }

  validateDuration(config.strikeSilenceGap, 'The silence before a strike', 1, errors);

  if (
    typeof config.strikeLimit !== 'number' ||
    !Number.isInteger(config.strikeLimit) ||
    config.strikeLimit < 1
  ) {
    errors.push('The strike limit must be a whole number of at least 1.');
  }

  const nonAdvancingChannels = validateChannelList(
    config.nonAdvancingChannels,
    'Non-advancing channels',
    errors,
  );
  const conversationalChannels = validateChannelList(
    config.conversationalChannels,
    'Conversational channels',
    errors,
  );

  for (const channel of nonAdvancingChannels) {
    if (conversationalChannels.includes(channel)) {
      errors.push(
        `"${channel}" cannot be both non-advancing and conversational.`,
      );
    }
  }

  if (!Array.isArray(config.steps) || config.steps.length === 0) {
    errors.push('The cadence needs at least one step.');

    return errors;
  }

  validateSteps(config.steps, connectionChannel, errors);

  const stepChannels = new Set(
    config.steps
      .filter(isRecord)
      .map((step) => step.channel)
      .filter(isText),
  );

  if (connectionChannel !== null) {
    stepChannels.add(connectionChannel);
  }

  // An InMail on a step's own channel would also count as that step (an
  // extra email or LinkedIn message), and one on a non-advancing or
  // conversational channel would not be a sequence touch at all.
  if (inMailChannel !== null) {
    if (stepChannels.has(inMailChannel)) {
      errors.push(
        `"${inMailChannel}" is the InMail channel ("Sent InMail" logs it), so no step can use it.`,
      );
    }

    if (nonAdvancingChannels.includes(inMailChannel)) {
      errors.push(
        `"${inMailChannel}" is the InMail channel, so it cannot also be non-advancing.`,
      );
    }

    if (conversationalChannels.includes(inMailChannel)) {
      errors.push(
        `"${inMailChannel}" is the InMail channel, so it cannot also be conversational.`,
      );
    }
  }

  for (const channel of stepChannels) {
    if (nonAdvancingChannels.includes(channel)) {
      errors.push(
        `"${channel}" is a step channel, so it cannot also be non-advancing.`,
      );
    }

    if (conversationalChannels.includes(channel)) {
      errors.push(
        `"${channel}" is a step channel, so it cannot also be conversational.`,
      );
    }
  }

  return errors;
};

export const assertValidCadenceConfig = (config: CadenceConfig): void => {
  const errors = validateCadenceConfig(config);

  if (errors.length > 0) {
    throw new Error(
      `The cadence "${config.id}" is not valid: ${errors.join(' ')}`,
    );
  }
};
