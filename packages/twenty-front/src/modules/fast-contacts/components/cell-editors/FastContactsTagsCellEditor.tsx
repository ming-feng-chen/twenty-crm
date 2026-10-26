import { useLingui } from '@lingui/react/macro';
import { isNonEmptyArray, isNonEmptyString } from '@sniptt/guards';
import { type RefObject, useState } from 'react';
import { Dropdown } from 'twenty-ui/components/navigation';
import { IconPlus } from 'twenty-ui/icon';
import { Tag } from 'twenty-ui/primitives/data-display';

import { useFastContactsEditorClose } from '@/fast-contacts/hooks/useFastContactsEditorClose';
import { type FastContactsTag } from '@/fast-contacts/types/FastContactsPerson';
import { getFastContactsTagColor } from '@/fast-contacts/utils/getFastContactsTagColor';
import { normalizeFastContactsSearchText } from '@/fast-contacts/utils/normalizeFastContactsSearchText';

type FastContactsTagsCellEditorProps = {
  anchorRef: RefObject<HTMLElement | null>;
  allTags: FastContactsTag[];
  initialTags: FastContactsTag[];
  initialSearch: string;
  onCreateTag: (name: string) => Promise<FastContactsTag | null>;
  onCommit: (tags: FastContactsTag[]) => void;
};

// Ticking and unticking happen in the list; closing it saves the result as
// one change, so a single Ctrl+Z puts every tag back.
export const FastContactsTagsCellEditor = ({
  anchorRef,
  allTags,
  initialTags,
  initialSearch,
  onCreateTag,
  onCommit,
}: FastContactsTagsCellEditorProps) => {
  const { t } = useLingui();
  const close = useFastContactsEditorClose();
  const [search, setSearch] = useState(initialSearch);
  const [selectedTags, setSelectedTags] = useState(initialTags);
  const [createdTags, setCreatedTags] = useState<FastContactsTag[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const tags = [
    ...allTags,
    ...createdTags.filter(
      (createdTag) => !allTags.some((tag) => tag.id === createdTag.id),
    ),
  ];
  const normalizedSearch = normalizeFastContactsSearchText(search.trim());
  const filteredTags = tags.filter((tag) =>
    normalizeFastContactsSearchText(tag.name ?? '').includes(normalizedSearch),
  );
  const hasExactMatch = tags.some(
    (tag) =>
      normalizeFastContactsSearchText(tag.name ?? '') === normalizedSearch,
  );
  const canCreate = isNonEmptyString(search.trim()) && !hasExactMatch;

  const toggleTag = (tag: FastContactsTag) =>
    setSelectedTags((currentTags) =>
      currentTags.some((currentTag) => currentTag.id === tag.id)
        ? currentTags.filter((currentTag) => currentTag.id !== tag.id)
        : [...currentTags, tag],
    );

  const handleCreate = async () => {
    setIsCreating(true);

    const tag = await onCreateTag(search.trim());

    setIsCreating(false);

    if (tag !== null) {
      setCreatedTags((currentTags) => [...currentTags, tag]);
      setSelectedTags((currentTags) =>
        currentTags.some((currentTag) => currentTag.id === tag.id)
          ? currentTags
          : [...currentTags, tag],
      );
      setSearch('');
    }
  };

  return (
    <Dropdown.Root
      type="picker"
      multiple
      open
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          close(() => onCommit(selectedTags));
        }
      }}
    >
      <Dropdown.Content
        anchor={anchorRef}
        side="bottom"
        align="start"
        aria-label={t`Tags`}
        width={260}
      >
        <Dropdown.Search
          autoFocus
          aria-label={t`Search tags`}
          placeholder={t`Search or create a tag`}
          value={search}
          onValueChange={setSearch}
        />
        <Dropdown.Section scrollable>
          {filteredTags.map((tag) => (
            <Dropdown.OptionItem
              key={tag.id}
              indicator="checkbox"
              closeOnSelect={false}
              selected={selectedTags.some(
                (selectedTag) => selectedTag.id === tag.id,
              )}
              onSelect={() => toggleTag(tag)}
            >
              <Tag color={getFastContactsTagColor(tag.color)}>{tag.name}</Tag>
            </Dropdown.OptionItem>
          ))}
          {canCreate && (
            <Dropdown.ActionItem
              startIcon={<IconPlus />}
              closeOnClick={false}
              disabled={isCreating}
              onClick={() => void handleCreate()}
            >
              {t`Create tag "${search.trim()}"`}
            </Dropdown.ActionItem>
          )}
          {!isNonEmptyArray(filteredTags) && !canCreate && (
            <Dropdown.Empty>{t`No tags yet`}</Dropdown.Empty>
          )}
        </Dropdown.Section>
      </Dropdown.Content>
    </Dropdown.Root>
  );
};
