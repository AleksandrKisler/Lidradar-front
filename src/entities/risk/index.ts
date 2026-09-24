export type {
  RiskDetail,
  Risk,
  RiskSeverity,
  RiskType,
  RiskStatus,
  RadarSummary,
  RiskFilters,
  Recommendation,
  Action,
  ActionType,
  Outcome,
  OutcomeStatus,
  OpportunityStage,
  OpportunityStageSource,
  Opportunity,
  OpportunityDetail,
  OpportunityStageHistory,
  RiskFeedback,
  RiskFeedbackRequest,
  RiskVerdict,
  RiskFeedbackReason,
} from './model/types'
export {
  RISK_SEVERITIES,
  RISK_TYPES,
  ACTIVE_RISK_STATUSES,
  MANUAL_ACTION_TYPES,
  OUTCOME_STATUSES,
  RISK_VERDICTS,
  FEEDBACK_REASONS,
  isActiveRiskStatus,
} from './model/types'
export {
  severityLabel,
  severityTone,
  riskTypeLabel,
  riskStatusLabel,
  riskStatusTone,
  riskSourceLabel,
  actionTypeLabel,
  outcomeStatusLabel,
  opportunityStageLabel,
  externalLinkUnavailableLabel,
  verdictLabel,
  feedbackReasonLabel,
} from './model/labels'
export type { Tone } from './model/labels'
export { toRiskCard, toRiskWorkspace, UNNAMED_CONTACT } from './model/adapters'
export type { RiskCardViewModel, RiskWorkspaceViewModel, RiskHistoryEntry } from './model/adapters'
export {
  riskKeys,
  fetchRadarSummary,
  fetchActiveRisks,
  fetchRiskDetail,
  useRadarSummaryQuery,
  useActiveRisksQuery,
  useRiskDetailQuery,
  RISK_PAGE_SIZE,
} from './api/radar-api'
export type { RiskPage } from './api/radar-api'
export {
  acknowledgeRisk,
  resolveRisk,
  ensureRecommendation,
  createAction,
  createOutcome,
  recordRiskFeedback,
} from './api/commands'
export type { ActionDraft, OutcomeDraft, RecordedAction, RecordedOutcome } from './api/commands'
export { invalidateRisk } from './api/invalidate'
export type { InvalidateRiskOptions } from './api/invalidate'
export { default as RiskSeverityBadge } from './ui/RiskSeverityBadge.vue'
export {
  ACTIVE_STAGE_ORDER,
  TERMINAL_STAGES,
  isActiveStage,
  allowedNextStages,
  isClosingStage,
  stageSourceLabel,
  describeClosingStage,
} from './model/stages'
export {
  opportunityKeys,
  fetchOpportunityDetail,
  changeOpportunityStage,
  useOpportunityDetailQuery,
} from './api/opportunity-api'
