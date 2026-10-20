import { type CadenceActionEntry } from 'src/ui/cadence-actions';
import { addDays, describeDue, formatDay } from 'src/ui/dates';
import {
  actionDescription,
  actionKind,
  actionLabel,
  isBackdatable,
  isPrimaryAction,
  OVERFLOW_ITEMS,
  type OverflowKey,
  stageLabel,
} from 'src/ui/labels';
import { isReplyOwed, type MyDayPerson } from 'src/ui/my-day';
import { type Member } from 'src/ui/data';
import { type OwnerChangeMode } from 'src/ui/routes';
import {
  AddEmailForm,
  ChangeOwnerForm,
  EarlierDateForm,
  FutureDateForm,
  OptOutForm,
  type SomethingElseValue,
  SomethingElseForm,
} from 'src/ui/components/forms';
import {
  Badge,
  Button,
  Inline,
  Notice,
  Panel,
} from 'src/ui/components/primitives';
import { useTheme } from 'src/ui/theme';

// One My Day row: who, where they are, and the buttons the engine offers, in
// its order. The "…" menu and every secondary control open inline under the
// row (front components have no popovers).

export type RowPanel =
  | { kind: 'earlier'; entry: CadenceActionEntry }
  | { kind: 'somethingElse' }
  | { kind: 'addEmail' }
  | { kind: 'overflow' }
  | { kind: 'snooze' }
  | { kind: 'hold' }
  | { kind: 'optOut' }
  | { kind: 'changeOwner' };

export type RowState = {
  // The button being carried out; every button is disabled meanwhile.
  pendingLabel: string | null;
  error: string | null;
  panel: RowPanel | null;
};

export const EMPTY_ROW_STATE: RowState = { pendingLabel: null, error: null, panel: null };

export type RowHandlers = {
  onLogAction: (entry: CadenceActionEntry, extra?: { occurredOn: string; note: string }) => Promise<void>;
  onResume: () => Promise<void>;
  onSomethingElse: (value: SomethingElseValue) => Promise<void>;
  onAddEmail: (email: string) => Promise<void>;
  onSnooze: (until: string) => Promise<void>;
  onHold: (revisitDate: string | null) => Promise<void>;
  onDead: () => Promise<void>;
  onOptOut: (reason: string) => Promise<void>;
  onChangeOwner: (ownerId: string | null, mode: OwnerChangeMode) => Promise<void>;
  onOpenRecord: () => void;
  onViewInPanel: () => void;
  onRecompute: () => Promise<void>;
  setPanel: (panel: RowPanel | null) => void;
  dismissError: () => void;
};

const panelTitle = (panel: RowPanel): string => {
  switch (panel.kind) {
    case 'earlier':
      return `${actionLabel(panel.entry)} on an earlier day, or with a note`;
    case 'somethingElse':
      return 'Something else';
    case 'addEmail':
      return 'Add email address';
    case 'overflow':
      return 'More';
    case 'snooze':
      return 'Snooze';
    case 'hold':
      return 'Hold';
    case 'optOut':
      return 'Opt out';
    case 'changeOwner':
      return 'Change owner';
  }
};

export const PersonRow = ({
  person,
  today,
  ownerName,
  members,
  state,
  handlers,
}: {
  person: MyDayPerson;
  today: string;
  ownerName: string | null;
  members: readonly Member[];
  state: RowState;
  handlers: RowHandlers;
}) => {
  const theme = useTheme();
  const isBusy = state.pendingLabel !== null;
  const replyOwed = isReplyOwed(person);
  const isOverdue = person.nextActionDate !== null && person.nextActionDate < today;
  const actions = person.actions?.actions ?? [];
  const backdatable = actions.find(isBackdatable) ?? null;

  const clickAction = (entry: CadenceActionEntry) => {
    switch (actionKind(entry)) {
      case 'logTouch':
        void handlers.onLogAction(entry);
        return;
      case 'resume':
        void handlers.onResume();
        return;
      case 'addEmail':
        handlers.setPanel(state.panel?.kind === 'addEmail' ? null : { kind: 'addEmail' });
        return;
      case 'somethingElse':
        handlers.setPanel(state.panel?.kind === 'somethingElse' ? null : { kind: 'somethingElse' });
        return;
      case 'unsupported':
        return;
    }
  };

  const clickOverflow = (key: OverflowKey) => {
    switch (key) {
      case 'dead':
        void handlers.onDead();
        return;
      case 'view':
        handlers.onViewInPanel();
        return;
      default:
        handlers.setPanel({ kind: key });
    }
  };

  const renderPanel = (panel: RowPanel) => {
    switch (panel.kind) {
      case 'earlier':
        return (
          <EarlierDateForm
            actionLabel={actionLabel(panel.entry)}
            today={today}
            onSubmit={(value) => handlers.onLogAction(panel.entry, value)}
          />
        );
      case 'somethingElse':
        return <SomethingElseForm today={today} onSubmit={handlers.onSomethingElse} />;
      case 'addEmail':
        return <AddEmailForm onSubmit={handlers.onAddEmail} />;
      case 'overflow':
        return (
          <Inline>
            {OVERFLOW_ITEMS.map((item) => (
              <Button
                key={item.key}
                compact
                disabled={isBusy && item.key !== 'view'}
                onClick={() => clickOverflow(item.key)}
                title={
                  item.key === 'dead'
                    ? 'Stop all outreach to them. You can undo it straight after.'
                    : undefined
                }
              >
                {item.label}
              </Button>
            ))}
          </Inline>
        );
      case 'snooze':
        return (
          <FutureDateForm
            today={today}
            label="Snooze until"
            buttonLabel="Snooze"
            help="They come back on My Day on this date."
            initial={addDays(today, 7)}
            onSubmit={(date) => (date === null ? Promise.resolve() : handlers.onSnooze(date))}
          />
        );
      case 'hold':
        return (
          <FutureDateForm
            today={today}
            label="Revisit on"
            buttonLabel="Put on hold"
            help="Optional. Without a date they wait on Cold until someone takes them off hold."
            optional
            initial={addDays(today, 30)}
            onSubmit={handlers.onHold}
          />
        );
      case 'optOut':
        return <OptOutForm personName={person.name} onSubmit={handlers.onOptOut} />;
      case 'changeOwner':
        return (
          <ChangeOwnerForm
            subject={{
              personName: person.name,
              ownerId: person.ownerId,
              replyOwedSince: person.actions?.replyOwedSince ?? null,
              isLinkedInPosition: person.actions?.isLinkedInPosition ?? false,
            }}
            members={members}
            onSubmit={({ ownerId, mode }) => handlers.onChangeOwner(ownerId, mode)}
          />
        );
    }
  };

  return (
    <li
      data-testid="my-day-row"
      style={{
        listStyle: 'none',
        borderTop: `1px solid ${theme.border}`,
        borderLeft: `3px solid ${replyOwed ? theme.accent : isOverdue ? theme.danger : 'transparent'}`,
        padding: '8px 12px',
        opacity: isBusy ? '0.75' : '1',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 10px' }}>
        <button
          type="button"
          onClick={handlers.onOpenRecord}
          title="Open the person record"
          style={{
            border: 'none',
            background: 'transparent',
            padding: '0',
            fontFamily: theme.font,
            fontSize: '14px',
            fontWeight: 600,
            color: theme.text,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          {person.name}
        </button>
        {person.companyName === null ? null : (
          <span style={{ color: theme.textSecondary }}>{person.companyName}</span>
        )}
        <span style={{ flex: '1' }} />
        {ownerName === null ? null : <Badge>{ownerName}</Badge>}
        <span
          title={describeDue(person.nextActionDate, today)}
          style={{
            fontSize: theme.smallFontSize,
            color: isOverdue ? theme.danger : theme.textSecondary,
            fontWeight: isOverdue ? 600 : 400,
            whiteSpace: 'nowrap',
          }}
        >
          {isOverdue
            ? `Overdue · was due ${formatDay(person.nextActionDate, { today })}`
            : `Due ${formatDay(person.nextActionDate, { today })}`}
        </span>
      </div>

      <div style={{ color: theme.textSecondary, marginTop: '2px' }}>
        {stageLabel(person.stage)}
        <span aria-hidden="true"> · </span>
        <span style={replyOwed ? { color: theme.text, fontWeight: 600 } : undefined}>
          {person.step ?? person.actions?.stepLabel ?? 'No step yet'}
        </span>
      </div>

      {person.actions === null ? (
        <div style={{ marginTop: '6px' }}>
          <Notice tone="warning" title="No buttons for this person.">
            {person.actionsProblem ?? 'The cadence data is missing.'}
          </Notice>
          <div style={{ marginTop: '6px' }}>
            <Button compact disabled={isBusy} onClick={() => void handlers.onRecompute()}>
              {state.pendingLabel === 'Recompute' ? 'Recomputing…' : 'Recompute'}
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '6px' }}>
          {actions.map((entry) => {
            const label = actionLabel(entry);
            const kind = actionKind(entry);

            return kind === 'unsupported' ? (
              <Badge key={entry.action} tone="warning">
                {`${label}: not available here`}
              </Badge>
            ) : (
              <Button
                key={entry.action}
                testId={`action-${entry.action}`}
                variant={isPrimaryAction(entry) ? 'primary' : 'secondary'}
                compact
                disabled={isBusy}
                title={actionDescription(entry)}
                ariaLabel={`${label}, for ${person.name}`}
                onClick={() => clickAction(entry)}
              >
                {state.pendingLabel === label ? 'Working…' : label}
              </Button>
            );
          })}
          <Button
            compact
            variant="ghost"
            testId="row-more"
            ariaLabel={`More actions for ${person.name}`}
            title="Snooze, Hold, Dead, Opt out, Change owner, View"
            onClick={() =>
              handlers.setPanel(state.panel?.kind === 'overflow' ? null : { kind: 'overflow' })
            }
          >
            …
          </Button>
          {state.pendingLabel !== null && !actions.some((entry) => actionLabel(entry) === state.pendingLabel) ? (
            <span style={{ fontSize: theme.smallFontSize, color: theme.textSecondary }}>
              {`${state.pendingLabel}…`}
            </span>
          ) : null}
        </div>
      )}

      {backdatable === null || state.panel?.kind === 'earlier' ? null : (
        <div style={{ marginTop: '4px' }}>
          <Button
            variant="link"
            compact
            disabled={isBusy}
            onClick={() => handlers.setPanel({ kind: 'earlier', entry: backdatable })}
          >
            {`${actionLabel(backdatable)} on an earlier day, or with a note`}
          </Button>
        </div>
      )}

      {person.actions?.problems.length ? (
        <div style={{ marginTop: '6px', fontSize: theme.smallFontSize, color: theme.warning }}>
          {person.actions.problems.join(' ')}
        </div>
      ) : null}

      {state.panel === null ? null : (
        <Panel
          title={panelTitle(state.panel)}
          onClose={() => handlers.setPanel(null)}
        >
          {renderPanel(state.panel)}
        </Panel>
      )}

      {state.error === null ? null : (
        <div style={{ marginTop: '8px' }}>
          <Notice tone="error" title="Not done" testId="row-error">
            {state.error}
          </Notice>
          <div style={{ marginTop: '4px' }}>
            <Button variant="link" compact onClick={handlers.dismissError}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </li>
  );
};
