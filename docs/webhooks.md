# Outgoing webhooks

Configure an HTTPS endpoint in **Admin → API keys → Connect your application**.
Events are scoped to messages sent using API keys owned by that admin workspace;
regular user-to-user chat messages are not forwarded.

Supported events:

- `message.created` — a message was created by the single-message or bulk API.
- `message.status_changed` — an API-created message moved to `delivered` or
  `seen`.

Each event is sent as a JSON `POST`:

```json
{
  "id": "unique-delivery-id",
  "event": "message.created",
  "createdAt": "2026-11-12T10:00:00.000Z",
  "data": {
    "message": {
      "id": "message-id",
      "from": "sender-account-id",
      "to": "recipient-account-id",
      "type": "text",
      "text": "Message text",
      "status": "sent",
      "timestamp": "2026-11-12T10:00:00.000Z"
    }
  }
}
```

For `message.status_changed`, `data` contains `messageId`, `from`, `to`,
`status`, and `updatedAt`.

The `X-Hansaria-Event` header contains the event name. `X-Hansaria-Signature`
contains `sha256=<hex>`, an HMAC-SHA256 of the exact raw request body using the
webhook signing secret. Compare signatures using a constant-time comparison.
The signing secret is shown only when first created or rotated; store it
securely. The endpoint must use HTTPS on port 443 and resolve only to public
IPv4 addresses.

Delivery is attempted synchronously with a five-second timeout. Non-2xx
responses, endpoint errors, and timeouts are logged by the application; failed
deliveries are not persisted or retried.
