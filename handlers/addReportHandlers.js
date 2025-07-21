// addReportHandlers.js
const { userStates } = require("../menu");

async function handleAddReport(bot, chatId, userId, queryId) {
  const allData = loadData();
  const customers = Object.keys(allData);

  const buttons = customers.map((name) => [
    { text: name, callback_data: `add_report_existing_customer:${name}` },
  ]);
  buttons.push([
    {
      text: "➕ Add New Customer",
      callback_data: "add_report_new_customer",
    },
  ]);
  buttons.push([{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]);

  const message = await bot.sendMessage(
    chatId,
    "🧾 Select a customer or add a new one:",
    { reply_markup: { inline_keyboard: buttons } }
  );

  userStates[userId] = { lastBotMessageId: message.message_id };
  await bot.answerCallbackQuery(queryId.id || queryId);
}

async function handleAddReportExistingCustomer(bot, chatId, queryId, customerName) {
  userStates[queryId.from.id] = { step: "waiting_report_text", customerName };

  await bot.sendMessage(chatId, `✏️ Write the report for *${customerName}*:`, {
    parse_mode: "Markdown",
  });
  await bot.answerCallbackQuery(queryId.id || queryId);
}

async function handleAddReportNewCustomer(bot, chatId, queryId) {
  userStates[queryId.from.id] = { step: "waiting_new_customer_name" };
  await bot.sendMessage(chatId, "🧾 Please enter the *new customer name*:", {
    parse_mode: "Markdown",
  });
  await bot.answerCallbackQuery(queryId.id || queryId);
}

module.exports = {
  handleAddReport,
  handleAddReportExistingCustomer,
  handleAddReportNewCustomer,
};
