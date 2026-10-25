import { useRecordTableContextOrThrow } from '@/object-record/record-table/contexts/RecordTableContext';
import { RecordTableCellEditModePortal } from '@/object-record/record-table/record-table-cell/components/RecordTableCellEditModePortal';
import { RecordTableCellFocusedPortal } from '@/object-record/record-table/record-table-cell/components/RecordTableCellFocusedPortal';
import { RecordTableCellHoveredPortal } from '@/object-record/record-table/record-table-cell/components/RecordTableCellHoveredPortal';
import { isRecordTableCellFocusActiveComponentState } from '@/object-record/record-table/states/isRecordTableCellFocusActiveComponentState';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';

export const RecordTableCellPortals = () => {
  const { recordTableId } = useRecordTableContextOrThrow();

  const isRecordTableCellFocusActive = useAtomComponentStateValue(
    isRecordTableCellFocusActiveComponentState,
    recordTableId,
  );

  return (
    <>
      <RecordTableCellHoveredPortal />
      <RecordTableCellFocusedPortal />
      {isRecordTableCellFocusActive && <RecordTableCellEditModePortal />}
    </>
  );
};
