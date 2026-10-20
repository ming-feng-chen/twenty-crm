import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { useColorScheme, useUserId } from 'twenty-sdk/front-component';

import { errorText, RequestError } from 'src/ui/api';
import { type CadenceActionEntry } from 'src/ui/cadence-actions';
import {
  loadCadenceTimeZone,
  loadDuePeople,
  loadMembers,
  loadViewerMemberId,
  type Member,
  updatePersonFields,
} from 'src/ui/data';
import { formatDay, formatLongDay, todayIn } from 'src/ui/dates';
import { notify, openPersonInSidePanel, openPersonRecord } from 'src/ui/host';
import {
  actionLabel,
  describeTouch,
  optOutReasonLabel,
  PERMANENT_OPT_OUT_REASON,
  plural,
} from 'src/ui/labels';
import {
  buildSections,
  countSections,
  EVERYONE,
  groupByOwner,
  ME,
  mergeRoutePerson,
  type MyDayPerson,
  type OwnerFilter,
  ownerFilterFor,
  type RoutePersonView,
  type Section,
  type Selection,
  selectionFromValue,
  selectionToValue,
  showsOwner,
  toMyDayPerson,
} from 'src/ui/my-day';
import {
  changeOwnerRoute,
  logTouchRoute,
  type OwnerChangeMode,
  recomputeRoute,
  resumeRoute,
  undoTouchRoute,
} from 'src/ui/routes';
import {
  type Activity,
  ActivityTray,
  MAX_ACTIVITIES,
  type UndoPlan,
} from 'src/ui/components/activity-tray';
import {
  EMPTY_ROW_STATE,
  PersonRow,
  type RowHandlers,
  type RowPanel,
  type RowState,
} from 'src/ui/components/person-row';
import {
  Button,
  Inline,
  Muted,
  Notice,
  SectionHeading,
  Select,
  ThemeRoot,
} from 'src/ui/components/primitives';
import { useTheme } from 'src/ui/theme';

// My Day (SPEC §6): the viewer's (or a member's, or everyone's) contacts that
// are due, with the buttons the engine offers. Every action goes through the
// app's routes as the viewer, shows its outcome on the row, lands in "Just
// done" with its Undo, and is followed by a refresh.

type Setup =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | {
      status: 'ready';
      members: Member[];
      viewerMemberId: string | null;
      timeZone: string;
    };

type ListState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  people: MyDayPerson[];
  error: string | null;
  isTruncated: boolean;
  loadedAt: Date | null;
  today: string;
};

type Outcome = {
  view: RoutePersonView | null;
  text: string;
  undo: UndoPlan | null;
  noUndoReason?: string;
  warnings?: string[];
  // A plain field edit is finished by an asynchronous trigger; look again
  // once it has run.
  settlesLater?: boolean;
};

const SETTLE_REFRESH_DELAY_MS = 5_000;
const REFRESH_DELAY_MS = 600;

// A refusal (4xx) wrote nothing: the routes check before they write. A lost
// answer or a server failure might have, and the message says to check.
const failureText = (error: unknown): string => {
  const message = errorText(error);

  if (error instanceof RequestError && error.status >= 400 && error.status < 500 && error.status !== 401) {
    return `${message} Nothing was changed.`;
  }

  return message;
};

let activityCounter = 0;

const SectionList = ({
  section,
  renderRow,
}: {
  section: Section;
  renderRow: (person: MyDayPerson) => ReactElement;
}) => {
  const theme = useTheme();

  if (section.people.length === 0) {
    return null;
  }

  return (
    <section data-testid={`section-${section.key}`}>
      <SectionHeading tone={section.key === 'overdue' ? 'error' : 'info'}>
        {`${section.title} (${section.people.length})`}
      </SectionHeading>
      <ol
        style={{
          margin: '0',
          padding: '0',
          border: `1px solid ${theme.border}`,
          borderTop: 'none',
          borderRadius: theme.radius,
          overflow: 'hidden',
        }}
      >
        {section.people.map(renderRow)}
      </ol>
    </section>
  );
};

const MyDayContent = () => {
  const theme = useTheme();
  const userId = useUserId();
  const client = useMemo(() => new CoreApiClient(), []);

  const [setup, setSetup] = useState<Setup>({ status: 'loading' });
  const [selection, setSelection] = useState<Selection>(ME);
  const [list, setList] = useState<ListState>({
    status: 'idle',
    people: [],
    error: null,
    isTruncated: false,
    loadedAt: null,
    today: todayIn('Europe/London'),
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [activities, setActivities] = useState<Activity[]>([]);

  const loadSequence = useRef(0);
  const mutationCount = useRef(0);
  const pendingPeople = useRef(new Set<string>());
  const refreshTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const latestLoadList = useRef<(options: { quiet: boolean }) => Promise<void>>(async () => undefined);

  const ready = setup.status === 'ready' ? setup : null;
  const viewerMemberId = ready?.viewerMemberId ?? null;
  const ownerFilter: OwnerFilter | null = ready === null ? null : ownerFilterFor(selection, viewerMemberId);

  const loadSetup = useCallback(async () => {
    setSetup({ status: 'loading' });

    try {
      const [members, timeZone] = await Promise.all([
        loadMembers(client),
        loadCadenceTimeZone(client),
      ]);
      const viewer = await loadViewerMemberId(members, userId);

      setSetup({ status: 'ready', members, viewerMemberId: viewer, timeZone });
    } catch (error) {
      setSetup({ status: 'error', error: errorText(error) });
    }
  }, [client, userId]);

  useEffect(() => {
    void loadSetup();
  }, [loadSetup]);

  const loadList = useCallback(
    async ({ quiet }: { quiet: boolean }) => {
      if (ready === null || ownerFilter === null) {
        return;
      }

      const sequence = ++loadSequence.current;
      const mutationsAtStart = mutationCount.current;

      if (quiet) {
        setIsRefreshing(true);
      } else {
        setList((current) => ({ ...current, status: 'loading', error: null }));
      }

      try {
        const { people, isTruncated } = await loadDuePeople(client, ownerFilter);

        // A newer load, or an action that finished meanwhile, makes this
        // answer stale; a fresh refresh is already on its way.
        if (sequence !== loadSequence.current) {
          return;
        }

        if (quiet && mutationsAtStart !== mutationCount.current) {
          return;
        }

        setList({
          status: 'ready',
          people: people.map(toMyDayPerson),
          error: null,
          isTruncated,
          loadedAt: new Date(),
          today: todayIn(ready.timeZone),
        });
      } catch (error) {
        if (sequence !== loadSequence.current) {
          return;
        }

        if (quiet) {
          // Keep the rows on screen; say the refresh failed.
          setList((current) => ({ ...current, error: `Refresh failed: ${errorText(error)}` }));
        } else {
          setList((current) => ({ ...current, status: 'error', people: [], error: errorText(error) }));
        }
      } finally {
        if (sequence === loadSequence.current) {
          setIsRefreshing(false);
        }
      }
    },
    [client, ownerFilter === null ? 'none' : JSON.stringify(ownerFilter), ready],
  );

  useEffect(() => {
    latestLoadList.current = loadList;

    // A refresh queued for the previous list must not load it again.
    for (const timer of refreshTimers.current) {
      clearTimeout(timer);
    }

    refreshTimers.current = [];
    void loadList({ quiet: false });
  }, [loadList]);

  useEffect(
    () => () => {
      for (const timer of refreshTimers.current) {
        clearTimeout(timer);
      }
    },
    [],
  );

  const scheduleRefresh = (settlesLater: boolean) => {
    const delays = settlesLater ? [REFRESH_DELAY_MS, SETTLE_REFRESH_DELAY_MS] : [REFRESH_DELAY_MS];

    for (const delay of delays) {
      refreshTimers.current.push(setTimeout(() => void latestLoadList.current({ quiet: true }), delay));
    }
  };

  const rowState = (personId: string) => rowStates[personId] ?? EMPTY_ROW_STATE;

  const patchRow = (personId: string, patch: Partial<RowState>) =>
    setRowStates((current) => ({
      ...current,
      [personId]: { ...(current[personId] ?? EMPTY_ROW_STATE), ...patch },
    }));

  const isListed = (person: MyDayPerson): boolean => {
    if (!person.isDue || ownerFilter === null) {
      return false;
    }

    return 'ownerId' in ownerFilter ? person.ownerId === ownerFilter.ownerId : person.ownerId !== null;
  };

  // The updated row, or no row when it is no longer due here.
  const applyView = (person: MyDayPerson, view: RoutePersonView | null) => {
    if (view === null) {
      return;
    }

    const merged = mergeRoutePerson(person, view);

    setList((current) => ({
      ...current,
      people: isListed(merged)
        ? current.people.map((row) => (row.id === person.id ? merged : row))
        : current.people.filter((row) => row.id !== person.id),
    }));
  };

  const addActivity = (person: MyDayPerson, outcome: Outcome) => {
    activityCounter += 1;

    const activity: Activity = {
      id: `activity-${activityCounter}`,
      personId: person.id,
      personName: person.name,
      text: outcome.text,
      undo: outcome.undo,
      noUndoReason: outcome.undo === null ? (outcome.noUndoReason ?? null) : null,
      warnings: outcome.warnings ?? [],
      status: 'done',
      error: null,
    };

    setActivities((current) => [activity, ...current].slice(0, MAX_ACTIVITIES));
  };

  const run = async (
    person: MyDayPerson,
    label: string,
    work: () => Promise<Outcome>,
    { fromForm = false }: { fromForm?: boolean } = {},
  ): Promise<void> => {
    // One action per row at a time: a double click must not log twice.
    if (pendingPeople.current.has(person.id)) {
      return;
    }

    pendingPeople.current.add(person.id);
    patchRow(person.id, { pendingLabel: label, error: null });

    try {
      const outcome = await work();

      mutationCount.current += 1;
      applyView(person, outcome.view);
      addActivity(person, outcome);
      patchRow(person.id, { pendingLabel: null, error: null, panel: null });
      notify('success', `${person.name}: ${outcome.text}`, outcome.warnings?.join(' '));
      scheduleRefresh(outcome.settlesLater === true);
    } catch (error) {
      const message = failureText(error);

      patchRow(person.id, { pendingLabel: null, error: fromForm ? null : message });
      notify('error', `${person.name}: ${label} did not go through`, message);

      if (fromForm) {
        throw new Error(message);
      }
    } finally {
      pendingPeople.current.delete(person.id);
    }
  };

  // A plain field edit, then the recomputed person straight away.
  const editFields = async (person: MyDayPerson, data: Record<string, unknown>) => {
    await updatePersonFields(client, person.id, data);

    try {
      return (await recomputeRoute(person.id)).person;
    } catch {
      // The edit is saved and the trigger recomputes anyway; the refresh
      // shows the result.
      return null;
    }
  };

  const undo = async (activity: Activity) => {
    if (activity.undo === null || activity.status === 'undoing') {
      return;
    }

    const plan = activity.undo;

    setActivities((current) =>
      current.map((entry) => (entry.id === activity.id ? { ...entry, status: 'undoing', error: null } : entry)),
    );

    try {
      if (plan.kind === 'touch') {
        await undoTouchRoute(plan.touchId);
      } else {
        await updatePersonFields(client, activity.personId, plan.data);

        try {
          await recomputeRoute(activity.personId);
        } catch {
          // The trigger recomputes; the refresh shows it.
        }
      }

      mutationCount.current += 1;
      setActivities((current) =>
        current.map((entry) => (entry.id === activity.id ? { ...entry, status: 'undone' } : entry)),
      );
      notify('success', `${activity.personName}: undone`);
      scheduleRefresh(plan.kind === 'fields');
    } catch (error) {
      const message = failureText(error);

      setActivities((current) =>
        current.map((entry) =>
          entry.id === activity.id ? { ...entry, status: 'undoFailed', error: message } : entry,
        ),
      );
      notify('error', `${activity.personName}: undo did not go through`, message);
    }
  };

  const handlersFor = (person: MyDayPerson): RowHandlers => {
    const today = list.today;

    return {
      onLogAction: (entry: CadenceActionEntry, extra) => {
        const label = actionLabel(entry);
        const isBackdated = extra !== undefined && extra.occurredOn !== today;

        return run(
          person,
          label,
          async () => {
            const answer = await logTouchRoute({
              personId: person.id,
              action: entry.action,
              ...(extra === undefined ? {} : { occurredOn: extra.occurredOn }),
              ...(extra === undefined || extra.note.length === 0 ? {} : { note: extra.note }),
            });
            const what =
              entry.action === 'didIt' && person.step !== null ? `Did it (${person.step})` : label;

            return {
              view: answer.person,
              text: `${what} logged${isBackdated ? ` for ${formatDay(extra.occurredOn, { today })}` : ''}.`,
              undo: { kind: 'touch', touchId: answer.touchId },
            };
          },
          { fromForm: extra !== undefined },
        );
      },
      onResume: () =>
        run(person, 'Resume cadence', async () => ({
          view: (await resumeRoute(person.id)).person,
          text: 'cadence resumed.',
          undo: null,
          noUndoReason: 'No undo for a resume',
        })),
      onSomethingElse: (value) =>
        run(
          person,
          'Something else',
          async () => {
            const answer = await logTouchRoute({
              personId: person.id,
              touch: { channel: value.channel, direction: value.direction, outcome: value.outcome },
              occurredOn: value.occurredOn,
              ...(value.note.length === 0 ? {} : { note: value.note }),
            });

            return {
              view: answer.person,
              text: `${describeTouch(value)} logged for ${formatDay(value.occurredOn, { today })}.`,
              undo: { kind: 'touch', touchId: answer.touchId },
            };
          },
          { fromForm: true },
        ),
      onAddEmail: (email) =>
        run(
          person,
          'Add email address',
          async () => ({
            view: await editFields(person, {
              emails: { primaryEmail: email, additionalEmails: person.additionalEmails },
            }),
            text: `email address ${email} added.`,
            undo: {
              kind: 'fields',
              data: {
                emails: { primaryEmail: person.primaryEmail ?? '', additionalEmails: person.additionalEmails },
              },
            },
            settlesLater: true,
          }),
          { fromForm: true },
        ),
      onSnooze: (until) =>
        run(
          person,
          'Snooze',
          async () => ({
            view: await editFields(person, { snoozeUntil: until }),
            text: `snoozed until ${formatDay(until, { today })}.`,
            undo: { kind: 'fields', data: { snoozeUntil: person.snoozeUntil } },
            settlesLater: true,
          }),
          { fromForm: true },
        ),
      onHold: (revisitDate) =>
        run(
          person,
          'Hold',
          async () => ({
            view: await editFields(person, { cadenceHealth: 'HOLD', revisitDate }),
            text:
              revisitDate === null
                ? 'put on hold with no revisit date.'
                : `put on hold until ${formatDay(revisitDate, { today })}.`,
            undo: {
              kind: 'fields',
              data: { cadenceHealth: person.health ?? 'ACTIVE', revisitDate: person.revisitDate },
            },
            settlesLater: true,
          }),
          { fromForm: true },
        ),
      onDead: () =>
        run(person, 'Dead', async () => ({
          view: await editFields(person, { cadenceHealth: 'DEAD' }),
          text: 'marked dead: no more outreach.',
          undo: { kind: 'fields', data: { cadenceHealth: person.health ?? 'ACTIVE' } },
          settlesLater: true,
        })),
      onOptOut: (reason) =>
        run(
          person,
          'Opt out',
          async () => ({
            view: await editFields(person, { optedOut: true, optOutReason: reason }),
            text: `opted out (${optOutReasonLabel(reason).toLowerCase()}).`,
            undo:
              reason === PERMANENT_OPT_OUT_REASON
                ? null
                : { kind: 'fields', data: { optedOut: person.optedOut, optOutReason: person.optOutReason } },
            noUndoReason: 'Permanent: cannot be undone',
            settlesLater: true,
          }),
          { fromForm: true },
        ),
      onChangeOwner: (ownerId: string | null, mode: OwnerChangeMode) =>
        run(
          person,
          'Change owner',
          async () => {
            const answer = await changeOwnerRoute({ personId: person.id, ownerId, mode });
            const ownerName =
              ownerId === null
                ? 'nobody'
                : (ready?.members.find((member) => member.id === ownerId)?.displayName ?? 'the new owner');

            return {
              view: answer.person,
              text: !answer.changed
                ? `already owned by ${ownerName}; nothing changed.`
                : answer.isHandover
                  ? `handed over to ${ownerName} (${answer.mode === 'KEEP_POSITION' ? 'kept position' : 'started fresh'}).`
                  : ownerId === null
                    ? 'owner removed.'
                    : `now owned by ${ownerName}.`,
              undo: null,
              noUndoReason: 'To reverse, use Change owner… again',
              warnings: answer.warnings ?? [],
            };
          },
          { fromForm: true },
        ),
      onRecompute: () =>
        run(person, 'Recompute', async () => ({
          view: (await recomputeRoute(person.id)).person,
          text: 'recomputed.',
          undo: null,
        })),
      onOpenRecord: () => void openPersonRecord(person.id),
      onViewInPanel: () => void openPersonInSidePanel(person.id),
      setPanel: (panel: RowPanel | null) => patchRow(person.id, { panel }),
      dismissError: () => patchRow(person.id, { error: null }),
    };
  };

  if (setup.status === 'loading') {
    return <div style={{ padding: '24px', color: theme.textSecondary }}>Loading My Day…</div>;
  }

  if (setup.status === 'error') {
    return (
      <div style={{ padding: '24px' }}>
        <Notice tone="error" title="My Day could not load.">
          {setup.error}
        </Notice>
        <div style={{ marginTop: '8px' }}>
          <Button onClick={() => void loadSetup()}>Try again</Button>
        </div>
      </div>
    );
  }

  const { members, timeZone } = setup;
  const today = list.today;
  const viewerName = members.find((member) => member.id === viewerMemberId)?.displayName ?? null;
  const selectOptions = [
    { value: selectionToValue(ME), label: viewerName === null ? 'Me' : `Me (${viewerName})` },
    ...members
      .filter((member) => member.id !== viewerMemberId)
      .map((member) => ({ value: selectionToValue({ kind: 'member', memberId: member.id }), label: member.displayName })),
    { value: selectionToValue(EVERYONE), label: 'Everyone (by owner)' },
  ];
  const sections = buildSections(list.people, today);
  const counts = countSections(sections);
  const ownerShown = showsOwner(selection, viewerMemberId);
  const memberName = (id: string | null) =>
    id === null ? null : (members.find((member) => member.id === id)?.displayName ?? 'A former member');

  const renderRow = (person: MyDayPerson) => (
    <PersonRow
      key={person.id}
      person={person}
      today={today}
      ownerName={ownerShown ? memberName(person.ownerId) : null}
      members={members}
      state={rowState(person.id)}
      handlers={handlersFor(person)}
    />
  );

  return (
    <div style={{ padding: '16px 20px 40px', maxWidth: '1100px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 12px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: '0' }}>My Day</h1>
        <Muted>{formatLongDay(today)}</Muted>
      </div>

      <div style={{ marginTop: '10px' }}>
        <Inline gap="8px">
          <Select
            value={selectionToValue(selection)}
            onChange={(value) => {
              setSelection(selectionFromValue(value));
              setRowStates({});
            }}
            options={selectOptions}
            ariaLabel="Whose My Day"
            testId="owner-selector"
          />
          <Button
            compact
            testId="refresh"
            disabled={list.status === 'loading' || isRefreshing}
            onClick={() => void loadList({ quiet: list.status === 'ready' })}
          >
            {isRefreshing || list.status === 'loading' ? 'Refreshing…' : 'Refresh'}
          </Button>
          {list.loadedAt === null ? null : (
            <span style={{ fontSize: theme.smallFontSize, color: theme.textTertiary }}>
              {`Updated ${list.loadedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone })}`}
            </span>
          )}
          {list.status === 'ready' ? (
            <span style={{ fontSize: theme.smallFontSize, color: theme.textSecondary }} data-testid="counts">
              {`${plural(counts.replyOwed, 'to reply to', 'to reply to')} · ${counts.overdue} overdue · ${counts.dueToday} due today`}
            </span>
          ) : null}
        </Inline>
      </div>

      <ActivityTray
        activities={activities}
        onUndo={(activity) => void undo(activity)}
        onDismiss={(activity) => setActivities((current) => current.filter((entry) => entry.id !== activity.id))}
      />

      {ownerFilter === null ? (
        <div style={{ marginTop: '12px' }}>
          <Notice tone="warning" title="We could not work out which member you are.">
            So "Me" cannot be shown. Pick your name in the list above, or reload the page.
          </Notice>
        </div>
      ) : null}

      {list.status === 'error' ? (
        <div style={{ marginTop: '12px' }}>
          <Notice tone="error" title="The list could not load.">
            {list.error}
          </Notice>
          <div style={{ marginTop: '8px' }}>
            <Button onClick={() => void loadList({ quiet: false })}>Try again</Button>
          </div>
        </div>
      ) : null}

      {list.status === 'ready' && list.error !== null ? (
        <div style={{ marginTop: '12px' }}>
          <Notice tone="error">{`${list.error} The rows below may be out of date.`}</Notice>
        </div>
      ) : null}

      {list.status === 'loading' || (list.status === 'idle' && ownerFilter !== null) ? (
        <div style={{ marginTop: '16px', color: theme.textSecondary }}>Loading…</div>
      ) : null}

      {list.status === 'ready' && list.isTruncated ? (
        <div style={{ marginTop: '12px' }}>
          <Notice tone="warning">
            {`Only the first ${list.people.length} rows are shown. Work through these and refresh.`}
          </Notice>
        </div>
      ) : null}

      {list.status === 'ready' && list.people.length === 0 && ownerFilter !== null ? (
        <div style={{ marginTop: '16px' }} data-testid="empty">
          <Notice tone="info" title="Nothing is due today.">
            {selection.kind === 'everyone'
              ? 'Nobody has anything due today or overdue. '
              : 'Nothing here is due today or overdue. '}
            This list is empty because there is nothing to do, not because anything failed to load.
            Contacts with no next action date are on Cold.
          </Notice>
        </div>
      ) : null}

      {list.status === 'ready' && selection.kind === 'everyone'
        ? groupByOwner(list.people, members, today).map((group) => (
            <div key={group.ownerId} style={{ marginTop: '18px' }} data-testid="owner-group">
              <h2 style={{ fontSize: '14px', fontWeight: 600, margin: '0', paddingBottom: '2px', borderBottom: `1px solid ${theme.border}` }}>
                {`${group.ownerName} (${group.total})`}
              </h2>
              {group.sections.map((section) => (
                <SectionList key={section.key} section={section} renderRow={renderRow} />
              ))}
            </div>
          ))
        : null}

      {list.status === 'ready' && selection.kind !== 'everyone'
        ? sections.map((section) => <SectionList key={section.key} section={section} renderRow={renderRow} />)
        : null}
    </div>
  );
};

export const MyDayPage = () => {
  const scheme = useColorScheme();

  return (
    <ThemeRoot scheme={scheme} testId="airpal-my-day">
      <MyDayContent />
    </ThemeRoot>
  );
};
