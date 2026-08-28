/**
 * The payload of a shared-contact message. Pure.
 *
 * A contact card is carried in the message body rather than in `attachments`: there
 * is no file, and a row in a table built around storage paths and byte sizes would
 * be five null columns and a lie.
 */

export type ContactCard = {
  name: string;
  phone: string;
  /** Set when the shared contact is themselves a Wave user, so "Message" can route. */
  userId?: string;
};

export function encodeContactCard(card: ContactCard): string {
  return JSON.stringify(card);
}

/**
 * Returns null for anything that is not a card. The body of a `contact` message is
 * whatever the sender's client wrote — an older version, a different client, or a
 * corrupted row — so the bubble has to survive being handed nonsense.
 */
export function decodeContactCard(body: string | null): ContactCard | null {
  if (!body) return null;

  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const card = parsed as Record<string, unknown>;
    if (typeof card.name !== 'string' || typeof card.phone !== 'string') return null;
    if (card.name.trim().length === 0) return null;

    return {
      name: card.name,
      phone: card.phone,
      userId: typeof card.userId === 'string' ? card.userId : undefined,
    };
  } catch {
    return null;
  }
}

/** The one-line preview a shared contact shows in the chat list. */
export function contactCardPreview(body: string | null): string {
  return decodeContactCard(body)?.name ?? 'Contact';
}
