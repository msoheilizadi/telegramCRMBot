// addReportHandlers.js
const { userStates } = require("../menu");
const { loadData } = require("../data");
const crypto = require("crypto");

async function handleAddReport(bot, chatId, userId, queryId) {
  const allData = loadData();
  const customers = Object.keys(allData);

  const buttons = customers.map((name) => {
    const hash = crypto
      .createHash("md5")
      .update(name)
      .digest("hex")
      .slice(0, 10);
    return [
      { text: name, callback_data: `add_report_existing_customer:${hash}` },
    ];
  });

  buttons.push([
    {
      text: "➕ اضافه کردن مشتری جدید",
      callback_data: "add_report_new_customer",
    },
  ]);
  buttons.push([
    { text: "🔙 برکشتن به منو اصلی", callback_data: "back_to_menu" },
  ]);

  const message = await bot.sendMessage(
    chatId,
    "🧾 یک مشتری را انتخاب کن یا شخص جدیدی را اضافه کن",
    { reply_markup: { inline_keyboard: buttons } }
  );

  userStates[userId] = { lastBotMessageId: message.message_id };
  await bot.answerCallbackQuery(queryId.id || queryId);
}

async function handleAddReportExistingCustomer(bot, chatId, queryId, hash) {
  // Load all customers
  const allData = loadData();
  const customers = Object.keys(allData);

  // Find the real customer name by matching the hash
  const customerName = customers.find(name => {
    const nameHash = crypto.createHash("md5").update(name).digest("hex").slice(0, 10);
    return nameHash === hash;
  });

  if (!customerName) {
    await bot.sendMessage(chatId, "❌ مشتری یافت نشد. لطفا دوباره تلاش کنید.");
    return bot.answerCallbackQuery(queryId.id || queryId);
  }

  // Now store correct customerName in user state
  userStates[queryId.from.id] = { step: "waiting_report_text", customerName };

  await bot.sendMessage(chatId, `✏️ گزارش مربوط را بنویس *${customerName}*:`);

  await bot.answerCallbackQuery(queryId.id || queryId);
}

async function handleAddReportNewCustomer(bot, chatId, queryId) {
  // First, set the step — no customer name yet!
  userStates[queryId.from.id] = {
    step: "waiting_new_customer_name"
  };

  const message = await bot.sendMessage(chatId, "🧾 لطفا نام *مشتری جدید* را بنویس", {
    parse_mode: "Markdown",
  });

  userStates[queryId.from.id].lastBotMessageId = message.message_id;

  await bot.answerCallbackQuery(queryId.id || queryId);
}

module.exports = {
  handleAddReport,
  handleAddReportExistingCustomer,
  handleAddReportNewCustomer,
};
