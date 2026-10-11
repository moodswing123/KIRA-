async function processMessageUpsertBatch(update, handler, onError) {
  if (typeof handler !== 'function') throw new TypeError('A message handler is required');
  const messages = Array.isArray(update?.messages) ? update.messages : [];
  for (const message of messages) {
    if (!message?.message) continue;
    try {
      await handler(message);
    } catch (error) {
      if (typeof onError === 'function') await onError(error, message);
      else throw error;
    }
  }
}

module.exports = { processMessageUpsertBatch };
