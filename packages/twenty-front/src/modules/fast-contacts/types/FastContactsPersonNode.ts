import {
  type FastContactsPerson,
  type FastContactsTag,
} from '@/fast-contacts/types/FastContactsPerson';

// The person as the API returns it: tags come through the personTag junction.
export type FastContactsPersonNode = Omit<FastContactsPerson, 'tags'> & {
  tags: { edges: { node: { tag: FastContactsTag | null } }[] } | null;
};
