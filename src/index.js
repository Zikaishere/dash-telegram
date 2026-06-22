const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDatabase, disconnectDatabase } = require('./database');
const { startBot } = require('./bot');
const { startScheduler, stopScheduler } = require('./services/scheduler');
const config = require('./config');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function main() {
  try {
    await connectDatabase(config.mongodbUri);

    await startBot();

    startScheduler();

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
    });
  } catch (error) {
    console.error('Failed to start application:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  stopScheduler();
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  stopScheduler();
  await disconnectDatabase();
  process.exit(0);
});

main();
