const { loadData, saveData, getTodayDate } = require("../data");
const { sendMainMenu, userStates } = require("../menu");
const { isAuthorized } = require("../auth");
const {
  handleDeleteReport,
  handleDeleteSelectCustomer,
  handleDeleteConfirm,
} = require("./deleteHandlers");
const {
  handleEditReport,
  handleEditSelectCustomer,
  handleEditReportText,
} = require("./editHandlers");
const {
  handleAddReport,
  handleAddReportExistingCustomer,
  handleAddReportNewCustomer,
} = require("./addReportHandlers");
const { appendReportToSheet } = require("../services/index");

async function deletePreviousMessage(bot, chatId, userId) {
  const userState = userStates[userId] || {};
  const prevMsgId = userState.lastBotMessageId;

  if (prevMsgId) {
    try {
      await bot.deleteMessage(chatId, prevMsgId);
    } catch (err) {
      console.warn("⚠️ Could not delete previous message:", err.message);
    }
  }
}

async function handleBackToMenu(bot, chatId, userId, queryId) {
  await sendMainMenu(bot, chatId, userId);
  await bot.answerCallbackQuery(queryId.id || queryId);
}

async function handleViewHistory(bot, chatId, userId, queryId) {
  const allData = loadData();
  const customers = Object.keys(allData);

  if (customers.length === 0) {
    return bot.sendMessage(chatId, "❌ No customers found.");
  }

  // Use index as callback_data suffix to keep it short and valid
  const buttons = customers.map((name, idx) => [
    {
      text: name,
      callback_data: `history:${idx}`, // Use index instead of full name or encoded name
    },
  ]);
  buttons.push([{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]);

  try {
    const message = await bot.sendMessage(
      chatId,
      "📚 Select a customer to view their history:",
      { reply_markup: { inline_keyboard: buttons } }
    );

    userStates[userId] = {
      ...userStates[userId],
      lastBotMessageId: message.message_id,
    };
    await bot.answerCallbackQuery(queryId.id || queryId);
  } catch (err) {
    console.error("Failed to send history menu:", err);
  }
}

async function handleHistory(bot, chatId, queryId, customerIndexStr) {
  const allData = loadData();
  const customers = Object.keys(allData);

  const index = parseInt(customerIndexStr, 10);
  if (isNaN(index) || !customers[index]) {
    return bot.sendMessage(chatId, "❌ Invalid customer selected.");
  }

  const customerName = customers[index];
  const history = allData[customerName];

  if (!history || history.length === 0) {
    return bot.sendMessage(chatId, `❌ No reports found for ${customerName}.`);
  }

  // Build response with length check
  const maxLength = 4000;
  let response = `📄 Report history for ${customerName}:\n\n`;

  for (const entry of history) {
    const entryText = `🗓️ ${entry.date}:\n${entry.report}\n\n`;
    if ((response + entryText).length > maxLength) {
      await bot.sendMessage(chatId, response);
      response = entryText; // reset response for next batch
    } else {
      response += entryText;
    }
  }

  if (response.length > 0) {
    await bot.sendMessage(chatId, response);
  }

  await bot.sendMessage(chatId, "🔽", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }],
      ],
    },
  });

  await bot.answerCallbackQuery(queryId.id || queryId);
}

async function handleCallbackQuery(bot, query) {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const user = userStates[userId];
  const callbackData = query.data;

  if (!isAuthorized(userId)) {
    return bot.answerCallbackQuery(query.id, {
      text: "⛔️ Access denied.",
      show_alert: true,
    });
  }

  await deletePreviousMessage(bot, chatId, userId);

  if (callbackData === "confirm_meeting_yes") {
    user.step = "waiting_meeting_date";
    bot.answerCallbackQuery(query.id);
    return bot.sendMessage(
      chatId,
      "📅 لطفا تاریخ جلسه را وارد کن (مثلاً 1404-08-22):"
    );
  }

  if (callbackData === "confirm_meeting_no") {
    bot.answerCallbackQuery(query.id);

    try {
      await appendReportToSheet({
        customer: user.customerName,
        date: user.reportDate,
        report: user.reportText,
      });
    } catch (err) {
      console.error("❌ Failed to save to Google Sheets:", err.message);
    }

    delete userStates[userId];
    await sendMainMenu(bot, chatId, userId);
    return bot.sendMessage(chatId, `✅ گزارش بدون جلسه ذخیره شد.`);
  }

  if (callbackData === "confirm_send_file_yes") {
    bot.answerCallbackQuery(query.id);

    const tomorrow = moment().add(1, "day").format("jYYYY-jMM-jDD");

    try {
      await appendReportToSheet({
        customer: user.customerName,
        date: user.reportDate,
        report: user.reportText,
        remindType: "task",
        remindDate: tomorrow,
      });
    } catch (err) {
      console.error("❌ Failed to save to Google Sheets:", err.message);
    }

    delete userStates[userId];
    await sendMainMenu(bot, chatId, userId);

    return bot.sendMessage(
      chatId,
      `✅ گزارش ذخیره شد و یادآور ارسال فایل برای ${tomorrow} تنظیم شد (موقت، بدون ذخیره).`
    );
  }

  if (callbackData === "confirm_send_file_no") {
    bot.answerCallbackQuery(query.id);

    try {
      await appendReportToSheet({
        customer: user.customerName,
        date: user.reportDate,
        report: user.reportText,
      });
    } catch (err) {
      console.error("❌ Failed to save to Google Sheets:", err.message);
    }

    delete userStates[userId];
    await sendMainMenu(bot, chatId, userId);

    return bot.sendMessage(chatId, `✅ گزارش بدون یادآور ارسال فایل ذخیره شد.`);
  }

  if (callbackData === "back_to_menu") {
    return handleBackToMenu(bot, chatId, userId, query.id);
  }

  if (callbackData === "view_history") {
    return handleViewHistory(bot, chatId, userId, query.id);
  }

  if (callbackData.startsWith("history:")) {
    const customerName = callbackData.split(":")[1];
    return handleHistory(bot, chatId, query.id, customerName);
  }

  if (callbackData === "add_report") {
    return handleAddReport(bot, chatId, userId, query.id);
  }

  if (callbackData.startsWith("add_report_existing_customer:")) {
    const customerName = callbackData.split(":")[1];
    return handleAddReportExistingCustomer(bot, chatId, query, customerName);
  }

  if (callbackData === "add_report_new_customer") {
    return handleAddReportNewCustomer(bot, chatId, query);
  }

  // Edit report handlers
  if (callbackData === "edit_report") {
    return handleEditReport(bot, chatId, userId, query.id);
  }

  if (callbackData.startsWith("edit_select_customer:")) {
    const customer = callbackData.split(":")[1];
    return handleEditSelectCustomer(bot, chatId, query, customer);
  }

  if (callbackData.startsWith("edit_report_text:")) {
    const [, customer, indexStr] = callbackData.split(":");
    return handleEditReportText(bot, chatId, query, customer, indexStr);
  }

  // Delete report handlers
  if (callbackData === "delete_report") {
    return handleDeleteReport(bot, chatId, userId, query.id);
  }

  if (callbackData.startsWith("delete_select_customer:")) {
    const customer = callbackData.split(":")[1];
    return handleDeleteSelectCustomer(bot, chatId, query, customer);
  }

  if (callbackData.startsWith("delete_confirm:")) {
    const [, customer, reportIndexStr] = callbackData.split(":");
    return handleDeleteConfirm(bot, chatId, query, customer, reportIndexStr);
  }

  // fallback
  await bot.answerCallbackQuery(query.id);
}

module.exports = { handleCallbackQuery, deletePreviousMessage };
