export {
  templatePath,
  classifyAttempt,
  recordApiFailure,
  recordRouteTiming,
  recordMutation,
  setTelemetrySink,
  telemetryBuffer,
  resetTelemetry,
  createBeaconSink,
} from './telemetry'
export type {
  TelemetryEvent,
  ApiFailureEvent,
  RouteTimingEvent,
  MutationEvent,
  TelemetrySink,
  AttemptClass,
} from './telemetry'
