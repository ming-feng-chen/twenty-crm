import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import {
  closeSidePanel,
  openSidePanelPage,
  SidePanelPages,
  unmountFrontComponent,
  useColorScheme,
  useRecordId,
  useUserId,
} from 'twenty-sdk/front-component';

import { errorText, metadataQuery, RequestError } from 'src/ui/api';
import {
  loadCadenceTimeZone,
  loadMembers,
  loadPerson,
  loadViewerMemberId,
  type Member,
} from 'src/ui/data';
import { formatDateTime, formatDay, todayIn } from 'src/ui/dates';
import { notify } from 'src/ui/host';
import { stageLabel } from 'src/ui/labels';
import { type MyDayPerson, toMyDayPerson } from 'src/ui/my-day';
import {
  changeOwnerRoute,
  type ChangeOwnerAnswer,
  logTouchRoute,
  recomputeRoute,
  undoTouchRoute,
} from 'src/ui/routes';
import { ChangeOwnerForm } from 'src/ui/components/forms';
import { Button, Inline, Muted, Notice, Stack, ThemeRoot } from 'src/ui/components/primitives';
import { useTheme } from 'src/ui/theme';
import { LOGGED_TOUCH_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/ui/universal-identifiers';

// The person record's commands (SPEC §6): Did it, Change owner…, Recompute.

const describePerson = (view: { cadenceStep?: string | null; nextActionDate?: unknown } | null) => {
  if (view === null) {
    return '';
  }

  const date = typeof view.nextActionDate === 'string' ? view.nextActionDate.slice(0, 10) : null;

  return `Now: ${view.cadenceStep ?? 'no step'}${date === null ? ', no next action date' : `, next action ${formatDay(date)}`}.`;
};

// Opens the "logged touch" panel (with its Undo) for the person. The panel is
// found by its universal identifier, since the side panel wants its id.
const openLoggedTouchPanel = async (personId: string): Promise<boolean> => {
  try {
    const data = await metadataQuery<{ frontComponents?: { id: string; universalIdentifier: string }[] }>(
      '{ frontComponents { id universalIdentifier } }',
    );
    const panel = data.frontComponents?.find(
      (component) => component.universalIdentifier === LOGGED_TOUCH_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
    );

    if (panel === undefined) {
      return false;
    }

    await openSidePanelPage({
      page: SidePanelPages.ViewFrontComponent,
      frontComponentId: panel.id,
      recordId: personId,
      objectNameSingular: 'person',
      pageTitle: 'Did it',
      pageIcon: 'IconCheck',
    });

    return true;
  } catch {
    return false;
  }
};

const finish = async () => {
  try {
    await unmountFrontComponent();
  } catch {
    // Nothing to unmount from.
  }
};

// Headless: runs once per click (the host mounts it once), logs exactly the
// prescribed touch as the viewer, then opens the panel that carries Undo.
export const DidItCommandRunner = () => {
  const recordId = useRecordId();

  useEffect(() => {
    const run = async () => {
      if (recordId === null) {
        notify('error', 'Did it: select exactly one person.');
        await finish();

        return;
      }

      try {
        const answer = await logTouchRoute({ personId: recordId, action: 'didIt' });
        const opened = await openLoggedTouchPanel(recordId);

        notify(
          'success',
          'Did it: logged.',
          `${describePerson(answer.person)} ${
            opened ? 'Undo is in the side panel.' : 'To undo it, open My Day ("Just done") or delete the touch on the person.'
          }`,
        );
      } catch (error) {
        const notOffered = error instanceof RequestError && error.status === 409;

        notify(
          'error',
          notOffered ? 'Did it is not what this person needs now.' : 'Did it did not go through.',
          notOffered
            ? `${errorText(error)} Open My Day to see the right button. Nothing was logged.`
            : errorText(error),
        );
      }

      await finish();
    };

    void run();
    // Runs once per mount: the host mounts a headless command once per click.
  }, []);

  return null;
};

export const RecomputeCommandRunner = () => {
  const recordId = useRecordId();

  useEffect(() => {
    const run = async () => {
      if (recordId === null) {
        notify('error', 'Recompute: select exactly one person.');
        await finish();

        return;
      }

      try {
        const answer = await recomputeRoute(recordId);

        notify('success', 'Recomputed.', describePerson(answer.person));
      } catch (error) {
        notify('error', 'Recompute did not go through.', errorText(error));
      }

      await finish();
    };

    void run();
  }, []);

  return null;
};

type RecentTouch = {
  id: string;
  name: string | null;
  occurredOn: string | null;
  createdAt: string;
  status: 'logged' | 'undoing' | 'undone' | 'failed';
  error: string | null;
};

// How far back the panel looks for touches you just logged.
const RECENT_MINUTES = 30;

const LoggedTouchContent = () => {
  const theme = useTheme();
  const recordId = useRecordId();
  const userId = useUserId();
  const client = useMemo(() => new CoreApiClient(), []);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; error: string }
    | { status: 'ready'; person: MyDayPerson | null; touches: RecentTouch[]; timeZone: string }
  >({ status: 'loading' });

  const load = useCallback(async () => {
    if (recordId === null) {
      setState({ status: 'error', error: 'No person selected.' });

      return;
    }

    try {
      const members = await loadMembers(client);
      const me = await loadViewerMemberId(members, userId);
      const since = new Date(Date.now() - RECENT_MINUTES * 60_000).toISOString();
      const [node, timeZone, { touches }] = await Promise.all([
        loadPerson(client, recordId),
        loadCadenceTimeZone(client),
        client.query({
          touches: {
            __args: {
              first: 5,
              filter: {
                personId: { eq: recordId },
                createdAt: { gte: since },
                ...(me === null ? {} : { loggedById: { eq: me } }),
              },
              orderBy: [{ createdAt: 'DescNullsLast' }],
            },
            edges: { node: { id: true, name: true, occurredOn: true, createdAt: true } },
          },
        }),
      ]);

      setState({
        status: 'ready',
        person: node === null ? null : toMyDayPerson(node),
        timeZone,
        touches: (touches?.edges ?? []).map(({ node: touch }) => ({
          id: touch.id,
          name: touch.name ?? null,
          occurredOn: typeof touch.occurredOn === 'string' ? touch.occurredOn.slice(0, 10) : null,
          createdAt: touch.createdAt,
          status: 'logged',
          error: null,
        })),
      });
    } catch (error) {
      setState({ status: 'error', error: errorText(error) });
    }
  }, [client, recordId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const undo = async (touch: RecentTouch) => {
    const mark = (patch: Partial<RecentTouch>) =>
      setState((current) =>
        current.status !== 'ready'
          ? current
          : { ...current, touches: current.touches.map((entry) => (entry.id === touch.id ? { ...entry, ...patch } : entry)) },
      );

    mark({ status: 'undoing', error: null });

    try {
      const answer = await undoTouchRoute(touch.id);

      mark({ status: 'undone' });
      notify('success', 'Undone.', describePerson(answer.person));
      await load();
    } catch (error) {
      mark({ status: 'failed', error: errorText(error) });
    }
  };

  if (state.status === 'loading') {
    return <div style={{ padding: '16px', color: theme.textSecondary }}>Loading…</div>;
  }

  if (state.status === 'error') {
    return (
      <div style={{ padding: '16px' }}>
        <Notice tone="error" title="This panel could not load.">
          {state.error}
        </Notice>
      </div>
    );
  }

  const { person, touches } = state;
  const today = todayIn(state.timeZone);

  return (
    <div style={{ padding: '16px' }}>
      <Stack>
        {person === null ? null : (
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{person.name}</div>
            <Muted>
              {`${stageLabel(person.stage)} · ${person.step ?? 'no step'} · ${
                person.nextActionDate === null ? 'no next action date' : `next action ${formatDay(person.nextActionDate, { today })}`
              }`}
            </Muted>
          </div>
        )}
        <div style={{ fontWeight: 600, marginTop: '6px' }}>{`Touches you logged in the last ${RECENT_MINUTES} minutes`}</div>
        {touches.length === 0 ? (
          <Muted>None. If you expected one here, refresh the person record to check it was logged.</Muted>
        ) : (
          touches.map((touch) => (
            <div
              key={touch.id}
              style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '6px' }}
            >
              <Inline>
                <span style={{ flex: '1', textDecoration: touch.status === 'undone' ? 'line-through' : 'none' }}>
                  {touch.name ?? 'Touch'}
                  <span style={{ color: theme.textTertiary }}>
                    {` · ${formatDay(touch.occurredOn, { today })} · logged ${formatDateTime(touch.createdAt, state.timeZone)}`}
                  </span>
                </span>
                {touch.status === 'undone' ? (
                  <Muted>Undone</Muted>
                ) : (
                  <Button compact testId="undo" disabled={touch.status === 'undoing'} onClick={() => void undo(touch)}>
                    {touch.status === 'undoing' ? 'Undoing…' : 'Undo'}
                  </Button>
                )}
              </Inline>
              {touch.error === null ? null : (
                <div style={{ marginTop: '4px' }}>
                  <Notice tone="error" title="Undo failed">
                    {touch.error}
                  </Notice>
                </div>
              )}
            </div>
          ))
        )}
        <Inline>
          <Button compact onClick={() => void load()}>
            Refresh
          </Button>
          <Button compact variant="ghost" onClick={() => void closeSidePanel().catch(() => undefined)}>
            Close
          </Button>
        </Inline>
      </Stack>
    </div>
  );
};

export const LoggedTouchPanel = () => {
  const scheme = useColorScheme();

  return (
    <ThemeRoot scheme={scheme} testId="airpal-logged-touch">
      <LoggedTouchContent />
    </ThemeRoot>
  );
};

const ChangeOwnerContent = () => {
  const theme = useTheme();
  const recordId = useRecordId();
  const client = useMemo(() => new CoreApiClient(), []);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'error'; error: string }
    | { status: 'ready'; person: MyDayPerson; members: Member[] }
  >({ status: 'loading' });
  const [result, setResult] = useState<ChangeOwnerAnswer | null>(null);

  const load = useCallback(async () => {
    if (recordId === null) {
      setState({ status: 'error', error: 'Select exactly one person, then choose Change owner… again.' });

      return;
    }

    try {
      const [node, members] = await Promise.all([loadPerson(client, recordId), loadMembers(client)]);

      if (node === null) {
        setState({ status: 'error', error: 'This person could not be found. It may have been deleted.' });

        return;
      }

      setState({ status: 'ready', person: toMyDayPerson(node), members });
    } catch (error) {
      setState({ status: 'error', error: errorText(error) });
    }
  }, [client, recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return <div style={{ padding: '16px', color: theme.textSecondary }}>Loading…</div>;
  }

  if (state.status === 'error') {
    return (
      <div style={{ padding: '16px' }}>
        <Notice tone="error" title="Change owner is not available.">
          {state.error}
        </Notice>
      </div>
    );
  }

  const { person, members } = state;

  if (result !== null) {
    const owner = members.find((member) => member.id === result.person?.cadenceOwnerId)?.displayName ?? 'nobody';

    return (
      <div style={{ padding: '16px' }}>
        <Stack>
          <Notice tone="success" title={result.changed ? `${person.name} is now owned by ${owner}.` : 'Nothing changed.'}>
            {result.isHandover
              ? result.mode === 'KEEP_POSITION'
                ? 'Handed over, keeping their place in the sequence.'
                : 'Handed over: the sequence starts fresh for the new owner.'
              : undefined}
          </Notice>
          {(result.warnings ?? []).map((warning) => (
            <Notice key={warning} tone="warning">
              {warning}
            </Notice>
          ))}
          <Muted>{describePerson(result.person)}</Muted>
          <Inline>
            <Button compact onClick={() => void closeSidePanel().catch(() => undefined)}>
              Close
            </Button>
          </Inline>
        </Stack>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <Stack>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>{`Change owner of ${person.name}`}</div>
        <ChangeOwnerForm
          subject={{
            personName: person.name,
            ownerId: person.ownerId,
            replyOwedSince: person.actions?.replyOwedSince ?? null,
            isLinkedInPosition: person.actions?.isLinkedInPosition ?? false,
          }}
          members={members}
          onSubmit={async ({ ownerId, mode }) => {
            const answer = await changeOwnerRoute({ personId: person.id, ownerId, mode });

            setResult(answer);
            notify(
              (answer.warnings ?? []).length > 0 ? 'warning' : 'success',
              answer.changed ? `${person.name}: owner changed.` : `${person.name}: nothing changed.`,
              (answer.warnings ?? []).join(' ') || undefined,
            );
          }}
        />
      </Stack>
    </div>
  );
};

export const ChangeOwnerPanel = () => {
  const scheme = useColorScheme();

  return (
    <ThemeRoot scheme={scheme} testId="airpal-change-owner">
      <ChangeOwnerContent />
    </ThemeRoot>
  );
};

