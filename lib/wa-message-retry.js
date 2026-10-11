/**
 * Baileys needs the original proto.IMessage to re-encrypt messages after a
 * recipient reports that it could not decrypt the first delivery.
 */
async function getMessageForRetry(key, loadMessage) {
  if (!key?.id || !key?.remoteJid || typeof loadMessage !== 'function') return undefined;
  const stored = await loadMessage(key.id, key.remoteJid);
  const message = stored?.message?.message ?? stored?.message;
  return message && typeof message === 'object' ? message : undefined;
}

module.exports = { getMessageForRetry };
