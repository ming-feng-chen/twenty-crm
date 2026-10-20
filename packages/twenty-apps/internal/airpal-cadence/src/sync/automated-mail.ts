// What can be told about an automated email from the fields Twenty stores on a
// message record. Twenty keeps no headers (no Auto-Submitted, X-Autoreply,
// Precedence, X-Failed-Recipients): only subject, text, receivedAt and the
// participants' handles. The strongest header signal is applied by Twenty
// itself at import: with the channel's "exclude group emails" setting on (the
// default), an incoming message carrying Auto-Submitted (other than "no"),
// Precedence bulk/list/junk, List-Id or List-Unsubscribe is never imported.
// What is left to the app is the subject and the sender's address.

// The value Twenty puts in place of a subject or text the reader may not see.
export const RESTRICTED_FIELD_PLACEHOLDER =
  'FIELD_RESTRICTED_ADDITIONAL_PERMISSIONS_REQUIRED';

export const isRestrictedValue = (value: string | null | undefined): boolean =>
  value === RESTRICTED_FIELD_PLACEHOLDER;

// Subject prefixes that mail clients and servers put on out-of-office and
// automatic replies, in the languages AirPal's contacts write in and their
// neighbours. Matched at the very start of the subject only (after spaces and
// an opening bracket), so "Re: out of office cover next week" — a person
// replying — is not taken for an automatic reply. Lower case, accents kept.
const AUTO_REPLY_SUBJECT_PREFIXES = [
  // English
  'automatic reply',
  'auto reply',
  'auto-reply',
  'autoreply',
  'auto response',
  'auto-response',
  'autoresponse',
  'automated response',
  'automated reply',
  'out of office',
  'out of the office',
  'out-of-office',
  'ooo',
  'away from the office',
  'away from office',
  'on leave:',
  'vacation reply',
  'holiday reply',
  // German
  'automatische antwort',
  'abwesenheitsnotiz',
  'abwesenheitsmeldung',
  'abwesenheit:',
  'automatische abwesenheit',
  'nicht im büro',
  'außer haus',
  'ausser haus',
  // French
  'réponse automatique',
  'reponse automatique',
  'absence du bureau',
  'absent du bureau',
  "message d'absence",
  // Spanish
  'respuesta automática',
  'respuesta automatica',
  'fuera de la oficina',
  'fuera de oficina',
  'ausencia de la oficina',
  // Italian
  'risposta automatica',
  'fuori ufficio',
  "fuori dall'ufficio",
  'fuori sede',
  // Portuguese
  'resposta automática',
  'resposta automatica',
  'fora do escritório',
  'fora do escritorio',
  'ausente do escritório',
  // Dutch
  'automatisch antwoord',
  'afwezigheidsbericht',
  'afwezig:',
  'niet op kantoor',
  // Nordic
  'autosvar',
  'automatiskt svar',
  'automatisk svar',
  'automatisk besked',
  'automaattinen vastaus',
  'poissa toimistolta',
  // Polish, Czech, Slovak, Hungarian, Romanian, Turkish, Greek
  'automatyczna odpowiedź',
  'odpowiedź automatyczna',
  'poza biurem',
  'automatická odpověď',
  'automatická odpoveď',
  'mimo kancelář',
  'automatikus válasz',
  'házon kívül',
  'răspuns automat',
  'raspuns automat',
  'otomatik yanıt',
  'otomatik cevap',
  'ofis dışında',
  'αυτόματη απάντηση',
  'εκτός γραφείου',
  // Russian, Ukrainian
  'автоматический ответ',
  'автоответ',
  'нет на месте',
  'автоматична відповідь',
  // Arabic, Hebrew
  'رد تلقائي',
  'خارج المكتب',
  'תשובה אוטומטית',
  'מחוץ למשרד',
  // Chinese, Japanese, Korean
  '自动回复',
  '自動回覆',
  '自動回复',
  '不在办公室',
  '自動応答',
  '自動返信',
  '不在のお知らせ',
  '자동 응답',
  '자동응답',
  '부재중',
];

const leadingNoise = /^[\s[(【「『<{"'*-]+/u;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const WORD_FINAL = /[\p{L}\p{N}]$/u;
const NO_SPACE_SCRIPT_FINAL =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u;

const subjectStart = (subject: string): string =>
  subject.normalize('NFC').replace(leadingNoise, '').toLowerCase();

// True when the subject starts like an automatic or out-of-office reply.
// Unknown (null, empty or a restricted placeholder) is false: nothing to see.
export const isAutoReplySubject = (subject: string | null | undefined): boolean => {
  if (typeof subject !== 'string' || isRestrictedValue(subject)) {
    return false;
  }

  const start = subjectStart(subject);

  return AUTO_REPLY_SUBJECT_PREFIXES.some((prefix) => {
    if (!start.startsWith(prefix)) {
      return false;
    }

    // A whole word or phrase: "autoreply" must not match "autoreplying".
    // Scripts written without spaces (Chinese, Japanese) need no boundary.
    if (!WORD_FINAL.test(prefix) || NO_SPACE_SCRIPT_FINAL.test(prefix)) {
      return true;
    }

    const next = start.charAt(prefix.length);

    return next === '' || !WORD_CHARACTER.test(next);
  });
};

const localPart = (handle: string | null | undefined): string | null => {
  if (typeof handle !== 'string') {
    return null;
  }

  const trimmed = handle.trim().toLowerCase();
  const at = trimmed.lastIndexOf('@');

  return at <= 0 ? null : trimmed.slice(0, at);
};

// Delivery-status senders. Their messages are bounces, delays or other
// delivery reports, never a person writing.
const BOUNCE_SENDER_LOCAL_PARTS = new Set([
  'mailer-daemon',
  'mailerdaemon',
  'mail-daemon',
  'postmaster',
]);

export const isBounceSender = (handle: string | null | undefined): boolean => {
  const local = localPart(handle);

  return local !== null && BOUNCE_SENDER_LOCAL_PARTS.has(local);
};

// Addresses no person answers from. A message from one is never a reply.
const AUTOMATED_SENDER_LOCAL_PART =
  /^((.*[-_.+])?(no[-_.]?reply|do[-_.]?not[-_.]?reply|dont[-_.]?reply)([-_.+].*)?|bounces?([-_.+].*)?|mailer-daemon|mailerdaemon|mail-daemon|postmaster)$/;

export const isAutomatedSender = (handle: string | null | undefined): boolean => {
  const local = localPart(handle);

  return local !== null && AUTOMATED_SENDER_LOCAL_PART.test(local);
};

// Subjects of permanent delivery failures from the common mail servers
// (Gmail, Microsoft 365/Exchange, Postfix, Exim, Sendmail, qmail). Delays and
// warnings are not failures: the message may still be delivered.
const BOUNCE_SUBJECT_PATTERNS = [
  /^delivery status notification \(failure\)/,
  /^undeliverable:/,
  /^undelivered mail returned to sender/,
  /^undelivered mail/,
  /^mail delivery failed/,
  /^returned mail:/,
  /^failure notice/,
  /^delivery failure/,
  /^delivery has failed/,
  /^message not delivered/,
  /^mail delivery failure/,
  /^nicht zustellbar:/,
  /^unzustellbar:/,
  /^non remis :/,
  /^non remis:/,
  /^no se puede entregar:/,
  /^non recapitabile:/,
  /^onbestelbaar:/,
];

const NOT_A_FAILURE = /\b(delay|delayed|warning|relayed|will retry|still trying)\b/;

export const isBounceSubject = (subject: string | null | undefined): boolean => {
  if (typeof subject !== 'string' || isRestrictedValue(subject)) {
    return false;
  }

  const start = subjectStart(subject);

  return (
    BOUNCE_SUBJECT_PATTERNS.some((pattern) => pattern.test(start)) &&
    !NOT_A_FAILURE.test(start)
  );
};

const EMAIL_ADDRESS = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+/gi;

// A line that quotes a header of the original message ("To: a@x, b@y"): a
// bounce often repeats the original's recipients, so an address there does
// not say which one failed.
const QUOTED_HEADER_LINE =
  /^[\s>]*(to|cc|bcc|from|reply-to|sender|return-path|delivered-to|envelope-to|an|von|kopie|de|à|a|para|aan|van|da|till|från|til|fra|kimden|kime)\s*:/i;

// Every address written in a bounce's text, lower case, leaving out lines
// that quote the original message's headers.
export const addressesIn = (text: string | null | undefined): Set<string> => {
  if (typeof text !== 'string' || isRestrictedValue(text)) {
    return new Set();
  }

  const addresses = text
    .split(/\r?\n/)
    .filter((line) => !QUOTED_HEADER_LINE.test(line))
    .flatMap((line) => line.match(EMAIL_ADDRESS) ?? []);

  return new Set(
    addresses.map((address) => address.toLowerCase().replace(/\.+$/, '')),
  );
};
