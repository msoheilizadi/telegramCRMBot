// deleteHandlers.js

const { loadData, saveData } = require("../data");
const { sendMainMenu, userStates } = require("../menu");

async function handleDeleteReport(bot, chatId, userId, queryId) {
  const allData = loadData();
  const customers = Object.keys(allData);

  if (customers.length === 0) {
    return bot.sendMessage(chatId, "❌ No customers found.");
  }

  const buttons = customers.map((name) => [
    { text: name, callback_data: `delete_select_customer:${name}` },
  ]);
  buttons.push([{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]);

  const message = await bot.sendMessage(
    chatId,
    "Select a customer to delete their reports:",
    {
      reply_markup: { inline_keyboard: buttons },
    }
  );

  userStates[userId] = { lastBotMessageId: message.message_id };
  await bot.answerCallbackQuery(queryId.id || queryId);
}

async function handleDeleteSelectCustomer(bot, chatId, queryId, customer) {
  const allData = loadData();
  const reports = allData[customer];

  if (!reports || reports.length === 0) {
    return bot.sendMessage(chatId, `❌ No reports found for ${customer}.`);
  }

  const buttons = reports.map((rep, i) => [
    {
      text: `${rep.date}: ${rep.report.substring(0, 20)}${
        rep.report.length > 20 ? "..." : ""
      }`,
      callback_data: `delete_confirm:${customer}:${i}`,
    },
  ]);
  buttons.push([{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]);

  const message = await bot.sendMessage(
    chatId,
    `Select a report to delete for *${customer}*:`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
    }
  );

  const userId = queryId.from.id || queryId.from;
  userStates[userId] = { lastBotMessageId: message.message_id };
  await bot.answerCallbackQuery(queryId.id || queryId);
}

async function handleDeleteConfirm(bot, chatId, queryId, customer, reportIndexStr) {
  const reportIndex = parseInt(reportIndexStr);
  const allData = loadData();
  const reports = allData[customer];

  if (!reports || !reports[reportIndex]) {
    return bot.sendMessage(chatId, `❌ Report not found for ${customer}.`);
  }

  const deleted = reports.splice(reportIndex, 1);
  if (reports.length === 0) {
    delete allData[customer];
  }
  saveData(allData);

  await bot.sendMessage(
    chatId,
    `✅ Deleted report for *${customer}*:\n\n${deleted[0].report}`,
    { parse_mode: "Markdown" }
  );

  // Send main menu
  await sendMainMenu(bot, chatId, queryId.from.id || queryId.from);
  await bot.answerCallbackQuery(queryId.id || queryId);
}

module.exports = {
  handleDeleteReport,
  handleDeleteSelectCustomer,
  handleDeleteConfirm,
};
