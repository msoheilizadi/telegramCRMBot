const TelegramBot = require('node-telegram-bot-api');
const { TOKEN } = require('./config');
const { registerHandlers } = require('./handlers');

const bot = new TelegramBot(TOKEN, { polling: true });

bot.getMe().then((me) => {
    console.log(`🤖 Bot ${me.username} is connected and polling...`);
}).catch((err) => {
    console.error('❌ Failed to connect to Telegram API:', err.message);
});

bot.on('polling_error', (err) => {
    console.error('🚨 Polling error:', err.message);
});

// Register all handlers
registerHandlers(bot);
