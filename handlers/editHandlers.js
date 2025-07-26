// editHandlers.js
const { loadData, saveData, getTodayDate } = require("../data");
const { userStates } = require("../menu");
const crypto = require('crypto');

// Removes unsafe characters and limits length
function sanitizeText(text) {
  return text
    .replace(/[^\p{L}\p{N}\s.,!?()،:؛\-]/gu, "") // remove anything unsafe
    .substring(0, 30); // keep the text short for button display
}


async function handleEditReport(bot, chatId, userId, queryId) {
  const allData = loadData();
  const customers = Object.keys(allData);

  if (customers.length === 0) {
    return bot.sendMessage(chatId, "❌ No customers found.");
  }

  const buttons = customers.map((name) => {
    return [{ text: name, callback_data: `edit_select_customer:${name}` }];
  });

  buttons.push([{ text: "🔙 برگشت به منوی اصلی", callback_data: "back_to_menu" }]);

  const message = await bot.sendMessage(
    chatId,
    "یک شخص را برای ادیت کردن :",
    {
      reply_markup: { inline_keyboard: buttons },
    }
  );

  userStates[userId] = { lastBotMessageId: message.message_id };
  await bot.answerCallbackQuery(queryId.id || queryId);
}

async function handleEditSelectCustomer(bot, chatId, queryId, customer) {
  const allData = loadData();
  const reports = allData[customer];

  if (!reports || reports.length === 0) {
    return bot.sendMessage(chatId, `❌ No reports found for ${customer}.`);
  }

  const buttons = reports.map((rep, i) => [
    {
      text: `${rep.date}: ${sanitizeText(rep.report)}`,
      callback_data: `edit_report_text:${customer}:${i}`,
    },
  ]);

  buttons.push([{ text: "🔙 برگشت به صفحه اصلی", callback_data: "back_to_menu" }]);

  const message = await bot.sendMessage(
    chatId,
    `یک گزارش را برای ویرایش انتخاب کنید *${customer}*:`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
    }
  );

  const userId = queryId.from.id || queryId.from;
  userStates[userId] = { lastBotMessageId: message.message_id };
  await bot.answerCallbackQuery(queryId.id || queryId);
}

async function handleEditReportText(bot, chatId, queryId, customer, indexStr) {
  const index = parseInt(indexStr);

  const userId = queryId.from.id || queryId.from;
  userStates[userId] = {
    step: "waiting_edit_report_text",
    customerName: customer,
    reportIndex: index,
  };

  await bot.sendMessage(
    chatId,
    `✏️ متن جدید مربوط به تاریخ *${getTodayDate()}* برای شخص *${customer}* را بنویسید:`,
    { parse_mode: "Markdown" }
  );
  await bot.answerCallbackQuery(queryId.id || queryId);
}

module.exports = {
  handleEditReport,
  handleEditSelectCustomer,
  handleEditReportText,
};
