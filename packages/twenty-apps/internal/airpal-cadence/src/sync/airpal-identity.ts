// Who is AirPal in a message or meeting. Twenty links a participant to a
// workspace member only when its handle equals the member's login email
// exactly; the same comparison is repeated here case-insensitively so a
// member is never taken for a CRM person (a member may also have a person
// record). A message the connected account sent (a sync association with
// direction OUTGOING, which Twenty sets when the sender is the account's
// handle or one of its aliases) is AirPal's too.
export type AirPalIdentity = {
  memberIds: ReadonlySet<string>;
  memberEmails: ReadonlySet<string>;
};

export type IdentifiableParticipant = {
  handle?: string | null;
  workspaceMemberId?: string | null;
};

export const normalizeHandle = (handle: string | null | undefined): string | null => {
  if (typeof handle !== 'string') {
    return null;
  }

  const trimmed = handle.trim().toLowerCase();

  return trimmed.length === 0 ? null : trimmed;
};

export const buildAirPalIdentity = (
  members: readonly { id: string; userEmail?: string | null }[],
): AirPalIdentity => ({
  memberIds: new Set(members.map((member) => member.id)),
  memberEmails: new Set(
    members
      .map((member) => normalizeHandle(member.userEmail))
      .filter((email): email is string => email !== null),
  ),
});

export const isAirPalParticipant = (
  participant: IdentifiableParticipant,
  identity: AirPalIdentity,
): boolean => {
  if (
    typeof participant.workspaceMemberId === 'string' &&
    participant.workspaceMemberId.length > 0
  ) {
    return true;
  }

  const handle = normalizeHandle(participant.handle);

  return handle !== null && identity.memberEmails.has(handle);
};
