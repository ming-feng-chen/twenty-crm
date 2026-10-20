import { describe, expect, it } from 'vitest';

import {
  addressesIn,
  isAutomatedSender,
  isAutoReplySubject,
  isBounceSender,
  isBounceSubject,
  RESTRICTED_FIELD_PLACEHOLDER,
} from 'src/sync/automated-mail';

describe('isAutoReplySubject', () => {
  it.each([
    'Automatic reply: Intro from AirPal',
    'Auto-Reply: Intro from AirPal',
    'AutoReply: Intro',
    'Auto reply - back Monday',
    'Out of Office: Intro from AirPal',
    'Out of office until 3 November',
    'OUT OF THE OFFICE',
    'OOO until Monday',
    '[Out of Office] Intro from AirPal',
    'Abwesenheitsnotiz: Intro von AirPal',
    'Automatische Antwort: Intro',
    'Réponse automatique : Intro',
    'Reponse automatique: Intro',
    'Absence du bureau',
    'Respuesta automática: Intro',
    'Fuera de la oficina',
    'Risposta automatica: Intro',
    'Fuori ufficio',
    'Resposta automática: Intro',
    'Automatisch antwoord: Intro',
    'Autosvar: Intro',
    'Automatiskt svar: Intro',
    'Automaattinen vastaus: Intro',
    'Automatyczna odpowiedź: Intro',
    'Automatická odpověď: Intro',
    'Otomatik yanıt: Intro',
    'Автоматический ответ: Intro',
    '自动回复: Intro',
    '自動応答: Intro',
    '  Automatic reply: leading spaces',
  ])('recognises %s', (subject) => {
    expect(isAutoReplySubject(subject)).toBe(true);
  });

  it.each([
    'Re: Intro from AirPal',
    'Re: Automatic reply: Intro from AirPal',
    'Re: out of office cover next week?',
    'RE: Out of office - who covers?',
    'Outreach follow-up',
    'Automation in airports',
    'Autoreplying is annoying',
    'Ooops, wrong attachment',
    'Pilot discussion',
    '',
  ])('does not take %s for an automatic reply', (subject) => {
    expect(isAutoReplySubject(subject)).toBe(false);
  });

  it('treats an unknown or restricted subject as not detectable', () => {
    expect(isAutoReplySubject(null)).toBe(false);
    expect(isAutoReplySubject(undefined)).toBe(false);
    expect(isAutoReplySubject(RESTRICTED_FIELD_PLACEHOLDER)).toBe(false);
  });
});

describe('senders', () => {
  it('recognises delivery-status senders', () => {
    expect(isBounceSender('mailer-daemon@googlemail.com')).toBe(true);
    expect(isBounceSender('MAILER-DAEMON@mx.example.com')).toBe(true);
    expect(isBounceSender('postmaster@outlook.com')).toBe(true);
    expect(isBounceSender('aditi@example.com')).toBe(false);
    expect(isBounceSender('postmaster-aditi@example.com')).toBe(false);
    expect(isBounceSender(null)).toBe(false);
  });

  it('recognises addresses nobody replies from', () => {
    expect(isAutomatedSender('noreply@example.com')).toBe(true);
    expect(isAutomatedSender('no-reply@example.com')).toBe(true);
    expect(isAutomatedSender('do-not-reply@example.com')).toBe(true);
    expect(isAutomatedSender('donotreply@example.com')).toBe(true);
    expect(isAutomatedSender('bounce+abc@mailer.example.com')).toBe(true);
    expect(isAutomatedSender('no-reply.calendar@example.com')).toBe(true);
    expect(isAutomatedSender('noreply-alerts@example.com')).toBe(true);
    expect(isAutomatedSender('team.noreply@example.com')).toBe(true);
    expect(isAutomatedSender('notifications+no_reply@example.com')).toBe(true);
    expect(isAutomatedSender('bounces-123@example.com')).toBe(true);
    expect(isAutomatedSender('noreplying@example.com')).toBe(false);
    expect(isAutomatedSender('bouncer@example.com')).toBe(false);
    expect(isAutomatedSender('anoreply@example.com')).toBe(false);
    expect(isAutomatedSender('aditi@example.com')).toBe(false);
    expect(isAutomatedSender('reply@example.com')).toBe(false);
    expect(isAutomatedSender('nora@example.com')).toBe(false);
  });
});

describe('isBounceSubject', () => {
  it.each([
    'Delivery Status Notification (Failure)',
    'Undeliverable: Intro from AirPal',
    'Undelivered Mail Returned to Sender',
    'Mail delivery failed: returning message to sender',
    'Returned mail: see transcript for details',
    'failure notice',
    'Unzustellbar: Intro',
    'Non remis : Intro',
  ])('recognises %s', (subject) => {
    expect(isBounceSubject(subject)).toBe(true);
  });

  it.each([
    'Delivery Status Notification (Delay)',
    'Delivery Status Notification (Delay) warning',
    'Re: Undeliverable: Intro',
    'Intro from AirPal',
    RESTRICTED_FIELD_PLACEHOLDER,
  ])('does not take %s for a failure', (subject) => {
    expect(isBounceSubject(subject)).toBe(false);
  });
});

describe('addressesIn', () => {
  it('finds failed addresses and ignores quoted header lines', () => {
    const text = [
      'Address not found',
      "Your message wasn't delivered to Aditi@Example.com because the address couldn't be found.",
      'The response was: 550 5.1.1 <aditi@example.com>: user unknown.',
      '----- Original message -----',
      'From: rep@airpal.co.uk',
      'To: aditi@example.com, ben@example.org',
      'Cc: carla@example.net',
    ].join('\n');

    expect([...addressesIn(text)].sort()).toEqual(['aditi@example.com']);
  });

  it('is empty for missing or restricted text', () => {
    expect(addressesIn(null).size).toBe(0);
    expect(addressesIn(RESTRICTED_FIELD_PLACEHOLDER).size).toBe(0);
  });
});
