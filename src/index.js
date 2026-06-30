const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const { execSync } = require('child_process');
const { connectDatabase, disconnectDatabase } = require('./database');
const { startBot } = require('./bot');
const { startScheduler, stopScheduler } = require('./services/scheduler');
const { startNewsScheduler, stopNewsScheduler } = require('./services/newsService');
const config = require('./config');

if (process.env.AUTO_UPDATE === '1') {
  try {
    console.log('Pulling latest from GitHub...');

    if (!fs.existsSync('.git')) {
      console.log('Initializing git repository...');
      execSync('git init && git remote add origin https://github.com/Zikaishere/dash-telegram', { stdio: 'inherit' });
    }

    execSync('git fetch origin main && git reset --hard origin/main', { stdio: 'inherit' });
    console.log('Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
  } catch (error) {
    console.error('Auto-update failed:', error.message);
  }
}

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', require('./api'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function main() {
  try {
    await connectDatabase(config.mongodbUri);

    const bot = await startBot();

    startScheduler();
    startNewsScheduler(bot);

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
  stopNewsScheduler();
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  stopScheduler();
  stopNewsScheduler();
  await disconnectDatabase();
  process.exit(0);
});

main();
