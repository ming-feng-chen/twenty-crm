import type {
  CadenceAction,
  CadenceBlockedReason,
  CadencePosition,
  CadencePositionResult,
  OutreachStatus,
} from '../types';

// Translates the engine's shapes to and from the predecessor's, for the default
// cadence only, so ported tests keep their expectations exactly as written.
// Two amendments show through: the engine has no InMail position (E1), and a
// drip's number is the drip touch to send, carried in the legacy `month` (E4).

export type LegacyPosition =
  | { kind: 'not_started' }
  | { kind: 'warmed_up' }
  | { kind: 'connection_sent' }
  | { kind: 'linkedin_message'; n: number }
  | { kind: 'linkedin_inmail' }
  | { kind: 'email'; n: number }
  | { kind: 'drip_month'; month: number };

export type LegacyBlockedReason =
  | 'no_email_address'
  | 'bounced'
  | 'connection_pending'
  | 'no_linkedin_url'
  | 'unowned';

export type LegacyPositionResult = {
  position: LegacyPosition;
  blockedReason?: LegacyBlockedReason;
  inMailAvailable?: boolean;
};

export type LegacyStatus =
  | { state: 'opted_out' }
  | { state: 'dead' }
  | { state: 'bounced' }
  | { state: 'reply_owed'; since: string }
  | { state: 'hold'; revisitOn: string | null }
  | { state: 'snoozed'; until: string }
  | { state: 'awaiting_resume'; repliedOn: string }
  | { state: 'in_conversation'; strikes: number; repliedOn: string }
  | { state: 'running'; result: LegacyPositionResult };

const BLOCKED_TO_LEGACY: Record<CadenceBlockedReason, LegacyBlockedReason> = {
  unowned: 'unowned',
  connectionPending: 'connection_pending',
  noEmailAddress: 'no_email_address',
  noLinkedinUrl: 'no_linkedin_url',
};

export const LEGACY_CHANNELS: Record<string, string> = {
  linkedinConnection: 'linkedin_connection',
  linkedinMessage: 'linkedin_message',
  email: 'email',
};

export const ACTION_FROM_LEGACY: Record<string, CadenceAction> = {
  did_it: 'didIt',
  they_accepted: 'theyAccepted',
  they_replied: 'theyReplied',
  sent_inmail: 'sentInMail',
  skip_to_email: 'skipToNextStep',
  i_replied: 'iReplied',
  i_followed_up: 'iFollowedUp',
  resume_cadence: 'resumeCadence',
  add_email_address: 'addEmailAddress',
  something_else: 'somethingElse',
};

export const toLegacyPosition = (position: CadencePosition): LegacyPosition => {
  switch (position.kind) {
    case 'notStarted':
      return { kind: 'not_started' };
    case 'warmedUp':
      return { kind: 'warmed_up' };
    case 'awaitingAcceptance':
      return { kind: 'connection_sent' };
    case 'forever':
      return { kind: 'drip_month', month: position.occurrence };
    case 'step':
      if (position.stepKey === 'linkedinMessage') {
        return { kind: 'linkedin_message', n: position.occurrence };
      }

      if (position.stepKey === 'email') {
        return { kind: 'email', n: position.occurrence };
      }

      throw new Error(`No legacy position for step ${position.stepKey}`);
    case 'sequenceComplete':
      throw new Error('The default cadence never completes');
  }
};

export const toLegacyResult = (
  result: CadencePositionResult,
): LegacyPositionResult => ({
  position: toLegacyPosition(result.position),
  ...(result.blockedReason === undefined
    ? {}
    : { blockedReason: BLOCKED_TO_LEGACY[result.blockedReason] }),
  ...(result.inMailAvailable === undefined
    ? {}
    : { inMailAvailable: result.inMailAvailable }),
});

export const toLegacyStatus = (status: OutreachStatus): LegacyStatus => {
  switch (status.state) {
    case 'optedOut':
      return { state: 'opted_out' };
    case 'dead':
      return { state: 'dead' };
    case 'bounced':
      return { state: 'bounced' };
    case 'replyOwed':
      return { state: 'reply_owed', since: status.since };
    case 'hold':
      return { state: 'hold', revisitOn: status.revisitOn };
    case 'snoozed':
      return { state: 'snoozed', until: status.until };
    case 'awaitingResume':
      return { state: 'awaiting_resume', repliedOn: status.repliedOn };
    case 'inConversation':
      return {
        state: 'in_conversation',
        strikes: status.strikes,
        repliedOn: status.repliedOn,
      };
    case 'running':
      return { state: 'running', result: toLegacyResult(status.result) };
  }
};

const fromLegacyPosition = (position: LegacyPosition): CadencePosition => {
  switch (position.kind) {
    case 'not_started':
      return { kind: 'notStarted', stepKey: 'connectionRequest' };
    case 'warmed_up':
      return { kind: 'warmedUp', stepKey: 'connectionRequest' };
    case 'connection_sent':
      return { kind: 'awaitingAcceptance', stepKey: 'linkedinMessage' };
    case 'linkedin_inmail':
      throw new Error('E1: a sent InMail moves on to email; the engine has no InMail position');
    case 'linkedin_message':
      return { kind: 'step', stepKey: 'linkedinMessage', occurrence: position.n };
    case 'email':
      return { kind: 'step', stepKey: 'email', occurrence: position.n };
    case 'drip_month':
      return { kind: 'forever', stepKey: 'drip', occurrence: position.month };
  }
};

const BLOCKED_FROM_LEGACY: Partial<
  Record<LegacyBlockedReason, CadenceBlockedReason>
> = {
  unowned: 'unowned',
  connection_pending: 'connectionPending',
  no_email_address: 'noEmailAddress',
  no_linkedin_url: 'noLinkedinUrl',
};

export const fromLegacyResult = (
  result: LegacyPositionResult,
): CadencePositionResult => {
  const blockedReason =
    result.blockedReason === undefined
      ? undefined
      : BLOCKED_FROM_LEGACY[result.blockedReason];

  // The predecessor's "not started" without a LinkedIn URL is Email 1 in play.
  const position =
    result.position.kind === 'not_started' &&
    result.blockedReason === 'no_linkedin_url'
      ? { kind: 'notStarted' as const, stepKey: 'email' }
      : fromLegacyPosition(result.position);

  return {
    position,
    ...(blockedReason === undefined ? {} : { blockedReason }),
    ...(result.inMailAvailable === undefined
      ? {}
      : { inMailAvailable: result.inMailAvailable }),
  };
};

export const fromLegacyStatus = (status: LegacyStatus): OutreachStatus => {
  switch (status.state) {
    case 'opted_out':
      return { state: 'optedOut' };
    case 'dead':
      return { state: 'dead' };
    case 'bounced':
      return { state: 'bounced' };
    case 'reply_owed':
      return { state: 'replyOwed', since: status.since };
    case 'hold':
      return { state: 'hold', revisitOn: status.revisitOn };
    case 'snoozed':
      return { state: 'snoozed', until: status.until };
    case 'awaiting_resume':
      return { state: 'awaitingResume', repliedOn: status.repliedOn };
    case 'in_conversation':
      return {
        state: 'inConversation',
        strikes: status.strikes,
        repliedOn: status.repliedOn,
      };
    case 'running':
      return { state: 'running', result: fromLegacyResult(status.result) };
  }
};
