import { isOurContact, isReply } from './touches';
import type {
  CadenceConfig,
  CadenceStage,
  CadenceStageChange,
  CadenceTouchTemplate,
} from './types';

// The only two automatic stage moves, applied when a touch is logged. They test
// different starting stages, so at most one fires. Inbound on Not contacted
// moves nothing, and an acceptance is not a reply.
export const stageAfterTouch = (
  stage: CadenceStage,
  touch: CadenceTouchTemplate,
  config: CadenceConfig,
): CadenceStageChange => {
  if (stage === 'contactedNoReply' && isReply(touch, config)) {
    return { stage: 'repliedInConversation', change: 'advanced' };
  }

  if (stage === 'notContacted' && isOurContact(touch, config)) {
    return { stage: 'contactedNoReply', change: 'started' };
  }

  return { stage, change: null };
};
