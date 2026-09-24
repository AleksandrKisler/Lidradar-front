/**
 * Подключение телеметрии: приёмник по адресу из конфигурации, а в режиме
 * разработки — консоль. Записи безопасны по построению (см. `shared/observability`).
 */
import { createBeaconSink, setTelemetrySink, type TelemetryEvent } from '@/shared/observability'

export interface TelemetryOptions {
  endpoint: string
  development: boolean
  log?: (event: TelemetryEvent) => void
}

export function installTelemetry({ endpoint, development, log }: TelemetryOptions): void {
  if (endpoint) {
    setTelemetrySink(createBeaconSink(endpoint))
    return
  }
  if (development) {
    setTelemetrySink(log ?? ((event) => console.debug('[telemetry]', event)))
    return
  }
  setTelemetrySink(null)
}
