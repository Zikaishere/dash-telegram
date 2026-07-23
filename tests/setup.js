// Test setup and utilities
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

// Global test setup
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}, 60000);

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongod.stop();
}, 60000);

// Clear all collections before each test
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}, 10000);

// Test utilities
global.testUtils = {
  createUserId: () => `test_user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  
  mockMessage: (userId, text, overrides = {}) => ({
    message_id: Math.floor(Math.random() * 100000),
    date: Math.floor(Date.now() / 1000),
    chat: { id: userId, type: 'private' },
    from: { id: userId, first_name: 'Test', username: 'testuser' },
    text,
    ...overrides,
  }),

  mockPhotoMessage: (userId, caption, fileId = 'test_file_id') => ({
    message_id: Math.floor(Math.random() * 100000),
    date: Math.floor(Date.now() / 1000),
    chat: { id: userId, type: 'private' },
    from: { id: userId, first_name: 'Test', username: 'testuser' },
    caption,
    photo: [
      { file_id: fileId, width: 100, height: 100, file_size: 1000 },
    ],
  }),

  mockVoiceMessage: (userId, fileId = 'test_voice_id') => ({
    message_id: Math.floor(Math.random() * 100000),
    date: Math.floor(Date.now() / 1000),
    chat: { id: userId, type: 'private' },
    from: { id: userId, first_name: 'Test', username: 'testuser' },
    voice: { file_id: fileId, duration: 30, mime_type: 'audio/ogg' },
  }),
};

// Mock Telegram Bot
global.mockBot = {
  sendMessage: jest.fn().mockResolvedValue({ message_id: 1 }),
  sendDocument: jest.fn().mockResolvedValue({ message_id: 1 }),
  sendChatAction: jest.fn().mockResolvedValue(true),
  getFile: jest.fn().mockResolvedValue({ file_path: 'test/path' }),
  stopPolling: jest.fn().mockResolvedValue(true),
  startPolling: jest.fn().mockResolvedValue(true),
};

// Mock OpenAI client
global.mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{
          message: { content: 'Test response' },
          finish_reason: 'stop',
        }],
      }),
    },
  },
};