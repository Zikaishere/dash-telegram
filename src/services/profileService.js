const Conversation = require('../database/models/Conversation');
const { generateResponse } = require('./openrouter');

const UPDATE_INTERVAL = 30;

async function loadProfile(userId) {
  try {
    const convo = await Conversation.findOne({ userId });
    if (convo && convo.metadata) {
      return convo.metadata.get('profile') || null;
    }
  } catch {
    // fall through
  }
  return null;
}

async function shouldUpdate(conversation) {
  const userMsgCount = conversation.messages.filter((m) => m.role === 'user').length;
  const lastUpdate = parseInt(conversation.metadata.get('lastProfileUpdate') || '0', 10);
  return userMsgCount - lastUpdate >= UPDATE_INTERVAL;
}

async function updateProfile(userId, conversation, existingProfile) {
  const userMessages = conversation.messages.filter((m) => m.role === 'user');
  const recentUserMessages = userMessages.slice(-10);

  const prompt = existingProfile
    ? `You are a personal information extractor. The existing user profile is:\n---\n${existingProfile}\n---\n\nBased on the recent conversation below, update the profile. Extract new facts, preferences, projects, goals, personal details, and any changes the user has shared. Return ONLY the updated profile — a concise bullet-point summary in third person. Omit nothing important from the existing profile unless outdated.`
    : `You are a personal information extractor. Based on the conversation below, create a concise bullet-point profile of the user in third person. Include facts, preferences, projects, goals, personal details, and anything noteworthy they've shared. Return ONLY the profile summary.`;

  const summaryMessages = [
    { role: 'system', content: prompt },
    ...recentUserMessages.map((m) => ({ role: 'user', content: m.content })),
  ];

  try {
    const newSummary = await generateResponse(summaryMessages);

    const userMsgCount = conversation.messages.filter((m) => m.role === 'user').length;
    await Conversation.findOneAndUpdate(
      { userId },
      {
        $set: {
          'metadata.profile': newSummary,
          'metadata.lastProfileUpdate': String(userMsgCount),
        },
      },
    );

    return newSummary;
  } catch (error) {
    console.error('Error updating profile:', error);
    return existingProfile;
  }
}

module.exports = { loadProfile, shouldUpdate, updateProfile };
