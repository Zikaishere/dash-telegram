const Tool = require('./base');
const Flashcard = require('../database/models/Flashcard');

class CreateFlashcardTool extends Tool {
  constructor() {
    super('create_flashcard', 'Save a flashcard for studying. Use when the user wants to remember a fact, definition, or concept.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        question: { type: 'string', description: 'The question or prompt' },
        answer: { type: 'string', description: 'The correct answer' },
        topic: { type: 'string', description: 'Topic category (e.g. physics, history, coding)' },
      },
      required: ['userId', 'question', 'answer'],
    };
  }

  async execute({ userId, question, answer, topic }) {
    const card = new Flashcard({ userId, question, answer, topic: topic || 'general' });
    await card.save();
    return `Flashcard saved: "${question}"`;
  }
}

class QuizMeTool extends Tool {
  constructor() {
    super('quiz_me', 'Quiz the user on a topic. Picks a random flashcard, shows the question, and checks their answer.');
  }

  getParametersSchema() {
    return {
      type: 'object',
      properties: {
        userId: { type: 'string', description: "The user's Telegram ID" },
        topic: { type: 'string', description: 'Topic to quiz on (e.g. physics). Use "general" or omit to quiz on all topics.' },
      },
      required: ['userId'],
    };
  }

  async execute({ userId, topic }) {
    const query = { userId };
    if (topic && topic !== 'general') query.topic = topic;

    const count = await Flashcard.countDocuments(query);
    if (count === 0) return 'No flashcards found for this topic. Create some with `create_flashcard` first.';

    const skip = Math.floor(Math.random() * count);
    const card = await Flashcard.findOne(query).skip(skip);
    if (!card) return 'No flashcards found.';

    await Flashcard.findByIdAndUpdate(card._id, { reviewedAt: new Date() });

    return `QUIZ: ${card.question}|||ANSWER: ${card.answer}|||ID: ${card._id}`;
  }
}

module.exports = { CreateFlashcardTool, QuizMeTool };
