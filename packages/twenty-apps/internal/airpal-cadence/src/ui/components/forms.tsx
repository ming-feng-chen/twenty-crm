import { useState } from 'react';

import { checkFutureDate, checkTouchDate, formatDay } from 'src/ui/dates';
import {
  channelLabel,
  DIRECTION_CHOICES,
  OPT_OUT_REASON_CHOICES,
  OUTCOME_CHOICES,
  PERMANENT_OPT_OUT_REASON,
} from 'src/ui/labels';
import { errorText } from 'src/ui/api';
import {
  Button,
  Field,
  Inline,
  Notice,
  Radio,
  Select,
  Stack,
  TextArea,
  TextInput,
} from 'src/ui/components/primitives';
import { type Member } from 'src/ui/data';
import { type OwnerChangeMode } from 'src/ui/routes';
import { channelChoicesWith, useTouchChannels } from 'src/ui/touch-channels';

// The inline forms behind My Day's secondary controls and overflow menu, and
// the Change owner… dialog (also used by the person command). Each form runs
// its own submit, shows its own error and stays open when it fails, so a
// refusal is never lost.

type Submit<TValue> = (value: TValue) => Promise<void>;

const useSubmit = <TValue,>(onSubmit: Submit<TValue>) => {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (value: TValue) => {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      await onSubmit(value);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setIsBusy(false);
    }
  };

  return { isBusy, error, submit };
};

const SubmitError = ({ error }: { error: string | null }) =>
  error === null ? null : (
    <Notice tone="error" title="Not saved">
      {error}
    </Notice>
  );

export const EarlierDateForm = ({
  actionLabel,
  today,
  onSubmit,
}: {
  actionLabel: string;
  today: string;
  onSubmit: Submit<{ occurredOn: string; note: string }>;
}) => {
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const { isBusy, error, submit } = useSubmit(onSubmit);
  const check = checkTouchDate(date, today);

  return (
    <Stack>
      <Inline align="flex-end" gap="10px">
        <Field label="Date it happened" errors={check.ok ? [] : [check.message]}>
          <TextInput
            type="date"
            value={date}
            onChange={setDate}
            ariaLabel="Date it happened"
            invalid={!check.ok}
          />
        </Field>
        <div style={{ flex: '1', minWidth: '200px' }}>
          <Field label="Note (optional)">
            <TextArea value={note} onChange={setNote} ariaLabel="Note" rows={1} />
          </Field>
        </div>
      </Inline>
      <Inline>
        <Button
          variant="primary"
          disabled={!check.ok || isBusy}
          onClick={() => submit({ occurredOn: date, note: note.trim() })}
        >
          {isBusy ? 'Logging…' : `Log "${actionLabel}" on ${formatDay(date)}`}
        </Button>
        <span style={{ fontSize: '12px', opacity: '0.7' }}>
          Never a future date: {formatDay(today)} at the latest.
        </span>
      </Inline>
      <SubmitError error={error} />
    </Stack>
  );
};

export type SomethingElseValue = {
  channel: string;
  direction: string;
  outcome: string | null;
  occurredOn: string;
  note: string;
};

export const SomethingElseForm = ({
  today,
  onSubmit,
}: {
  today: string;
  onSubmit: Submit<SomethingElseValue>;
}) => {
  // Every saved outreach channel, including custom ones.
  const channels = useTouchChannels();
  const [chosenChannel, setChannel] = useState<string | null>(null);
  const channel =
    chosenChannel ??
    (channels.options.some((option) => option.value === 'CALL')
      ? 'CALL'
      : (channels.options[0]?.value ?? ''));
  const [direction, setDirection] = useState('OUTBOUND');
  const [outcome, setOutcome] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const { isBusy, error, submit } = useSubmit(onSubmit);
  const check = checkTouchDate(date, today);

  return (
    <Stack>
      <Inline align="flex-end" gap="10px">
        <Field label="Channel">
          <Select
            value={channel}
            onChange={setChannel}
            options={channelChoicesWith(channels.options, channel, channelLabel)}
            ariaLabel="Channel"
          />
        </Field>
        <Field label="Direction">
          <Select
            value={direction}
            onChange={setDirection}
            options={DIRECTION_CHOICES.map((option) => ({
              value: option.value,
              label: option.value === 'INBOUND' ? 'Inbound (from them)' : 'Outbound (from us)',
            }))}
            ariaLabel="Direction"
          />
        </Field>
        <Field label="Outcome">
          <Select
            value={outcome}
            onChange={setOutcome}
            options={[{ value: '', label: 'No outcome' }, ...OUTCOME_CHOICES]}
            ariaLabel="Outcome"
          />
        </Field>
        <Field label="Date" errors={check.ok ? [] : [check.message]}>
          <TextInput type="date" value={date} onChange={setDate} ariaLabel="Date" invalid={!check.ok} />
        </Field>
      </Inline>
      {channels.error === null ? null : <Notice tone="warning">{channels.error}</Notice>}
      <Field label="Note (optional)">
        <TextArea value={note} onChange={setNote} ariaLabel="Note" rows={2} />
      </Field>
      <Inline>
        <Button
          variant="primary"
          disabled={!check.ok || isBusy || channel === ''}
          onClick={() =>
            submit({
              channel,
              direction,
              outcome: outcome === '' ? null : outcome,
              occurredOn: date,
              note: note.trim(),
            })
          }
        >
          {isBusy ? 'Logging…' : 'Log this touch'}
        </Button>
        <span style={{ fontSize: '12px', opacity: '0.7' }}>
          The step is worked out again from what you log. An inbound reply stops the sequence.
        </span>
      </Inline>
      <SubmitError error={error} />
    </Stack>
  );
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AddEmailForm = ({ onSubmit }: { onSubmit: Submit<string> }) => {
  const [email, setEmail] = useState('');
  const { isBusy, error, submit } = useSubmit(onSubmit);
  const trimmed = email.trim();
  const isValid = EMAIL_PATTERN.test(trimmed);

  return (
    <Stack>
      <Inline align="flex-end">
        <Field
          label="Email address"
          errors={trimmed.length > 0 && !isValid ? ['That does not look like an email address.'] : []}
        >
          <TextInput
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="name@airport.com"
            ariaLabel="Email address"
            width="260px"
            invalid={trimmed.length > 0 && !isValid}
          />
        </Field>
        <Button variant="primary" disabled={!isValid || isBusy} onClick={() => submit(trimmed)}>
          {isBusy ? 'Saving…' : 'Save address'}
        </Button>
      </Inline>
      <span style={{ fontSize: '12px', opacity: '0.7' }}>
        Saved as their primary email; the next step is worked out again straight after.
      </span>
      <SubmitError error={error} />
    </Stack>
  );
};

export const FutureDateForm = ({
  today,
  label,
  buttonLabel,
  help,
  optional = false,
  initial,
  onSubmit,
}: {
  today: string;
  label: string;
  buttonLabel: string;
  help: string;
  optional?: boolean;
  initial: string;
  onSubmit: Submit<string | null>;
}) => {
  const [date, setDate] = useState(initial);
  const { isBusy, error, submit } = useSubmit(onSubmit);
  const check = checkFutureDate(date, today, { optional });

  return (
    <Stack>
      <Inline align="flex-end">
        <Field label={label} help={help} errors={check.ok ? [] : [check.message]}>
          <TextInput type="date" value={date} onChange={setDate} ariaLabel={label} invalid={!check.ok} />
        </Field>
        <Button
          variant="primary"
          disabled={!check.ok || isBusy}
          onClick={() => submit(date === '' ? null : date)}
        >
          {isBusy ? 'Saving…' : buttonLabel}
        </Button>
      </Inline>
      <SubmitError error={error} />
    </Stack>
  );
};

export const OptOutForm = ({
  personName,
  onSubmit,
}: {
  personName: string;
  onSubmit: Submit<string>;
}) => {
  const [reason, setReason] = useState('NOT_INTERESTED');
  const [isConfirming, setIsConfirming] = useState(false);
  const { isBusy, error, submit } = useSubmit(onSubmit);
  const isPermanent = reason === PERMANENT_OPT_OUT_REASON;

  return (
    <Stack>
      <Inline align="flex-end">
        <Field label="Reason">
          <Select
            value={reason}
            onChange={(value) => {
              setReason(value);
              setIsConfirming(false);
            }}
            options={OPT_OUT_REASON_CHOICES}
            ariaLabel="Opt-out reason"
          />
        </Field>
        {isPermanent ? null : (
          <Button variant="primary" disabled={isBusy} onClick={() => submit(reason)}>
            {isBusy ? 'Saving…' : 'Opt out'}
          </Button>
        )}
      </Inline>
      {isPermanent ? (
        <Notice tone="warning" title="This is permanent.">
          {`"Asked us to stop" adds ${personName}'s email address and LinkedIn URL to the suppression list. They will never be contacted again, even if this record is edited or re-imported later. It cannot be undone from here.`}
        </Notice>
      ) : null}
      {isPermanent && !isConfirming ? (
        <Inline>
          <Button variant="danger" onClick={() => setIsConfirming(true)}>
            Opt out permanently…
          </Button>
        </Inline>
      ) : null}
      {isPermanent && isConfirming ? (
        <Inline>
          <Button variant="danger" disabled={isBusy} onClick={() => submit(reason)}>
            {isBusy ? 'Saving…' : `Yes, ${personName} asked us to stop`}
          </Button>
          <Button variant="ghost" onClick={() => setIsConfirming(false)}>
            Cancel
          </Button>
        </Inline>
      ) : null}
      <SubmitError error={error} />
    </Stack>
  );
};

export type ChangeOwnerSubject = {
  personName: string;
  ownerId: string | null;
  replyOwedSince: string | null;
  isLinkedInPosition: boolean;
};

export const ChangeOwnerForm = ({
  subject,
  members,
  onSubmit,
}: {
  subject: ChangeOwnerSubject;
  members: readonly Member[];
  onSubmit: Submit<{ ownerId: string | null; mode: OwnerChangeMode }>;
}) => {
  const others = members.filter((member) => member.id !== subject.ownerId);
  const [ownerValue, setOwnerValue] = useState(others[0]?.id ?? '');
  const [mode, setMode] = useState<OwnerChangeMode>('START_FRESH');
  const { isBusy, error, submit } = useSubmit(onSubmit);
  const ownerId = ownerValue === '__nobody__' || ownerValue === '' ? null : ownerValue;
  const isHandover = subject.ownerId !== null && ownerId !== null;
  const currentOwnerName =
    members.find((member) => member.id === subject.ownerId)?.displayName ??
    (subject.ownerId === null ? 'nobody' : 'a former member');
  const options = [
    ...others.map((member) => ({ value: member.id, label: member.displayName })),
    ...(subject.ownerId === null ? [] : [{ value: '__nobody__', label: 'Nobody (unassign)' }]),
  ];

  return (
    <Stack>
      <span>
        {subject.personName} is owned by <strong>{currentOwnerName}</strong>.
      </span>
      {options.length === 0 ? (
        <Notice tone="info">There is nobody else to hand them over to.</Notice>
      ) : (
        <>
          <Field label="New owner">
            <Select value={ownerValue} onChange={setOwnerValue} options={options} ariaLabel="New owner" />
          </Field>
          {ownerId === null ? (
            <Notice tone="warning">
              Without an owner they leave everyone's My Day and show on Cold until someone takes them.
            </Notice>
          ) : null}
          {isHandover ? (
            <Stack gap="6px">
              <Radio
                name="handover-mode"
                checked={mode === 'START_FRESH'}
                onChange={() => setMode('START_FRESH')}
                label="Start fresh (recommended)"
                description="The sequence restarts at step 1 for the new owner; earlier touches no longer count towards it."
              />
              <Radio
                name="handover-mode"
                checked={mode === 'KEEP_POSITION'}
                onChange={() => setMode('KEEP_POSITION')}
                label="Keep position"
                description="The new owner carries on from where the sequence is now."
              />
            </Stack>
          ) : (
            <span style={{ fontSize: '12px', opacity: '0.7' }}>
              {subject.ownerId === null
                ? 'A first owner is not a handover: the sequence carries on as it is.'
                : 'Removing the owner is not a handover: nothing else changes.'}
            </span>
          )}
          {isHandover && subject.replyOwedSince !== null ? (
            <Notice tone="warning" title="They are owed a reply.">
              {`They replied on ${formatDay(subject.replyOwedSince)} and nobody has answered yet. Tell the new owner.`}
            </Notice>
          ) : null}
          {isHandover && mode === 'KEEP_POSITION' && subject.isLinkedInPosition ? (
            <Notice tone="warning" title="The next step is on LinkedIn.">
              It belongs to the previous owner's LinkedIn account; the new owner is not connected with this person.
            </Notice>
          ) : null}
          <Inline>
            <Button
              variant="primary"
              disabled={isBusy || ownerValue === ''}
              onClick={() => submit({ ownerId, mode: isHandover ? mode : 'START_FRESH' })}
            >
              {isBusy ? 'Changing…' : 'Change owner'}
            </Button>
          </Inline>
        </>
      )}
      <SubmitError error={error} />
    </Stack>
  );
};
