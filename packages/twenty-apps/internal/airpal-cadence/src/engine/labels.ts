import { findConnectionRequestStep, findStep } from './position';
import type {
  CadenceBlockedReason,
  CadenceConfig,
  CadenceDate,
  CadenceDuration,
  CadencePositionResult,
  OutreachStatus,
} from './types';

// The wording matches the predecessor's Step column exactly for the default
// cadence; it only formats, it never recomputes.

const BLOCKED_LABELS: Record<CadenceBlockedReason, string> = {
  noEmailAddress: 'no address on file',
  connectionPending: 'not accepted yet',
  noLinkedinUrl: 'no LinkedIn URL on file',
  unowned: 'nobody owns this contact',
};

// Parsed and formatted in UTC so the day that comes out is the day that went in.
const DAY_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export const formatCadenceDay = (date: CadenceDate): string =>
  DAY_FORMATTER.format(new Date(`${date}T00:00:00Z`));

const pluralize = (count: number, singular: string, plural: string): string =>
  `${count} ${count === 1 ? singular : plural}`;

const formatDuration = (duration: CadenceDuration): string =>
  duration.unit === 'calendarDays'
    ? pluralize(duration.amount, 'day', 'days')
    : pluralize(duration.amount, 'business day', 'business days');

const positionText = (
  result: CadencePositionResult,
  config: CadenceConfig,
): string => {
  const { position } = result;

  switch (position.kind) {
    case 'notStarted':
      return 'Not started';
    case 'warmedUp':
      return 'Warmed up';
    case 'awaitingAcceptance':
      return findConnectionRequestStep(config)?.label ?? 'Connection request';
    case 'sequenceComplete':
      return 'Sequence complete';
    case 'forever': {
      const step = findStep(config, position.stepKey);

      return step.occurrenceNoun === undefined
        ? `${step.label} ${position.occurrence}`
        : `${step.label}, ${step.occurrenceNoun} ${position.occurrence}`;
    }
    case 'step': {
      const step = findStep(config, position.stepKey);

      return step.repeat === 1
        ? step.label
        : `${step.label} ${position.occurrence} of ${step.repeat}`;
    }
  }
};

// The denominator stays on a blocked step: "Email 1 of 7 — no address on file".
export const positionLabel = (
  result: CadencePositionResult,
  config: CadenceConfig,
): string => {
  const text = positionText(result, config);

  if (result.blockedReason !== undefined) {
    return `${text} — ${BLOCKED_LABELS[result.blockedReason]}`;
  }

  if (result.inMailAvailable === true) {
    return `${text} — not accepted after ${formatDuration(config.connectionRequest.acceptanceTimeout)}`;
  }

  return text;
};

export const stepLabel = (
  status: OutreachStatus,
  config: CadenceConfig,
): string => {
  switch (status.state) {
    case 'optedOut':
      return 'Opted out — no outreach, ever';
    case 'dead':
      return 'Dead — no outreach';
    case 'bounced':
      return 'Email bounced — the address is wrong';
    case 'replyOwed':
      return `Reply to them — owed since ${formatCadenceDay(status.since)}`;
    case 'hold':
      return status.revisitOn === null
        ? 'On hold'
        : `On hold — revisit ${formatCadenceDay(status.revisitOn)}`;
    case 'snoozed':
      return `Snoozed until ${formatCadenceDay(status.until)}`;
    case 'awaitingResume':
      return `Awaiting resume — ${pluralize(config.strikeLimit, 'follow-up', 'follow-ups')} unanswered since they replied on ${formatCadenceDay(status.repliedOn)}`;
    // Zero strikes means we answered and the silence has not yet accrued.
    case 'inConversation':
      return status.strikes === 0
        ? 'In conversation — answered, no strikes yet'
        : `Strike ${status.strikes} of ${config.strikeLimit}`;
    case 'running':
      return positionLabel(status.result, config);
  }
};
