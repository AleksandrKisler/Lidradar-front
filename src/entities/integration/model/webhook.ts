/** Публичный маршрут и минимальное сообщение GenericWebhookConnector. Секретов здесь нет. */
export function webhookUrl(tenantId: string, connectionId: string, apiOrigin: string): string {
  return new URL(
    `/api/v1/webhooks/GENERIC_WEBHOOK/${encodeURIComponent(tenantId)}/${encodeURIComponent(connectionId)}`,
    apiOrigin,
  ).href
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

export function webhookRequestExample(url: string, eventId: string, occurredAt: string): string {
  const payload = {
    id: eventId,
    type: 'message.received.v1',
    occurredAt,
    data: {
      conversationExternalId: `check-${eventId}`,
      messageExternalId: eventId,
      contactExternalId: `check-${eventId}`,
      contactDisplayName: 'Проверка webhook',
      direction: 'INCOMING',
      messageType: 'TEXT',
      text: 'Проверка подключения LidRadar',
      sentAt: occurredAt,
      attachments: [],
      metadata: {},
    },
  }
  return [
    `curl --include --request POST ${shellQuote(url)}`,
    "  --header 'Content-Type: application/json'",
    '  --header "X-LidRadar-Webhook-Secret: $LIDRADAR_WEBHOOK_SECRET"',
    `  --data-raw ${shellQuote(JSON.stringify(payload, null, 2))}`,
  ].join(' \\\n')
}
