const { cmd } = require('../command');

function resolveTarget(message, query) {
  const mentioned = Array.isArray(message.mentionedJid) ? message.mentionedJid[0] : null;
  if (mentioned) return mentioned;
  if (message.quoted && message.quoted.sender) return message.quoted.sender;

  const value = String(query || '').trim();
  if (/^\d{5,20}$/.test(value)) return `${value}@s.whatsapp.net`;
  if (/^\d{5,20}@(s\.whatsapp\.net|lid)$/.test(value)) return value;
  return null;
}

for (const [pattern, action, emoji] of [['block', 'block', '🚫'], ['unblock', 'unblock', '🔓']]) {
  cmd({
    pattern,
    desc: `${action === 'block' ? 'Blocks' : 'Unblocks'} a person`,
    category: 'owner',
    react: emoji,
    filename: __filename
  }, async (conn, mek, m, { from, reply, q, react, isOwner }) => {
    if (!isOwner) {
      await react('❌').catch(() => {});
      return reply('Only the bot owner can use this command.');
    }

    const jid = resolveTarget(m, q);
    if (!jid) {
      await react('❌').catch(() => {});
      return reply(`Reply to a message, mention a user, or provide their phone number.\nExample: .${pattern} 12345678901`);
    }

    try {
      await conn.updateBlockStatus(jid, action);
      await react('✅').catch(() => {});
      return reply(`Successfully ${action === 'block' ? 'blocked' : 'unblocked'} the selected contact.`);
    } catch (error) {
      console.error(`${action} command error:`, error.message);
      await react('❌').catch(() => {});
      return reply(`Failed to ${action} the contact. Please check the target and try again.`);
    }
  });
}
