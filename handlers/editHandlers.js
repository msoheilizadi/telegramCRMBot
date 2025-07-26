const { loadData, saveData, getTodayDate } = require("../data");
const { userStates } = require("../menu");

// Removes unsafe characters and limits length for button text display
function sanitizeText(text) {
  return text
    .replace(/[^\p{L}\p{N}\s.,!?()،:؛\-]/gu, "") // remove unsafe chars but keep Persian and punctuation
    .substring(0, 30); // limit length
}

async function handleEditReport(bot, chatId, userId, queryId) {
  const allData = loadData();
  const customers = Object.keys(allData);

  if (customers.length === 0) {
    return bot.sendMessage(chatId, "❌ No customers found.");
  }

  // Use index as callback_data for safety
  const buttons = customers.map((name, idx) => [
    {
      text: name,
      callback_data: `edit_select_customer:${idx}`, // index instead of name
    },
  ]);

  buttons.push([{ text: "🔙 برگشت به منوی اصلی", callback_data: "back_to_menu" }]);

  const message = await bot.sendMessage(chatId, "یک شخص را برای ادیت کردن :", {
    reply_markup: { inline_keyboard: buttons },
  });

  userStates[userId] = { lastBotMessageId: message.message_id };
  await bot.answerCallbackQuery(queryId.id || queryId);
}

async function handleEditSelectCustomer(bot, chatId, query, customerIndexStr) {
  const allData = loadData();
  const customers = Object.keys(allData);
  const index = parseInt(customerIndexStr, 10);

  if (isNaN(index) || !customers[index]) {
    return bot.sendMessage(chatId, "❌ مشتری نامعتبر انتخاب شد.");
  }

  const customer = customers[index];
  const reports = allData[customer];

  if (!reports || reports.length === 0) {
    return bot.sendMessage(chatId, `❌ گزارشی برای ${customer} یافت نشد.`);
  }

  const buttons = reports.map((rep, i) => [
    {
      text: `${rep.date}: ${sanitizeText(rep.report)}`,
      // Here we keep customer as index, and report index as i
      callback_data: `edit_report_text:${index}:${i}`,
    },
  ]);

  buttons.push([{ text: "🔙 برگشت به صفحه اصلی", callback_data: "back_to_menu" }]);

  const message = await bot.sendMessage(
    chatId,
    `یک گزارش را برای ویرایش انتخاب کنید *${customer}* :`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
    }
  );

  const userId = query.from.id || query.from;
  userStates[userId] = { lastBotMessageId: message.message_id };
  await bot.answerCallbackQuery(query.id || query);
}

async function handleEditReportText(bot, chatId, query, customerIndexStr, indexStr) {
  const allData = loadData();
  const customers = Object.keys(allData);

  const customerIndex = parseInt(customerIndexStr, 10);
  const reportIndex = parseInt(indexStr, 10);

  if (
    isNaN(customerIndex) ||
    !customers[customerIndex] ||
    isNaN(reportIndex)
  ) {
    return bot.sendMessage(chatId, "❌ داده‌های نامعتبر دریافت شد.");
  }

  const customer = customers[customerIndex];

  const userId = query.from.id || query.from;
  userStates[userId] = {
    step: "waiting_edit_report_text",
    customerIndex,
    reportIndex,
    customerName: customer, // Store name too for convenience
  };

  await bot.sendMessage(
    chatId,
    `✏️ متن جدید مربوط به تاریخ *${getTodayDate()}* برای شخص *${customer}* را بنویسید:`,
    { parse_mode: "Markdown" }
  );
  await bot.answerCallbackQuery(query.id || query);
}

module.exports = {
  handleEditReport,
  handleEditSelectCustomer,
  handleEditReportText,
};
