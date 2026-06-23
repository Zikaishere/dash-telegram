async function handler(bot, msg) {
  const chatId = msg.chat.id;

  await bot.sendMessage(
    chatId,
    `Dash - Personal AI Assistant

I'm powered by OpenRouter AI and keep our conversation history.

Commands:
/start - Welcome message
/help - Show this help
/reset - Clear conversation & reset tone
/timezone TZ - Set your timezone
/set_name Name - Set how I address you
/set_tone Tone - Change my response style
/study - Toggle study mode on/off
/timetable [week|today|month] - Generate visual PDF schedule
/wipe - Delete all your data permanently
/diagnostics - Health report & error log (admin only)

Things I can do:
- Answer questions and have conversations
- Set reminders at specific times (e.g. "remind me at 5pm")
- Set timers (e.g. "set a timer for 10 minutes")
- Check weather for any city
- Search the web for current info
- Read uploaded files (.txt, .pdf, .docx)
- Remember things about you permanently
- Manage your calendar & events
- Track tasks with priority and due dates
- Create flashcards and quiz you (turn on with /study)
- Start Pomodoro study sessions
- Generate PDF timetable of your schedule
- Track nutrition: log meals, calories, protein, carbs, and fat
- Get a nutrition report summary for any date range

Tips:
- Timezone defaults to Africa/Cairo — change with /timezone
- Available tones: casual, professional, concise, detailed
- I remember our past messages for context
- /reset keeps your profile, /wipe removes everything`,
  );
}

module.exports = { handler, command: 'help' };
