const TIMEZONES = [
  'Africa/Cairo', 'Africa/Casablanca', 'Africa/Johannesburg', 'Africa/Lagos',
  'Africa/Nairobi', 'Africa/Tripoli', 'Africa/Tunis',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'America/Mexico_City', 'America/Argentina/Buenos_Aires',
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Kuwait',
  'Asia/Baghdad', 'Asia/Tehran', 'Asia/Karachi', 'Asia/Kolkata',
  'Asia/Dhaka', 'Asia/Bangkok', 'Asia/Singapore', 'Asia/Hong_Kong',
  'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Seoul',
  'Australia/Sydney', 'Australia/Melbourne', 'Australia/Perth',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'Europe/Rome', 'Europe/Amsterdam', 'Europe/Brussels', 'Europe/Vienna',
  'Europe/Stockholm', 'Europe/Oslo', 'Europe/Copenhagen', 'Europe/Helsinki',
  'Europe/Moscow', 'Europe/Istanbul', 'Europe/Athens',
  'Pacific/Auckland', 'Pacific/Honolulu',
  'UTC',
];

async function handler(bot, msg, Conversation) {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const args = msg.text.split(/\s+/).slice(1);
  const tz = args[0];

  if (!tz) {
    const convo = await Conversation.findOne({ userId });
    const current = (convo && convo.metadata && convo.metadata.get('timezone')) || 'Africa/Cairo';
    await bot.sendMessage(
      chatId,
      `Your current timezone is: ${current}\n\nTo change it, send:\n/timezone YOUR_TIMEZONE\n\nCommon timezones: Africa/Cairo, Europe/London, Asia/Dubai, America/New_York, etc.`,
    );
    return;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
  } catch {
    await bot.sendMessage(chatId, `"${tz}" is not a valid IANA timezone. Examples: Africa/Cairo, Europe/London, Asia/Dubai`);
    return;
  }

  await Conversation.findOneAndUpdate(
    { userId },
    { $set: { 'metadata.timezone': tz } },
    { upsert: true },
  );

  const now = new Date();
  const localTime = now.toLocaleString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });

  await bot.sendMessage(chatId, `Timezone set to ${tz}. Current local time: ${localTime}`);
}

module.exports = { handler, command: 'timezone' };
