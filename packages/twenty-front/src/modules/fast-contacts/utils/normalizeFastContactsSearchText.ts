import { doNotTranslate } from 'twenty-shared/i18n';

// Lowercase and drop accents so "garcia" finds "García".
export const normalizeFastContactsSearchText = (text: string): string =>
  text
    .normalize(doNotTranslate('NFD'))
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
