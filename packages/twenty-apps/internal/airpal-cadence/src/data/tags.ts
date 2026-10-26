import { DEFAULT_TAG_NAMES } from 'src/constants/tag-values';
import { appGraphql } from 'src/data/api';
import { ActionError } from 'src/data/http';
import {
  isSameTagName,
  normalizeTagName,
  pickTagColor,
} from 'src/utils/tag-names';

export type TagRecord = {
  id: string;
  name: string | null;
  color: string | null;
  deletedAt?: string | null;
};

const TAG_FIELDS = 'id name color deletedAt';

const isLive = (tag: TagRecord) =>
  typeof tag.deletedAt !== 'string' || tag.deletedAt.length === 0;

// Deleted tags are included so seeding can tell "never had tags" from
// "an Admin deleted them".
const loadAllTags = async (): Promise<TagRecord[]> => {
  const { tags } = await appGraphql<{
    tags: { edges: { node: TagRecord }[] };
  }>(
    `query LoadTags {
      tags(first: 500, filter: { or: [{ deletedAt: { is: NULL } }, { deletedAt: { is: NOT_NULL } }] }) {
        edges { node { ${TAG_FIELDS} } }
      }
    }`,
  );

  return tags.edges.map(({ node }) => node);
};

const insertTag = async (name: string, color: string): Promise<TagRecord> => {
  const { createTag } = await appGraphql<{ createTag: TagRecord }>(
    `mutation CreateTag($data: TagCreateInput!) {
      createTag(data: $data) { ${TAG_FIELDS} }
    }`,
    { data: { name, color } },
  );

  return createTag;
};

// A tag with the same name (ignoring case and spacing) is returned instead of
// creating a second one.
export const createTag = async (
  rawName: string,
): Promise<{ tag: TagRecord; created: boolean }> => {
  const name = normalizeTagName(rawName);

  if (name.length === 0) {
    throw new ActionError(400, 'A tag needs a name.');
  }

  const liveTags = (await loadAllTags()).filter(isLive);
  const existing = liveTags.find(
    (tag) => tag.name !== null && isSameTagName(tag.name, name),
  );

  if (existing !== undefined) {
    return { tag: existing, created: false };
  }

  return {
    tag: await insertTag(name, pickTagColor(liveTags.length)),
    created: true,
  };
};

export const seedDefaultTags = async (): Promise<'seeded' | 'exists'> => {
  if ((await loadAllTags()).length > 0) {
    return 'exists';
  }

  for (const [index, name] of DEFAULT_TAG_NAMES.entries()) {
    await insertTag(name, pickTagColor(index));
  }

  return 'seeded';
};
