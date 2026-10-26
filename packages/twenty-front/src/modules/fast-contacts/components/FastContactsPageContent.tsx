import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { saveAs } from 'file-saver';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppPath, CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';
import { useToast } from 'twenty-ui/components/feedback';
import { Button } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceMembersState } from '@/auth/states/currentWorkspaceMembersState';
import {
  type FastContactsColumnMenuAnchor,
  FastContactsColumnMenu,
} from '@/fast-contacts/components/FastContactsColumnMenu';
import { FastContactsGrid } from '@/fast-contacts/components/FastContactsGrid';
import { FastContactsHandoverDialog } from '@/fast-contacts/components/FastContactsHandoverDialog';
import { FastContactsTabBar } from '@/fast-contacts/components/FastContactsTabBar';
import { FastContactsToolbar } from '@/fast-contacts/components/FastContactsToolbar';
import { FAST_CONTACTS_COLUMNS } from '@/fast-contacts/constants/FastContactsColumns';
import { FAST_CONTACTS_TABS } from '@/fast-contacts/constants/FastContactsTabs';
import { useFastContactsCellFormatContext } from '@/fast-contacts/hooks/useFastContactsCellFormatContext';
import { useFastContactsCompanies } from '@/fast-contacts/hooks/useFastContactsCompanies';
import { useFastContactsPeople } from '@/fast-contacts/hooks/useFastContactsPeople';
import { useFastContactsTags } from '@/fast-contacts/hooks/useFastContactsTags';
import { useFastContactsWriter } from '@/fast-contacts/hooks/useFastContactsWriter';
import { fastContactsActiveTabState } from '@/fast-contacts/states/fastContactsActiveTabState';
import { fastContactsColumnWidthsState } from '@/fast-contacts/states/fastContactsColumnWidthsState';
import { fastContactsSheetLayoutsState } from '@/fast-contacts/states/fastContactsSheetLayoutsState';
import { type FastContactsCellValue } from '@/fast-contacts/types/FastContactsCellValue';
import {
  type FastContactsCellWrite,
  type FastContactsSkippedCell,
} from '@/fast-contacts/types/FastContactsCellWrite';
import { type FastContactsColumnFilter } from '@/fast-contacts/types/FastContactsColumnFilter';
import {
  type FastContactsColumn,
  type FastContactsColumnKey,
} from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsEditContext } from '@/fast-contacts/types/FastContactsEditContext';
import { type FastContactsEditingCell } from '@/fast-contacts/types/FastContactsEditingCell';
import { type FastContactsTag } from '@/fast-contacts/types/FastContactsPerson';
import { type FastContactsSelection } from '@/fast-contacts/types/FastContactsSelection';
import {
  type FastContactsSheetLayout,
  type FastContactsSortDirection,
} from '@/fast-contacts/types/FastContactsSheetLayout';
import { type FastContactsTabKey } from '@/fast-contacts/types/FastContactsTab';
import { computeFastContactsRowIds } from '@/fast-contacts/utils/computeFastContactsRowIds';
import { findFastContactsDuplicates } from '@/fast-contacts/utils/findFastContactsDuplicates';
import { formatFastContactsFullName } from '@/fast-contacts/utils/formatFastContactsFullName';
import { generateFastContactsCsv } from '@/fast-contacts/utils/generateFastContactsCsv';
import { getDefaultFastContactsSheetLayout } from '@/fast-contacts/utils/getDefaultFastContactsSheetLayout';
import { getFastContactsExportFileName } from '@/fast-contacts/utils/getFastContactsExportFileName';
import { getFastContactsPasteInputs } from '@/fast-contacts/utils/getFastContactsPasteInputs';
import { getFastContactsSearchTextByPersonId } from '@/fast-contacts/utils/getFastContactsSearchTextByPersonId';
import { getFastContactsSearchWords } from '@/fast-contacts/utils/getFastContactsSearchWords';
import { getFastContactsSelectedCells } from '@/fast-contacts/utils/getFastContactsSelectedCells';
import { getFastContactsVisibleColumns } from '@/fast-contacts/utils/getFastContactsVisibleColumns';
import { normalizeFastContactsSheetLayout } from '@/fast-contacts/utils/normalizeFastContactsSheetLayout';
import {
  type FastContactsCellInput,
  planFastContactsCellInputs,
} from '@/fast-contacts/utils/planFastContactsCellInputs';
import { useObjectMetadataItems } from '@/object-metadata/hooks/useObjectMetadataItems';
import { getFieldPermissions } from '@/object-metadata/utils/getFieldPermissions';
import { useObjectPermissions } from '@/object-record/hooks/useObjectPermissions';
import { useObjectPermissionsForObject } from '@/object-record/hooks/useObjectPermissionsForObject';
import { type FieldFullNameValue } from '@/object-record/record-field/ui/types/FieldMetadata';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useNavigateApp } from '~/hooks/useNavigateApp';

const StyledContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;

const StyledMessage = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[4]};
`;

const EMPTY_SEARCH_TEXT_BY_TAB_KEY: Record<FastContactsTabKey, string> = {
  all: '',
  partner: '',
  airport: '',
  cold: '',
};

const INITIAL_SELECTION: FastContactsSelection = {
  anchor: { rowIndex: 0, columnIndex: 0 },
  focus: { rowIndex: 0, columnIndex: 0 },
  selectedRowIds: null,
};

type ColumnMenuState = {
  columnKey: FastContactsColumnKey;
  anchor: FastContactsColumnMenuAnchor;
};

// Rows keep their place while people edit: the order is only recomputed when
// the sheet, sort, filters or search change, or after a full reload.
type RowOrder = {
  signature: string;
  rowIds: string[];
  knownPersonIds: Set<string>;
};

export const FastContactsPageContent = () => {
  const { t, i18n } = useLingui();
  const navigateApp = useNavigateApp();
  const { enqueueToast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridViewportRef = useRef<HTMLDivElement>(null);

  const {
    people,
    peopleById,
    peopleByIdAtom,
    loadStatus,
    fullLoadCount,
    personObjectMetadataItem,
    reloadPeople,
    upsertPeopleLocally,
  } = useFastContactsPeople();
  const { companies, addCompanyLocally } = useFastContactsCompanies();
  const { tags, addTagLocally } = useFastContactsTags();
  const { objectMetadataItems } = useObjectMetadataItems();
  const { objectPermissionsByObjectMetadataId } = useObjectPermissions();
  const currentWorkspaceMembers = useAtomStateValue(
    currentWorkspaceMembersState,
  );
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const formatContext = useFastContactsCellFormatContext(
    personObjectMetadataItem,
  );
  const objectPermissions = useObjectPermissionsForObject(
    personObjectMetadataItem.id,
  );

  const editContext = useMemo<FastContactsEditContext>(
    () => ({
      formatContext,
      companies,
      tags,
      members: currentWorkspaceMembers.map((member) => ({
        id: member.id,
        name: member.name ?? null,
        userEmail: member.userEmail ?? null,
      })),
      requiredColumnKeys: FAST_CONTACTS_COLUMNS.filter(
        (column) =>
          column.kind === 'select' &&
          personObjectMetadataItem.fields.find(
            (field) => field.name === column.key,
          )?.isNullable === false,
      ).map((column) => column.key),
    }),
    [
      formatContext,
      companies,
      tags,
      currentWorkspaceMembers,
      personObjectMetadataItem,
    ],
  );

  const uniqueColumnKeys = useMemo(
    () =>
      new Set<string>(
        personObjectMetadataItem.fields
          .filter((field) => field.isUnique === true)
          .map((field) => field.name),
      ),
    [personObjectMetadataItem],
  );

  // Tagging creates and deletes personTag records, so it needs both on that object.
  const personTagObjectMetadataItemId = objectMetadataItems.find(
    (objectMetadataItem) => objectMetadataItem.nameSingular === 'personTag',
  )?.id;
  const personTagPermissions = isDefined(personTagObjectMetadataItemId)
    ? objectPermissionsByObjectMetadataId[personTagObjectMetadataItemId]
    : undefined;
  const canEditTags =
    personTagPermissions?.canUpdateObjectRecords === true &&
    personTagPermissions.canSoftDeleteObjectRecords === true;

  const editableColumnKeys = useMemo(
    () =>
      new Set<string>(
        FAST_CONTACTS_COLUMNS.filter((column) => {
          const field = personObjectMetadataItem.fields.find(
            (candidate) => candidate.name === column.key,
          );

          return (
            column.isEditable &&
            isDefined(field) &&
            field.isUIEditable !== false &&
            objectPermissions.canUpdateObjectRecords &&
            getFieldPermissions({
              objectPermissions,
              fieldMetadataId: field.id,
            }).canUpdateField &&
            (column.kind !== 'tags' || canEditTags)
          );
        }).map((column) => column.key),
      ),
    [personObjectMetadataItem, objectPermissions, canEditTags],
  );

  const formatPersonName = useCallback(
    (personId: string) =>
      formatFastContactsFullName(peopleById.get(personId)?.name) ||
      t`Unnamed contact`,
    [peopleById, t],
  );

  const writer = useFastContactsWriter({
    peopleByIdAtom,
    upsertPeopleLocally,
    formatPersonName,
  });

  const [fastContactsActiveTab, setFastContactsActiveTab] = useAtomState(
    fastContactsActiveTabState,
  );
  const [fastContactsSheetLayouts, setFastContactsSheetLayouts] = useAtomState(
    fastContactsSheetLayoutsState,
  );
  const [fastContactsColumnWidths, setFastContactsColumnWidths] = useAtomState(
    fastContactsColumnWidthsState,
  );
  const [columnWidthOverride, setColumnWidthOverride] = useState<{
    columnKey: FastContactsColumnKey;
    width: number;
  } | null>(null);
  const [searchTextByTabKey, setSearchTextByTabKey] = useState(
    EMPTY_SEARCH_TEXT_BY_TAB_KEY,
  );
  const [selection, setSelection] =
    useState<FastContactsSelection>(INITIAL_SELECTION);
  const [columnMenu, setColumnMenu] = useState<ColumnMenuState | null>(null);
  const [isDraftRowVisible, setIsDraftRowVisible] = useState(false);
  const [pendingEditingCell, setPendingEditingCell] =
    useState<FastContactsEditingCell | null>(null);
  const [pinnedPersonIds, setPinnedPersonIds] = useState<string[]>([]);

  const activeTab =
    FAST_CONTACTS_TABS.find((tab) => tab.key === fastContactsActiveTab) ??
    FAST_CONTACTS_TABS[0];
  const layout = useMemo(
    () =>
      normalizeFastContactsSheetLayout(fastContactsSheetLayouts[activeTab.key]),
    [fastContactsSheetLayouts, activeTab.key],
  );
  const visibleColumns = useMemo(
    () => getFastContactsVisibleColumns(layout),
    [layout],
  );
  const columnWidths = useMemo(
    () =>
      Object.fromEntries(
        FAST_CONTACTS_COLUMNS.map((column) => [
          column.key,
          columnWidthOverride?.columnKey === column.key
            ? columnWidthOverride.width
            : (fastContactsColumnWidths[column.key] ?? column.defaultWidth),
        ]),
      ) as Record<FastContactsColumnKey, number>,
    [columnWidthOverride, fastContactsColumnWidths],
  );

  const searchText = searchTextByTabKey[activeTab.key];
  const searchWords = useMemo(
    () => getFastContactsSearchWords(searchText),
    [searchText],
  );
  const searchTextByPersonId = useMemo(
    () => getFastContactsSearchTextByPersonId({ people, formatContext }),
    [people, formatContext],
  );

  const computeRowIdsFor = (candidates: typeof people) =>
    computeFastContactsRowIds({
      people: candidates,
      tab: activeTab,
      layout,
      searchWords,
      searchTextByPersonId,
      formatContext,
    });

  const rowOrderSignature = JSON.stringify([
    activeTab.key,
    layout.sort,
    layout.filters,
    searchWords,
    fullLoadCount,
  ]);
  const [rowOrder, setRowOrder] = useState<RowOrder>({
    signature: '',
    rowIds: [],
    knownPersonIds: new Set(),
  });
  let currentRowOrder = rowOrder;

  if (rowOrder.signature !== rowOrderSignature) {
    currentRowOrder = {
      signature: rowOrderSignature,
      rowIds: computeRowIdsFor(people),
      knownPersonIds: new Set(people.map((person) => person.id)),
    };
    setRowOrder(currentRowOrder);
  }

  const rows = useMemo(() => {
    const pinnedIdSet = new Set(pinnedPersonIds);
    const newcomerIds = computeRowIdsFor(
      people.filter(
        (person) =>
          !currentRowOrder.knownPersonIds.has(person.id) &&
          !pinnedIdSet.has(person.id),
      ),
    );

    return [
      ...pinnedPersonIds,
      ...currentRowOrder.rowIds.filter((rowId) => !pinnedIdSet.has(rowId)),
      ...newcomerIds,
    ]
      .map((rowId) => peopleById.get(rowId))
      .filter(isDefined);
    // computeRowIdsFor reads the same inputs as the dependencies listed here.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRowOrder, pinnedPersonIds, people, peopleById]);

  const countByTabKey = useMemo(
    () =>
      Object.fromEntries(
        FAST_CONTACTS_TABS.map((tab) => [
          tab.key,
          people.filter((person) => tab.includesPerson(person)).length,
        ]),
      ) as Record<FastContactsTabKey, number>,
    [people],
  );

  const hasActiveFilters =
    searchWords.length > 0 || Object.keys(layout.filters).length > 0;

  // Ctrl+F searches this sheet instead of opening the browser's find bar.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'f'
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const updateLayout = (
    update: (currentLayout: FastContactsSheetLayout) => FastContactsSheetLayout,
  ) => {
    setFastContactsSheetLayouts({
      ...fastContactsSheetLayouts,
      [activeTab.key]: update(layout),
    });
  };

  const resetSelection = () => setSelection(INITIAL_SELECTION);

  const handleTabChange = (tabKey: FastContactsTabKey) => {
    setFastContactsActiveTab(tabKey);
    setPinnedPersonIds([]);
    resetSelection();
  };

  const handleSearchTextChange = (nextSearchText: string) => {
    setSearchTextByTabKey({
      ...searchTextByTabKey,
      [activeTab.key]: nextSearchText,
    });
    resetSelection();
  };

  const handleClearFilters = () => {
    setSearchTextByTabKey({ ...searchTextByTabKey, [activeTab.key]: '' });
    updateLayout((currentLayout) => ({ ...currentLayout, filters: {} }));
    resetSelection();
    gridViewportRef.current?.focus();
  };

  const setSort = (
    columnKey: FastContactsColumnKey,
    direction: FastContactsSortDirection | null,
  ) => {
    updateLayout((currentLayout) => ({
      ...currentLayout,
      sort: isDefined(direction) ? { columnKey, direction } : null,
    }));
    resetSelection();
  };

  const handleSortClick = (columnKey: FastContactsColumnKey) => {
    const currentDirection =
      layout.sort?.columnKey === columnKey ? layout.sort.direction : null;

    setSort(
      columnKey,
      currentDirection === null
        ? 'asc'
        : currentDirection === 'asc'
          ? 'desc'
          : null,
    );
  };

  const handleFilterChange = (
    columnKey: FastContactsColumnKey,
    filter: FastContactsColumnFilter | null,
  ) => {
    updateLayout((currentLayout) => {
      const { [columnKey]: _removedFilter, ...otherFilters } =
        currentLayout.filters;

      return {
        ...currentLayout,
        filters: isDefined(filter)
          ? { ...otherFilters, [columnKey]: filter }
          : otherFilters,
      };
    });
    resetSelection();
  };

  const handleToggleColumn = (columnKey: FastContactsColumnKey) =>
    updateLayout((currentLayout) => {
      const isHidden = currentLayout.hiddenColumnKeys.includes(columnKey);

      return normalizeFastContactsSheetLayout({
        ...currentLayout,
        hiddenColumnKeys: isHidden
          ? currentLayout.hiddenColumnKeys.filter((key) => key !== columnKey)
          : [...currentLayout.hiddenColumnKeys, columnKey],
      });
    });

  const handleMoveColumn = (
    columnKey: FastContactsColumnKey,
    beforeColumnKey: FastContactsColumnKey,
  ) =>
    updateLayout((currentLayout) => {
      const orderWithoutColumn = currentLayout.columnOrder.filter(
        (key) => key !== columnKey,
      );
      const targetIndex = orderWithoutColumn.indexOf(beforeColumnKey);

      return normalizeFastContactsSheetLayout({
        ...currentLayout,
        columnOrder: [
          ...orderWithoutColumn.slice(0, targetIndex),
          columnKey,
          ...orderWithoutColumn.slice(targetIndex),
        ],
      });
    });

  const writeCells = (
    writes: FastContactsCellWrite[],
    skippedCells: FastContactsSkippedCell[],
    isSingleCellEdit: boolean,
  ) => {
    const validWrites: FastContactsCellWrite[] = [];
    const allSkippedCells = [...skippedCells];

    for (const write of writes) {
      const name = write.value as FieldFullNameValue | null;

      if (
        write.columnKey === 'name' &&
        formatFastContactsFullName(name).trim() === ''
      ) {
        allSkippedCells.push({
          personId: write.personId,
          columnKey: 'name',
          reason: t`A contact needs a name`,
        });
      } else {
        validWrites.push(write);
      }
    }

    const duplicates = findFastContactsDuplicates({
      writes: validWrites,
      peopleById,
    });
    const describePerson = (personId: string) => {
      const personName = formatPersonName(personId);
      const companyName = peopleById.get(personId)?.company?.name ?? '';

      return companyName === '' ? personName : `${personName} (${companyName})`;
    };
    // The database refuses a second contact with a unique value (the email),
    // so those are skipped with a clear reason instead of a server error.
    const blockingDuplicates = duplicates.filter((duplicate) =>
      uniqueColumnKeys.has(duplicate.columnKey),
    );
    const warningDuplicates = duplicates.filter(
      (duplicate) => !uniqueColumnKeys.has(duplicate.columnKey),
    );

    for (const duplicate of blockingDuplicates) {
      const existingPerson = describePerson(duplicate.existingPersonId);

      allSkippedCells.push({
        personId: duplicate.personId,
        columnKey: duplicate.columnKey,
        reason: t`${existingPerson} already has this email`,
      });
    }

    const writesToSave = validWrites.filter(
      (write) =>
        !blockingDuplicates.some(
          (duplicate) =>
            duplicate.personId === write.personId &&
            duplicate.columnKey === write.columnKey,
        ),
    );

    if (warningDuplicates.length > 0) {
      const [firstDuplicate] = warningDuplicates;
      const existingPerson = describePerson(firstDuplicate.existingPersonId);
      const otherCount = warningDuplicates.length - 1;

      enqueueToast({
        status: 'warning',
        children: t`Already exists: ${existingPerson}`,
        description:
          otherCount > 0
            ? t`And ${otherCount} more matching contacts.`
            : undefined,
        action: (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenPerson(firstDuplicate.existingPersonId)}
          >
            <Trans>Open</Trans>
          </Button>
        ),
      });
    }

    void writer.writeCells({
      writes: writesToSave,
      skippedCells: allSkippedCells,
      isSingleCellEdit,
    });
  };

  const writeTexts = (
    inputs: FastContactsCellInput[],
    isSingleCellEdit: boolean,
  ) => {
    const { writes, skippedCells } = planFastContactsCellInputs({
      inputs,
      peopleById,
      editContext,
    });

    writeCells(writes, skippedCells, isSingleCellEdit);
  };

  const getSelectedCells = () =>
    getFastContactsSelectedCells({
      selection,
      rowIds: rows.map((row) => row.id),
      visibleColumns,
    });

  const handlePasteValues = (values: string[][]) => {
    const { inputs, outsideCellCount } = getFastContactsPasteInputs({
      values,
      selectedCells: getSelectedCells(),
      rowIds: rows.map((row) => row.id),
      visibleColumns,
    });

    if (outsideCellCount > 0) {
      enqueueToast({
        status: 'info',
        children: plural(outsideCellCount, {
          one: '# pasted cell did not fit and was left out',
          other: '# pasted cells did not fit and were left out',
        }),
      });
    }

    writeTexts(inputs, false);
  };

  const handleClearSelectedCells = () => {
    const { personIds, columns } = getSelectedCells();

    writeTexts(
      personIds.flatMap((personId) =>
        columns
          .filter((column) => column.key !== 'name')
          .map((column) => ({ personId, column, text: '' })),
      ),
      personIds.length === 1 && columns.length === 1,
    );
  };

  const selectedRowIds = selection.selectedRowIds ?? [];

  const handleBulkChange = (
    columnKey: FastContactsColumnKey,
    value: FastContactsCellValue,
  ) =>
    writeCells(
      selectedRowIds.map((personId) => ({ personId, columnKey, value })),
      [],
      false,
    );

  const handleBulkTagChange = (mode: 'add' | 'remove', tag: FastContactsTag) =>
    writeCells(
      selectedRowIds.flatMap((personId) => {
        const currentTags = peopleById.get(personId)?.tags ?? [];
        const hasTag = currentTags.some(
          (currentTag) => currentTag.id === tag.id,
        );

        if (mode === 'add' ? hasTag : !hasTag) {
          return [];
        }

        return [
          {
            personId,
            columnKey: 'tags' as const,
            value:
              mode === 'add'
                ? [...currentTags, tag]
                : currentTags.filter((currentTag) => currentTag.id !== tag.id),
          },
        ];
      }),
      [],
      false,
    );

  const handleCreateTag = async (name: string) => {
    const tag = await writer.createTag(name);

    if (isDefined(tag)) {
      addTagLocally(tag);
    }

    return tag;
  };

  const handleExport = () => {
    const selectedRowIdSet = new Set(selectedRowIds);
    const exportedRows =
      selectedRowIdSet.size > 0
        ? rows.filter((row) => selectedRowIdSet.has(row.id))
        : rows;
    const csv = generateFastContactsCsv({
      people: exportedRows,
      columns: visibleColumns,
      formatContext,
    });

    saveAs(
      new Blob([csv], { type: 'text/csv;charset=utf-8' }),
      getFastContactsExportFileName({
        sheetLabel: i18n._(activeTab.label),
        date: new Date(),
      }),
    );
  };

  const handleOpenPerson = (personId: string) =>
    navigateApp(AppPath.RecordShowPage, {
      objectNameSingular: CoreObjectNameSingular.Person,
      objectRecordId: personId,
    });

  const handleCreateCompanyForPerson = async (
    personId: string,
    companyName: string,
  ) => {
    const company = await writer.createCompany(companyName);

    if (isDefined(company)) {
      addCompanyLocally(company);
      writeCells(
        [{ personId, columnKey: 'company', value: company }],
        [],
        true,
      );
    }
  };

  const handleNewContact = () => {
    resetSelection();
    setIsDraftRowVisible(true);

    if (isDefined(gridViewportRef.current)) {
      gridViewportRef.current.scrollTop = 0;
    }
  };

  const handleDraftCommit = async (name: FieldFullNameValue) => {
    setIsDraftRowVisible(false);

    if (formatFastContactsFullName(name).trim() === '') {
      gridViewportRef.current?.focus();

      return;
    }

    const createdPerson = await writer.createPerson({
      firstName: name.firstName,
      lastName: name.lastName,
      ownerId: currentWorkspaceMember?.id ?? null,
    });

    if (!isDefined(createdPerson)) {
      gridViewportRef.current?.focus();

      return;
    }

    setPinnedPersonIds((currentIds) => [createdPerson.id, ...currentIds]);
    setPendingEditingCell({
      personId: createdPerson.id,
      columnKey: 'company',
      initialText: null,
    });
  };

  const handleDraftCancel = () => {
    setIsDraftRowVisible(false);
    gridViewportRef.current?.focus();
  };

  const handlePendingEditingCellUsed = useCallback(
    () => setPendingEditingCell(null),
    [],
  );

  const columnMenuColumn: FastContactsColumn | undefined = isDefined(columnMenu)
    ? visibleColumns.find((column) => column.key === columnMenu.columnKey)
    : undefined;
  const columnMenuIndex = isDefined(columnMenuColumn)
    ? visibleColumns.indexOf(columnMenuColumn)
    : -1;

  if (loadStatus === 'loading' && people.length === 0) {
    return (
      <StyledMessage>
        <Trans>Loading contacts...</Trans>
      </StyledMessage>
    );
  }

  return (
    <StyledContainer>
      {loadStatus === 'failed' && (
        <StyledMessage>
          {people.length === 0 ? (
            <Trans>Contacts could not be loaded.</Trans>
          ) : (
            <Trans>
              Contacts could not be refreshed and may be out of date.
            </Trans>
          )}
          <Button size="sm" onClick={() => void reloadPeople()}>
            <Trans>Retry</Trans>
          </Button>
        </StyledMessage>
      )}
      <FastContactsToolbar
        searchInputRef={searchInputRef}
        searchText={searchText}
        onSearchTextChange={handleSearchTextChange}
        onSearchEscape={handleClearFilters}
        shownCount={rows.length}
        totalCount={countByTabKey[activeTab.key]}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        selectedRowCount={selectedRowIds.length}
        layout={layout}
        editContext={editContext}
        editableColumnKeys={editableColumnKeys}
        canCreateContacts={objectPermissions.canUpdateObjectRecords}
        onNewContact={handleNewContact}
        onToggleColumn={handleToggleColumn}
        onResetLayout={() => updateLayout(getDefaultFastContactsSheetLayout)}
        onExport={handleExport}
        onBulkChange={handleBulkChange}
        onBulkTagChange={handleBulkTagChange}
      />
      <FastContactsGrid
        key={activeTab.key}
        viewportRef={gridViewportRef}
        rows={rows}
        columns={visibleColumns}
        columnWidths={columnWidths}
        layout={layout}
        editContext={editContext}
        editableColumnKeys={editableColumnKeys}
        selection={selection}
        openMenuColumnKey={columnMenu?.columnKey ?? null}
        isDraftRowVisible={isDraftRowVisible}
        pendingEditingCell={pendingEditingCell}
        onSelectionChange={setSelection}
        onPendingEditingCellUsed={handlePendingEditingCellUsed}
        onWriteCells={(writes, isSingleCellEdit) =>
          writeCells(writes, [], isSingleCellEdit)
        }
        onWriteTexts={writeTexts}
        onPasteValues={handlePasteValues}
        onClearSelectedCells={handleClearSelectedCells}
        onUndo={() => void writer.undoLastStep()}
        onOpenPerson={handleOpenPerson}
        onCreateCompanyForPerson={(personId, companyName) =>
          void handleCreateCompanyForPerson(personId, companyName)
        }
        onCreateTag={handleCreateTag}
        onDraftCommit={(name) => void handleDraftCommit(name)}
        onDraftCancel={handleDraftCancel}
        onSortClick={handleSortClick}
        onOpenColumnMenu={(columnKey, anchor) =>
          setColumnMenu({ columnKey, anchor })
        }
        onMoveColumn={handleMoveColumn}
        onColumnResizeChange={(columnKey, width) =>
          setColumnWidthOverride({ columnKey, width })
        }
        onColumnResizeEnd={(columnKey, width) => {
          setFastContactsColumnWidths({
            ...fastContactsColumnWidths,
            [columnKey]: width,
          });
          setColumnWidthOverride(null);
        }}
      />
      <FastContactsTabBar
        activeTabKey={activeTab.key}
        countByTabKey={countByTabKey}
        onTabChange={handleTabChange}
      />
      {isDefined(columnMenu) && isDefined(columnMenuColumn) && (
        <FastContactsColumnMenu
          column={columnMenuColumn}
          anchor={columnMenu.anchor}
          sortDirection={
            layout.sort?.columnKey === columnMenuColumn.key
              ? layout.sort.direction
              : null
          }
          filter={layout.filters[columnMenuColumn.key]}
          canFreezeUpToHere={layout.frozenColumnCount !== columnMenuIndex + 1}
          canUnfreeze={layout.frozenColumnCount > 1}
          editContext={editContext}
          onClose={() => {
            setColumnMenu(null);
            gridViewportRef.current?.focus();
          }}
          onSort={(direction) => setSort(columnMenuColumn.key, direction)}
          onFilterChange={(filter) =>
            handleFilterChange(columnMenuColumn.key, filter)
          }
          onHide={() => handleToggleColumn(columnMenuColumn.key)}
          onFreezeUpToHere={() =>
            updateLayout((currentLayout) => ({
              ...currentLayout,
              frozenColumnCount: columnMenuIndex + 1,
            }))
          }
          onUnfreeze={() =>
            updateLayout((currentLayout) => ({
              ...currentLayout,
              frozenColumnCount: 1,
            }))
          }
        />
      )}
      <FastContactsHandoverDialog request={writer.handoverRequest} />
    </StyledContainer>
  );
};
