import { cadenceActions } from './actions';
import { toCadenceDate } from './business-days';
import { positionLabel, stepLabel } from './labels';
import { computePosition } from './position';
import { prescribedTouch } from './prescribed';
import { proposeNextAction, resolveNextActionDate } from './schedule';
import { computeOutreachStatus } from './stops';
import { isConnectionPending, touchesUnderCurrentOwner } from './touches';
import type {
  CadenceConfig,
  CadenceContact,
  CadenceDateInput,
  CadenceResult,
  CadenceTouch,
  OutreachStatus,
} from './types';
import { assertValidCadenceConfig } from './validate-cadence-config';

type ComputeCadenceInput = {
  contact: CadenceContact;
  touches: readonly CadenceTouch[];
  config: CadenceConfig;
  today: CadenceDateInput;
};

const strikesFor = (status: OutreachStatus, config: CadenceConfig): number => {
  if (status.state === 'inConversation') {
    return status.strikes;
  }

  return status.state === 'awaitingResume' ? config.strikeLimit : 0;
};

// Everything a row needs, from the contact, its touches and the day alone. Who
// logged a touch is not an input, and deleting one is undone by recomputing.
export const computeCadence = ({
  contact,
  touches,
  config,
  today,
}: ComputeCadenceInput): CadenceResult => {
  assertValidCadenceConfig(config);

  const todayDate = toCadenceDate(today, config.timeZone);
  const status = computeOutreachStatus(contact, touches, todayDate, config);
  const position = computePosition(contact, touches, todayDate, config);
  const proposedNextActionDate = proposeNextAction(
    contact,
    touches,
    todayDate,
    config,
  );
  const nextActionDate = resolveNextActionDate(
    contact,
    proposedNextActionDate,
    config,
  );

  return {
    status,
    position,
    stepLabel: stepLabel(status, config),
    positionLabel: positionLabel(position, config),
    proposedNextActionDate,
    nextActionDate,
    isDue: nextActionDate !== null && nextActionDate <= todayDate,
    strikes: strikesFor(status, config),
    prescribedTouch: prescribedTouch(position, config),
    actions: cadenceActions({
      status,
      result: position,
      contact,
      config,
      connectionPending: isConnectionPending(touchesUnderCurrentOwner(contact, touches, config), config),
    }),
  };
};
