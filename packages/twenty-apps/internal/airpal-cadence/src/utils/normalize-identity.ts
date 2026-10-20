// Suppression matching (SPEC §2): lower-case email or LinkedIn URL. URLs also
// lose their protocol, "www.", query, fragment and trailing slashes, so
// "https://www.linkedin.com/in/Aditi/" and "linkedin.com/in/aditi" match.
export const normalizeEmail = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const email = value.trim().toLowerCase();

  return email.length === 0 ? null : email;
};

export const normalizeLinkedinUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const url = value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');

  return url.length === 0 ? null : url;
};

export type PersonIdentitySource = {
  emails?: {
    primaryEmail?: string | null;
    additionalEmails?: readonly (string | null)[] | null;
  } | null;
  linkedinLink?: {
    primaryLinkUrl?: string | null;
    secondaryLinks?: readonly ({ url?: string | null } | null)[] | null;
  } | null;
};

export type PersonIdentity = {
  emails: string[];
  linkedinUrls: string[];
};

const unique = (values: readonly (string | null)[]): string[] => [
  ...new Set(values.filter((value): value is string => value !== null)),
];

// Every address and profile URL on the person, primary first. Matching uses
// all of them, so a suppressed address kept as a secondary still suppresses.
export const personIdentity = (person: PersonIdentitySource): PersonIdentity => ({
  emails: unique([
    normalizeEmail(person.emails?.primaryEmail),
    ...(person.emails?.additionalEmails ?? []).map(normalizeEmail),
  ]),
  linkedinUrls: unique([
    normalizeLinkedinUrl(person.linkedinLink?.primaryLinkUrl),
    ...(person.linkedinLink?.secondaryLinks ?? []).map((link) =>
      normalizeLinkedinUrl(link?.url),
    ),
  ]),
});

export type SuppressionEntry = {
  email?: string | null;
  linkedinUrl?: string | null;
};

export type SuppressionIndex = {
  emails: Set<string>;
  linkedinUrls: Set<string>;
};

export const buildSuppressionIndex = (
  entries: readonly SuppressionEntry[],
): SuppressionIndex => ({
  emails: new Set(
    entries
      .map((entry) => normalizeEmail(entry.email))
      .filter((email): email is string => email !== null),
  ),
  linkedinUrls: new Set(
    entries
      .map((entry) => normalizeLinkedinUrl(entry.linkedinUrl))
      .filter((url): url is string => url !== null),
  ),
});

export const isSuppressed = (
  identity: PersonIdentity,
  index: SuppressionIndex,
): boolean =>
  identity.emails.some((email) => index.emails.has(email)) ||
  identity.linkedinUrls.some((url) => index.linkedinUrls.has(url));

// What a new suppression for this person must add: every identifier on them
// that the list does not already hold.
export const missingSuppressions = (
  identity: PersonIdentity,
  index: SuppressionIndex,
): { emails: string[]; linkedinUrls: string[] } => ({
  emails: identity.emails.filter((email) => !index.emails.has(email)),
  linkedinUrls: identity.linkedinUrls.filter(
    (url) => !index.linkedinUrls.has(url),
  ),
});
