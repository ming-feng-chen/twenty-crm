import { normalizeFastContactsSearchText } from '@/fast-contacts/utils/normalizeFastContactsSearchText';

export const getFastContactsSearchWords = (searchText: string): string[] =>
  normalizeFastContactsSearchText(searchText).split(/\s+/).filter(Boolean);
