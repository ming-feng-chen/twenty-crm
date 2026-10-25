// Lowercase and drop accents so "garcia" finds "García".
export const normalizeFastContactsSearchText = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
