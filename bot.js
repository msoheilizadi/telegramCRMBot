require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { registerHandlers } = require('./handlers');

const token = process.env.TELEGRAM_BOT_TOKEN;
const port = process.env.PORT || 3000;
const webhookDomain = process.env.BOT_WEBHOOK_URL;

if (!token || !webhookDomain) {
  throw new Error("Missing TELEGRAM_TOKEN or BOT_WEBHOOK_URL");
}

const bot = new TelegramBot(token, { webHook: true });
const app = express();
app.use(express.json());

// Webhook endpoint
app.post(`/bot${token}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.setWebHook(`${webhookDomain}/bot${token}`);

// Register handlers (same logic as polling)
registerHandlers(bot);

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  bot.getMe()
    .then(me => console.log(`✅ Bot @${me.username} is connected and webhook is set!`))
    .catch(err => console.error('❌ Failed to connect to Telegram API:', err.message));
});
