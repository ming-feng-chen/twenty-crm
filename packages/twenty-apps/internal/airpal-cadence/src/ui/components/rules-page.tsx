import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { useColorScheme } from 'twenty-sdk/front-component';

import type { CadenceRules } from 'src/utils/cadence-rules';

import { errorText, RequestError } from 'src/ui/api';
import {
  type CadenceChangeRow,
  loadCadenceChanges,
  loadMembers,
  loadRulesPermission,
  type Member,
  type RulesPermission,
} from 'src/ui/data';
import { DEFAULT_TIME_ZONE, formatDateTime, formatDay } from 'src/ui/dates';
import { notify } from 'src/ui/host';
import { channelLabel, plural } from 'src/ui/labels';
import {
  addStep,
  describeSettings,
  describeStep,
  type DraftInputProblems,
  draftInputProblems,
  draftToRules,
  draftToStep,
  EMAIL_ADDRESS,
  isSameRules,
  LINKEDIN_URL,
  type MappedErrors,
  mapServerErrors,
  moveStep,
  removeStep,
  type RulesDraft,
  rulesFingerprint,
  rulesToDraft,
  type SettingsField,
  type StepDraft,
  updateStep,
} from 'src/ui/rules-form';
import {
  errorsOf,
  getRulesRoute,
  type PreviewAnswer,
  previewRulesRoute,
  type RulesAnswer,
  saveRulesRoute,
} from 'src/ui/routes';
import {
  Badge,
  Button,
  Checkbox,
  Field,
  Inline,
  Muted,
  Notice,
  SectionHeading,
  Select,
  Stack,
  TextInput,
  ThemeRoot,
} from 'src/ui/components/primitives';
import { useTheme } from 'src/ui/theme';
import { channelChoicesWith, refreshTouchChannels } from 'src/ui/touch-channels';
import { BUILT_IN_TOUCH_CHANNEL_OPTIONS, type TouchChannelOption } from 'src/utils/touch-channels';

// Cadence rules (SPEC §6): everyone reads the steps and settings in plain
// English and the history of changes; admins edit, preview the effect, save
// and reset to defaults. Saving always goes through a preview of exactly the
// rules being saved, so nobody saves without seeing how many dates move.

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; answer: RulesAnswer };

type Message = { tone: 'error' | 'warning' | 'info' | 'success'; title: string; text?: string };

const GAP_UNIT_CHOICES = [
  { value: 'BUSINESS_DAYS', label: 'business days' },
  { value: 'CALENDAR_DAYS', label: 'calendar days' },
];

const REQUIRED_DATA_CHOICES = [
  { value: '', label: 'Nothing' },
  { value: LINKEDIN_URL, label: 'A LinkedIn URL' },
  { value: EMAIL_ADDRESS, label: 'An email address' },
];

const errorsFor = (
  mapped: MappedErrors | null,
  field: SettingsField,
  inputProblem: string | undefined,
): string[] => [
  ...(inputProblem === undefined ? [] : [inputProblem]),
  ...(mapped?.settings[field] ?? []),
];

// --- Read-only view ---------------------------------------------------------

const RulesSummary = ({ rules }: { rules: CadenceRules }) => {
  const theme = useTheme();

  return (
    <Stack gap="10px">
      <ol style={{ margin: '0', paddingLeft: '20px' }} data-testid="rules-steps">
        {rules.steps.map((step, index) => (
          <li key={`${step.key ?? 'step'}-${index}`} style={{ padding: '3px 0' }}>
            {describeStep(step)}
          </li>
        ))}
      </ol>
      <div style={{ color: theme.textSecondary }}>
        {describeSettings(rules).map((sentence) => (
          <div key={sentence} style={{ padding: '1px 0' }}>
            {sentence}
          </div>
        ))}
      </div>
    </Stack>
  );
};

const History = ({
  state,
  timeZone,
}: {
  state: { status: 'loading' | 'ready' | 'error'; rows: CadenceChangeRow[]; error: string | null };
  timeZone: string;
}) => {
  const theme = useTheme();

  return (
    <div data-testid="rules-history">
      <SectionHeading>History</SectionHeading>
      {state.status === 'loading' ? <Muted>Loading the history…</Muted> : null}
      {state.status === 'error' ? (
        <Notice tone="error" title="The history could not load.">
          {state.error}
        </Notice>
      ) : null}
      {state.status === 'ready' && state.rows.length === 0 ? <Muted>No changes recorded yet.</Muted> : null}
      {state.status === 'ready' && state.rows.length > 0 ? (
        <ul style={{ margin: '0', padding: '0' }}>
          {state.rows.map((row) => (
            <li
              key={row.id}
              style={{ listStyle: 'none', borderTop: `1px solid ${theme.border}`, padding: '6px 0' }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', alignItems: 'baseline' }}>
                <strong>{row.changedByName ?? 'The app'}</strong>
                <span style={{ color: theme.textSecondary, fontSize: theme.smallFontSize }}>
                  {formatDateTime(row.changedAt, timeZone)}
                </span>
                {row.contactsWhoseDateChanged === null ? null : (
                  <Badge>{`${plural(row.contactsWhoseDateChanged, 'date')} moved of ${row.contactsRecomputed ?? '?'}`}</Badge>
                )}
              </div>
              <div style={{ color: theme.textSecondary, marginTop: '2px' }}>{row.summary ?? 'No summary.'}</div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

// --- Editor -----------------------------------------------------------------

const StepEditor = ({
  step,
  index,
  count,
  channelOptions,
  problems,
  serverErrors,
  onChange,
  onMove,
  onRemove,
}: {
  step: StepDraft;
  index: number;
  count: number;
  channelOptions: readonly TouchChannelOption[];
  problems: DraftInputProblems['steps'][number] | undefined;
  serverErrors: string[];
  onChange: (patch: Partial<StepDraft>) => void;
  onMove: (offset: -1 | 1) => void;
  onRemove: () => void;
}) => {
  const theme = useTheme();
  const isLast = index === count - 1;

  return (
    <div
      data-testid="step-editor"
      style={{
        border: `1px solid ${serverErrors.length > 0 ? theme.danger : theme.border}`,
        borderRadius: theme.radius,
        padding: '10px 12px',
        background: theme.backgroundSecondary,
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong>{`Step ${index + 1}`}</strong>
        <Inline>
          <Button compact disabled={index === 0} onClick={() => onMove(-1)} ariaLabel={`Move step ${index + 1} up`}>
            ↑ Up
          </Button>
          <Button compact disabled={isLast} onClick={() => onMove(1)} ariaLabel={`Move step ${index + 1} down`}>
            ↓ Down
          </Button>
          <Button compact disabled={count === 1} onClick={onRemove} ariaLabel={`Remove step ${index + 1}`}>
            Remove
          </Button>
        </Inline>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 16px', marginTop: '8px' }}>
        <Field label="Name" help="Shown as the Step on My Day." errors={problems?.label === undefined ? [] : [problems.label]}>
          <TextInput value={step.label} onChange={(label) => onChange({ label })} ariaLabel="Step name" width="200px" />
        </Field>
        <Field label="Channel" help="What the touch for this step is.">
          <Select
            value={step.channel}
            onChange={(channel) => onChange({ channel })}
            options={channelChoicesWith(channelOptions, step.channel, channelLabel)}
            ariaLabel="Step channel"
          />
        </Field>
        <Field
          label="How many times"
          help={step.isForever ? 'Repeats for ever; it must be the last step.' : 'Each one counts as a touch of this step.'}
          errors={problems?.repeat === undefined ? [] : [problems.repeat]}
        >
          <Inline>
            {step.isForever ? null : (
              <TextInput value={step.repeat} onChange={(repeat) => onChange({ repeat })} ariaLabel="Repeat count" width="64px" />
            )}
            <Checkbox
              checked={step.isForever}
              onChange={(isForever) =>
                onChange({
                  isForever,
                  occurrenceNoun: isForever && step.occurrenceNoun === '' ? 'email' : step.occurrenceNoun,
                })
              }
              label="For ever"
            />
          </Inline>
        </Field>
        <Field
          label="Wait before each one"
          help="Counted from the previous touch in the sequence."
          errors={problems?.gapBeforeAmount === undefined ? [] : [problems.gapBeforeAmount]}
        >
          <Inline>
            <TextInput
              value={step.gapBeforeAmount}
              onChange={(gapBeforeAmount) => onChange({ gapBeforeAmount })}
              ariaLabel="Gap amount"
              width="64px"
            />
            <Select
              value={step.gapBeforeUnit}
              onChange={(gapBeforeUnit) => onChange({ gapBeforeUnit })}
              options={GAP_UNIT_CHOICES}
              ariaLabel="Gap unit"
            />
          </Inline>
        </Field>
        {step.isForever ? (
          <Field label="Name for one occurrence" help={`Optional. "email" shows "${step.label || 'Drip'}, email 3".`}>
            <TextInput
              value={step.occurrenceNoun}
              onChange={(occurrenceNoun) => onChange({ occurrenceNoun })}
              ariaLabel="Occurrence name"
              width="120px"
            />
          </Field>
        ) : null}
        <Field label="Needs" help="Data the step cannot happen without.">
          <Select
            value={step.requiredData}
            onChange={(requiredData) => onChange({ requiredData })}
            options={REQUIRED_DATA_CHOICES}
            ariaLabel="Required data"
          />
        </Field>
        {step.requiredData === '' ? null : (
          <Field
            label="When it is missing"
            help={
              step.requiredData === LINKEDIN_URL
                ? 'Nothing offers a way to add a LinkedIn URL, so the step can only be skipped.'
                : 'Block shows "Add email address" on the row until one is added.'
            }
          >
            <Select
              value={step.whenDataMissing}
              onChange={(whenDataMissing) => onChange({ whenDataMissing })}
              options={[
                { value: 'SKIP', label: 'Skip the step' },
                ...(step.requiredData === LINKEDIN_URL ? [] : [{ value: 'BLOCK', label: 'Wait until it is added' }]),
                ...(step.whenDataMissing === '' ? [{ value: '', label: 'Choose…' }] : []),
              ]}
              ariaLabel="When data is missing"
            />
          </Field>
        )}
      </div>

      <div style={{ marginTop: '8px' }}>
        <Checkbox
          checked={step.waitsForAcceptance}
          onChange={(waitsForAcceptance) => onChange({ waitsForAcceptance })}
          label="Only after they accept the connection request (needs a connection request step before it)"
        />
      </div>

      <div style={{ marginTop: '8px', fontSize: theme.smallFontSize, color: theme.textSecondary }}>
        {describeStep(draftToStep(step))}
        <span style={{ marginLeft: '6px', color: theme.textTertiary }}>{`Key: ${step.key || '(new)'}`}</span>
      </div>

      {serverErrors.map((error) => (
        <div key={error} role="alert" style={{ marginTop: '4px', fontSize: theme.smallFontSize, color: theme.danger }}>
          {error}
        </div>
      ))}
    </div>
  );
};

// The live channels, then any the draft names that the field no longer
// offers, so they can still be seen and unticked.
const nonAdvancingChoices = (
  options: readonly TouchChannelOption[],
  selected: readonly string[],
): TouchChannelOption[] => [
  ...options,
  ...selected
    .filter((value) => !options.some((option) => option.value === value))
    .map((value) => ({ value, label: `${channelLabel(value)} (not offered any more)` })),
];

const SettingsEditor = ({
  draft,
  channelOptions,
  problems,
  mapped,
  onChange,
}: {
  draft: RulesDraft;
  channelOptions: readonly TouchChannelOption[];
  problems: DraftInputProblems;
  mapped: MappedErrors | null;
  onChange: (patch: Partial<RulesDraft>) => void;
}) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 18px' }}>
    <Field label="Name" errors={errorsFor(mapped, 'name', undefined)}>
      <TextInput value={draft.name} onChange={(name) => onChange({ name })} ariaLabel="Cadence name" width="220px" />
    </Field>
    <Field label="Time zone" help='An IANA name, such as "Europe/London". Decides what "today" is.' errors={errorsFor(mapped, 'timeZone', undefined)}>
      <TextInput value={draft.timeZone} onChange={(timeZone) => onChange({ timeZone })} ariaLabel="Time zone" width="180px" />
    </Field>
    <Field label="Weekends" help="When on, business days skip Saturdays and Sundays." errors={errorsFor(mapped, 'skipWeekends', undefined)}>
      <Checkbox checked={draft.skipWeekends} onChange={(skipWeekends) => onChange({ skipWeekends })} label="Skip weekends" />
    </Field>
    <Field
      label="Silence before a strike"
      help="After we reply, this much silence from them counts as one strike."
      errors={errorsFor(mapped, 'strikeSilenceGap', problems.settings.strikeSilenceGap)}
    >
      <Inline>
        <TextInput
          value={draft.strikeSilenceGapAmount}
          onChange={(strikeSilenceGapAmount) => onChange({ strikeSilenceGapAmount })}
          ariaLabel="Strike silence amount"
          width="64px"
        />
        <Select
          value={draft.strikeSilenceGapUnit}
          onChange={(strikeSilenceGapUnit) => onChange({ strikeSilenceGapUnit })}
          options={GAP_UNIT_CHOICES}
          ariaLabel="Strike silence unit"
        />
      </Inline>
    </Field>
    <Field
      label="Strike limit"
      help='After this many strikes the cadence stops and the row offers "Resume cadence".'
      errors={errorsFor(mapped, 'strikeLimit', problems.settings.strikeLimit)}
    >
      <TextInput value={draft.strikeLimit} onChange={(strikeLimit) => onChange({ strikeLimit })} ariaLabel="Strike limit" width="64px" />
    </Field>
    <Field
      label="Wait for acceptance"
      help='How long a connection request may go unaccepted before the row offers "Sent InMail" and "Skip to email".'
      errors={errorsFor(mapped, 'acceptanceTimeout', problems.settings.acceptanceTimeout)}
    >
      <Inline>
        <TextInput
          value={draft.acceptanceTimeoutAmount}
          onChange={(acceptanceTimeoutAmount) => onChange({ acceptanceTimeoutAmount })}
          ariaLabel="Acceptance wait amount"
          width="64px"
        />
        <Select
          value={draft.acceptanceTimeoutUnit}
          onChange={(acceptanceTimeoutUnit) => onChange({ acceptanceTimeoutUnit })}
          options={GAP_UNIT_CHOICES}
          ariaLabel="Acceptance wait unit"
        />
      </Inline>
    </Field>
    <div style={{ flexBasis: '100%' }}>
      <Field
        label="Not replies"
        help="Inbound touches on these channels are logged but never count as a reply and never move the sequence. A step's own channel cannot be one of them."
        errors={errorsFor(mapped, 'nonAdvancingChannels', undefined)}
      >
        <Inline gap="12px">
          {nonAdvancingChoices(channelOptions, draft.nonAdvancingChannels).map((choice) => (
            <Checkbox
              key={choice.value}
              checked={draft.nonAdvancingChannels.includes(choice.value)}
              onChange={(checked) =>
                onChange({
                  nonAdvancingChannels: checked
                    ? [...draft.nonAdvancingChannels, choice.value]
                    : draft.nonAdvancingChannels.filter((channel) => channel !== choice.value),
                })
              }
              label={choice.label}
            />
          ))}
        </Inline>
      </Field>
    </div>
    <Field
      label="Sent InMail logs"
      help="The touch channel the Sent InMail button logs. After it, the sequence moves on to the next steps. Not editable here; no step may use it."
      errors={errorsFor(mapped, 'inMailChannel', undefined)}
    >
      <span data-testid="in-mail-channel">
        {draft.inMailChannel === null ? '(unset)' : `${channelLabel(draft.inMailChannel)} (${draft.inMailChannel})`}
      </span>
    </Field>
  </div>
);

const PreviewResult = ({
  preview,
  members,
  isCurrent,
}: {
  preview: PreviewAnswer;
  members: readonly Member[];
  isCurrent: boolean;
}) => {
  const theme = useTheme();
  const sample = preview.changes.slice(0, 15);
  const ownerName = (id: string | null) =>
    id === null ? 'No owner' : (members.find((member) => member.id === id)?.displayName ?? 'A former member');

  return (
    <div data-testid="rules-preview">
      <Notice
        tone={isCurrent ? 'info' : 'warning'}
        title={
          isCurrent
            ? `Saving would move ${plural(preview.contactsWhoseDateChanged, 'next action date')} (of ${plural(preview.contactsRecomputed, 'contact')} recomputed).`
            : 'You changed the rules after this preview. Preview again before saving.'
        }
      />
      {sample.length > 0 ? (
        <table style={{ marginTop: '6px', borderCollapse: 'collapse', fontSize: theme.smallFontSize, width: '100%' }}>
          <thead>
            <tr style={{ textAlign: 'left', color: theme.textTertiary }}>
              <th style={{ padding: '3px 6px' }}>Contact</th>
              <th style={{ padding: '3px 6px' }}>Owner</th>
              <th style={{ padding: '3px 6px' }}>Now</th>
              <th style={{ padding: '3px 6px' }}>Would be</th>
            </tr>
          </thead>
          <tbody>
            {sample.map((change) => (
              <tr key={change.personId} style={{ borderTop: `1px solid ${theme.border}` }}>
                <td style={{ padding: '3px 6px' }}>{change.name}</td>
                <td style={{ padding: '3px 6px' }}>{ownerName(change.ownerId)}</td>
                <td style={{ padding: '3px 6px' }}>{change.from === null ? 'No date' : formatDay(change.from)}</td>
                <td style={{ padding: '3px 6px' }}>{change.to === null ? 'No date (Cold)' : formatDay(change.to)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {preview.contactsWhoseDateChanged > sample.length ? (
        <div style={{ marginTop: '4px', fontSize: theme.smallFontSize, color: theme.textTertiary }}>
          {`…and ${preview.contactsWhoseDateChanged - sample.length} more.`}
        </div>
      ) : null}
    </div>
  );
};

const RulesContent = () => {
  const theme = useTheme();
  const client = useMemo(() => new CoreApiClient(), []);

  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [permission, setPermission] = useState<RulesPermission>('unknown');
  const [members, setMembers] = useState<Member[]>([]);
  const [history, setHistory] = useState<{
    status: 'loading' | 'ready' | 'error';
    rows: CadenceChangeRow[];
    error: string | null;
  }>({ status: 'loading', rows: [], error: null });
  const [draft, setDraft] = useState<RulesDraft | null>(null);
  const [preview, setPreview] = useState<{ fingerprint: string; answer: PreviewAnswer } | null>(null);
  const [mapped, setMapped] = useState<MappedErrors | null>(null);
  const [busy, setBusy] = useState<'preview' | 'save' | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [discardedDraft, setDiscardedDraft] = useState<RulesDraft | null>(null);

  const loadHistory = useCallback(async () => {
    setHistory((current) => ({ ...current, status: 'loading', error: null }));

    try {
      setHistory({ status: 'ready', rows: await loadCadenceChanges(client), error: null });
    } catch (error) {
      setHistory({ status: 'error', rows: [], error: errorText(error) });
    }
  }, [client]);

  const loadRules = useCallback(async () => {
    setLoad({ status: 'loading' });

    try {
      setLoad({ status: 'ready', answer: await getRulesRoute() });
    } catch (error) {
      setLoad({ status: 'error', error: errorText(error) });
    }
  }, []);

  useEffect(() => {
    void loadRules();
    void loadHistory();
    void loadRulesPermission().then(setPermission);
    void loadMembers(client)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [client, loadHistory, loadRules]);

  if (load.status === 'loading') {
    return <div key="loading" style={{ padding: '24px', color: theme.textSecondary }}>Loading the cadence rules…</div>;
  }

  if (load.status === 'error') {
    return (
      <div key="error" style={{ padding: '24px' }}>
        <Notice tone="error" title="The cadence rules could not load.">
          {load.error}
        </Notice>
        <div style={{ marginTop: '8px' }}>
          <Button onClick={() => void loadRules()}>Try again</Button>
        </div>
      </div>
    );
  }

  const { answer } = load;
  const timeZone = answer.activeRules?.timeZone ?? DEFAULT_TIME_ZONE;
  const shownRules = answer.activeRules ?? answer.storedRules ?? answer.defaults;
  const baseRules = answer.activeRules;
  const canEdit = permission !== 'readOnly';
  const isEditing = draft !== null;
  const draftRules = draft === null ? null : draftToRules(draft);
  const fingerprint = draftRules === null ? null : rulesFingerprint(draftRules);
  const problems = draft === null ? null : draftInputProblems(draft);
  const isPreviewCurrent = preview !== null && preview.fingerprint === fingerprint;
  const hasChanges = draftRules !== null && !isSameRules(draftRules, baseRules ?? answer.storedRules ?? answer.defaults);
  const isSaveBlocked = answer.isSaveInProgress;

  const startEditing = (next: RulesDraft) => {
    setDraft(next);
    setPreview(null);
    setMapped(null);
    setMessage(null);
  };

  const changeDraft = (patch: Partial<RulesDraft>) => {
    setDraft((current) => (current === null ? current : { ...current, ...patch }));
  };

  const runPreview = async (rules: CadenceRules) => {
    setBusy('preview');
    setMessage(null);

    try {
      const result = await previewRulesRoute(rules);

      setPreview({ fingerprint: rulesFingerprint(rules), answer: result });
      setMapped(null);
    } catch (error) {
      setPreview(null);

      if (error instanceof RequestError && error.status === 422) {
        setMapped(mapServerErrors(errorsOf(error.body)));
        setMessage({ tone: 'error', title: 'These rules are not valid.', text: 'Fix what is marked in red, then preview again.' });
      } else {
        setMessage({ tone: 'error', title: 'The preview failed.', text: errorText(error) });
      }
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (draftRules === null || draft === null) {
      return;
    }

    setBusy('save');
    setMessage(null);

    try {
      const result = await saveRulesRoute(draftRules, baseRules);

      if (result.status === 'applied') {
        const failures = result.failures.length;

        setMessage({
          tone: failures > 0 ? 'warning' : 'success',
          title: `Saved. ${plural(result.contactsRecomputed, 'contact')} recomputed; ${plural(result.contactsWhoseDateChanged, 'next action date')} moved.`,
          text:
            failures > 0
              ? `${plural(failures, 'contact')} could not be recomputed and will be retried by the daily run: ${result.failures
                  .slice(0, 5)
                  .map((failure) => failure.error)
                  .join('; ')}`
              : result.summary,
        });
        notify('success', 'Cadence rules saved', result.summary);
      } else {
        setMessage({ tone: 'info', title: 'Nothing changed: the rules are the same as before.' });
      }

      setDraft(null);
      setPreview(null);
      setMapped(null);
      await loadRules();
      await loadHistory();
      try {
        await refreshTouchChannels();
      } catch {
        setMessage({ tone: 'warning', title: 'Saved. Reload My Day to refresh its channel list.' });
      }
    } catch (error) {
      if (!(error instanceof RequestError)) {
        setMessage({ tone: 'error', title: 'Not saved.', text: errorText(error) });

        return;
      }

      switch (error.status) {
        case 422:
          setMapped(mapServerErrors(errorsOf(error.body)));
          setPreview(null);
          setMessage({ tone: 'error', title: 'Not saved: these rules are not valid.', text: 'Fix what is marked in red, then preview again.' });
          return;
        case 409:
          setDiscardedDraft(draft);
          setDraft(null);
          setPreview(null);
          setMapped(null);
          setMessage({
            tone: 'warning',
            title: 'Not saved: someone else saved the rules after you opened them.',
            text: 'Their version is shown below. Your changes are kept: "Edit again with my changes" puts them back so you can preview and save over theirs on purpose.',
          });
          await loadRules();
          await loadHistory();
          return;
        case 423:
          setMessage({
            tone: 'warning',
            title: 'Not saved: another save is running right now.',
            text: 'Wait a minute, then preview and save again. Your changes are still here.',
          });
          return;
        case 403:
          setPermission('readOnly');
          setDraft(null);
          setPreview(null);
          setMessage({ tone: 'error', title: 'Not saved: only admins can edit the cadence rules.', text: error.message });
          return;
        default:
          setMessage({ tone: 'error', title: 'Not saved.', text: error.message });
      }
    } finally {
      setBusy(null);
    }
  };

  const stepErrors = (index: number) => mapped?.steps[index] ?? [];

  return (
    <div key="ready" style={{ padding: '16px 20px 40px', maxWidth: '1000px' }} data-testid="airpal-cadence-rules">
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 12px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, margin: '0' }}>Cadence rules</h1>
        <Muted>{shownRules.name ?? 'Outreach cadence'}</Muted>
      </div>

      {permission === 'readOnly' ? (
        <div style={{ marginTop: '10px' }}>
          <Notice tone="info">Only admins can edit the rules. You can read them here, and see every change below.</Notice>
        </div>
      ) : null}

      {answer.storedRulesErrors.length > 0 ? (
        <div style={{ marginTop: '10px' }}>
          <Notice tone="error" title="The stored rules have errors, so the cadence still runs on the last valid rules (shown below).">
            {answer.storedRulesErrors.join('\n')}
          </Notice>
        </div>
      ) : null}

      {answer.problems.length > 0 ? (
        <div style={{ marginTop: '10px' }}>
          <Notice tone="warning" title="Problems with the rules in use">
            {answer.problems.join('\n')}
          </Notice>
        </div>
      ) : null}

      {isSaveBlocked ? (
        <div style={{ marginTop: '10px' }}>
          <Notice tone="warning" title="A save is running.">
            Every contact is being recomputed. Saving is off until it finishes; reload in a minute.
          </Notice>
        </div>
      ) : null}

      {message === null ? null : (
        <div style={{ marginTop: '10px' }} data-testid="rules-message">
          <Notice tone={message.tone} title={message.title}>
            {message.text}
          </Notice>
        </div>
      )}

      {!isEditing ? (
        <>
          <SectionHeading>The sequence, in order</SectionHeading>
          <RulesSummary rules={shownRules} />
          <SectionHeading>Outreach channels</SectionHeading>
          <Muted>{shownRules.touchChannels.map((option) => option.label).join(', ')}</Muted>
          {canEdit ? (
            <div style={{ marginTop: '14px' }}>
              <Inline>
                <Button variant="primary" testId="edit-rules" onClick={() => startEditing(rulesToDraft(answer.storedRules ?? shownRules))}>
                  Edit rules
                </Button>
                {discardedDraft === null ? null : (
                  <Button
                    onClick={() => {
                      startEditing(discardedDraft);
                      setDiscardedDraft(null);
                    }}
                  >
                    Edit again with my changes
                  </Button>
                )}
                {permission === 'unknown' ? (
                  <span style={{ fontSize: theme.smallFontSize, color: theme.textTertiary }}>
                    Your permissions could not be checked; saving will say if you cannot edit.
                  </span>
                ) : null}
              </Inline>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <SectionHeading>Outreach channels</SectionHeading>
          <Muted>These channels are available for steps and logging touches. Preview and save to apply changes.</Muted>
          <Stack gap="8px">
            {draft.touchChannels.map((option, index) => (
              <Inline key={option.value}>
                <Field label={`Channel ${index + 1}`}>
                  <TextInput value={option.label} onChange={(label) => changeDraft({ touchChannels: draft.touchChannels.map((current, currentIndex) => currentIndex === index ? { ...current, label } : current) })} />
                </Field>
                {BUILT_IN_TOUCH_CHANNEL_OPTIONS.some((builtIn) => builtIn.value === option.value) ? null : (
                  <Button compact onClick={() => changeDraft({ touchChannels: draft.touchChannels.filter((current) => current.value !== option.value) })}>Remove {option.label}</Button>
                )}
              </Inline>
            ))}
            <Inline>
              <Field label="New channel name"><TextInput value={newChannelName} onChange={setNewChannelName} /></Field>
              <Button disabled={newChannelName.trim().length === 0} onClick={() => {
                const value = newChannelName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
                if (!/^[A-Z][A-Z0-9_]*$/.test(value) || draft.touchChannels.some((option) => option.value === value)) {
                  setMessage({ tone: 'error', title: 'Choose a unique channel name beginning with a letter.' });
                  return;
                }
                changeDraft({ touchChannels: [...draft.touchChannels, { value, label: newChannelName.trim() }] });
                setNewChannelName('');
              }}>Add channel</Button>
            </Inline>
          </Stack>
          <SectionHeading>Settings</SectionHeading>
          {problems === null ? null : (
            <SettingsEditor
              draft={draft}
              channelOptions={draft.touchChannels}
              problems={problems}
              mapped={mapped}
              onChange={changeDraft}
            />
          )}
          {answer.touchChannelsError === null ? null : (
            <div style={{ marginTop: '8px' }}>
              <Notice tone="warning">{answer.touchChannelsError}</Notice>
            </div>
          )}

          <SectionHeading>Steps, in order</SectionHeading>
          {(mapped?.settings.steps ?? []).map((error) => (
            <div key={error} role="alert" style={{ color: theme.danger, fontSize: theme.smallFontSize, marginBottom: '6px' }}>
              {error}
            </div>
          ))}
          <Stack gap="8px">
            {draft.steps.map((step, index) => (
              <StepEditor
                key={step.clientId}
                step={step}
                index={index}
                count={draft.steps.length}
                channelOptions={draft.touchChannels}
                problems={problems?.steps[index]}
                serverErrors={stepErrors(index)}
                onChange={(patch) => changeDraft({ steps: updateStep(draft.steps, index, patch) })}
                onMove={(offset) => {
                  changeDraft({ steps: moveStep(draft.steps, index, offset) });
                  setMapped(null);
                }}
                onRemove={() => {
                  changeDraft({ steps: removeStep(draft.steps, index) });
                  setMapped(null);
                }}
              />
            ))}
          </Stack>
          <div style={{ marginTop: '8px' }}>
            <Button compact onClick={() => changeDraft({ steps: addStep(draft.steps) })}>
              + Add a step
            </Button>
          </div>

          {(mapped?.general.length ?? 0) > 0 ? (
            <div style={{ marginTop: '10px' }}>
              <Notice tone="error" title="Also wrong">
                {mapped?.general.join('\n')}
              </Notice>
            </div>
          ) : null}

          <div
            style={{
              marginTop: '16px',
              padding: '10px 12px',
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius,
              background: theme.backgroundSecondary,
            }}
          >
            <Stack>
              <Inline>
                <Button
                  testId="preview-rules"
                  disabled={busy !== null || (problems?.count ?? 0) > 0}
                  onClick={() => draftRules !== null && void runPreview(draftRules)}
                >
                  {busy === 'preview' ? 'Previewing…' : 'Preview changes'}
                </Button>
                <Button
                  variant="primary"
                  testId="save-rules"
                  disabled={busy !== null || !hasChanges || !isPreviewCurrent || isSaveBlocked || (problems?.count ?? 0) > 0}
                  onClick={() => void save()}
                >
                  {busy === 'save' ? 'Saving and recomputing…' : 'Save'}
                </Button>
                <Button
                  disabled={busy !== null}
                  onClick={() => {
                    const defaults = rulesToDraft(answer.defaults);

                    setDraft(defaults);
                    setMapped(null);
                    void runPreview(draftToRules(defaults));
                  }}
                >
                  Reset to defaults
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy !== null}
                  onClick={() => {
                    setDraft(null);
                    setPreview(null);
                    setMapped(null);
                    setMessage(null);
                  }}
                >
                  Discard changes
                </Button>
              </Inline>
              <span style={{ fontSize: theme.smallFontSize, color: theme.textTertiary }}>
                {(problems?.count ?? 0) > 0
                  ? `Fix ${plural(problems?.count ?? 0, 'field')} marked above first.`
                  : !hasChanges
                    ? 'No changes yet.'
                    : isPreviewCurrent
                      ? 'Saving recomputes every contact straight away and records the change in the history.'
                      : 'Preview first: Save turns on once the preview matches what you will save.'}
              </span>
              {busy === 'save' ? (
                <Notice tone="info">Saving and recomputing every contact. This can take a minute; keep this page open.</Notice>
              ) : null}
              {preview === null ? null : (
                <PreviewResult preview={preview.answer} members={members} isCurrent={isPreviewCurrent} />
              )}
            </Stack>
          </div>
        </>
      )}

      <History state={history} timeZone={timeZone} />
    </div>
  );
};

export const RulesPage = ({ fill = true }: { fill?: boolean }) => {
  const scheme = useColorScheme();

  return (
    <ThemeRoot scheme={scheme} testId="airpal-cadence-rules-settings" fill={fill}>
      <RulesContent />
    </ThemeRoot>
  );
};

