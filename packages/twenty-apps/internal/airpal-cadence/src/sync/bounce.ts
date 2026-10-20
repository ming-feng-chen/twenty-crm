import { addressesIn } from 'src/sync/automated-mail';
import { type EmailTouchCandidate } from 'src/sync/classify-message';

export type OutboundInThread = EmailTouchCandidate & {
  receivedAt: string;
};

export type BounceTarget = {
  personId: string;
  messageId: string;
  occurredOn: string;
  address: string;
};

const instantOf = (value: string): number => {
  const time = new Date(value).getTime();

  return Number.isNaN(time) ? Number.NaN : time;
};

// A delivery-failure notice marks an email touch BOUNCED only when all of
// these hold: it comes from a delivery-status sender with a failure subject
// (classifyMessage), it is in the same thread as an email AirPal sent, the
// address that email went to is written in the notice's text, and the email
// was sent at or before the notice arrived. Per person, the latest such email
// is the one that bounced. Anything less is not a bounce.
export const matchBounce = ({
  bounceReceivedAt,
  bounceText,
  outbound,
}: {
  bounceReceivedAt: string;
  bounceText: string | null | undefined;
  outbound: readonly OutboundInThread[];
}): BounceTarget[] => {
  const addresses = addressesIn(bounceText);
  const bouncedAt = instantOf(bounceReceivedAt);

  if (addresses.size === 0 || Number.isNaN(bouncedAt)) {
    return [];
  }

  const latestByPerson = new Map<string, OutboundInThread>();

  for (const email of outbound) {
    const sentAt = instantOf(email.receivedAt);

    if (
      email.direction !== 'OUTBOUND' ||
      email.handle === null ||
      !addresses.has(email.handle) ||
      Number.isNaN(sentAt) ||
      sentAt > bouncedAt
    ) {
      continue;
    }

    const current = latestByPerson.get(email.personId);

    if (current === undefined || instantOf(current.receivedAt) < sentAt) {
      latestByPerson.set(email.personId, email);
    }
  }

  return [...latestByPerson.values()].map((email) => ({
    personId: email.personId,
    messageId: email.messageId,
    occurredOn: email.occurredOn,
    address: email.handle as string,
  }));
};
