const { loadData, saveData } = require("../data");
const { sendMainMenu, userStates } = require("../menu");
const { deleteRowInSheet, loadDataFromSheet } = require("../services/index");
const crypto = require("crypto");

// Helper to create a hash map: hash -> customerName
function createCustomerHashMap(customers) {
  const map = {};
  customers.forEach((name) => {
    const hash = crypto.createHash("md5").update(name).digest("hex").slice(0, 10);
    map[hash] = name;
  });
  return map;
}

async function handleDeleteReport(bot, chatId, userId, queryId) {
  const allData = loadData();
  const customers = Object.keys(allData);

  if (customers.length === 0) {
    return bot.sendMessage(chatId, "❌ No customers found.");
  }

  // Create hash map for use later
  const customerHashMap = createCustomerHashMap(customers);

  const buttons = customers.map((name) => {
    const hash = crypto.createHash("md5").update(name).digest("hex").slice(0, 10);
    return [{ text: name, callback_data: `delete_select_customer:${hash}` }];
  });

  buttons.push([{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]);

  const message = await bot.sendMessage(chatId, "یک شخص را انتخاب کن تا گزارش مربوط به او را حذف کنید", {
    reply_markup: { inline_keyboard: buttons },
  });

  userStates[userId] = {
    lastBotMessageId: message.message_id,
    customerHashMap, // Save map here for next handlers
  };

  await bot.answerCallbackQuery(queryId.id || queryId);
}

function sanitizeButtonText(text, maxLength = 30) {
  const cleaned = (text || "")
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, "") // remove bad characters
    .replace(/\s+/g, " ")                     // normalize spaces
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength) + "...";
}

async function handleDeleteSelectCustomer(bot, chatId, queryId, customerHash) {
  // Retrieve hash map from userStates
  const userId = queryId.from.id || queryId.from;
  const state = userStates[userId];

  if (!state || !state.customerHashMap) {
    return bot.sendMessage(chatId, "❌ خطا در بازیابی اطلاعات مشتری. لطفا دوباره تلاش کنید.");
  }

  const realCustomerName = state.customerHashMap[customerHash];
  if (!realCustomerName) {
    return bot.sendMessage(chatId, "❌ مشتری یافت نشد.");
  }

  const allData = loadData();
  const reports = allData[realCustomerName];

  if (!reports || reports.length === 0) {
    return bot.sendMessage(chatId, `❌ No reports found for ${realCustomerName}.`);
  }

  const buttons = reports.map((rep, i) => [
    {
      text: `${rep.date}: ${sanitizeButtonText(rep.report, 30)}`,
      callback_data: `delete_confirm:${customerHash}:${i}`,
    },
  ]);
  buttons.push([{ text: "🔙 برگشت به منو اصلی", callback_data: "back_to_menu" }]);

  const message = await bot.sendMessage(
    chatId,
    `یک گزارش را انتخاب کن تا حذف شود *${realCustomerName}*:`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
    }
  );

  userStates[userId].lastBotMessageId = message.message_id;

  await bot.answerCallbackQuery(queryId.id || queryId);
}

async function handleDeleteConfirm(bot, chatId, queryId, customerHash, reportIndexStr) {
  const userId = queryId.from.id || queryId.from;
  const state = userStates[userId];

  if (!state || !state.customerHashMap) {
    return bot.sendMessage(chatId, "❌ خطا در بازیابی اطلاعات مشتری. لطفا دوباره تلاش کنید.");
  }

  const realCustomerName = state.customerHashMap[customerHash];
  if (!realCustomerName) {
    return bot.sendMessage(chatId, "❌ مشتری یافت نشد.");
  }

  const reportIndex = parseInt(reportIndexStr);
  const allData = loadData();
  const reports = allData[realCustomerName];

  if (!reports || !reports[reportIndex]) {
    return bot.sendMessage(chatId, `❌ Report not found for ${realCustomerName}.`);
  }

  const deletedReport = reports[reportIndex];

  // 1. Delete from Google Sheets
  try {
    const sheetData = await loadDataFromSheet();

    // Find matching row in sheet by customer, date, report
    const rowToDelete = sheetData.find(
      (row) =>
        row.customer === realCustomerName &&
        row.date === deletedReport.date &&
        row.report === deletedReport.report
    );

    if (rowToDelete) {
      await deleteRowInSheet(rowToDelete.rowNumber);
      console.log(`Deleted row ${rowToDelete.rowNumber} in Google Sheets.`);
    } else {
      console.warn("Report not found in Google Sheets, skipping sheet deletion.");
    }
  } catch (error) {
    console.error("Failed to delete report from Google Sheets:", error);
    // Optional: notify user or continue silently
  }

  // 2. Delete from local JSON data
  reports.splice(reportIndex, 1);
  if (reports.length === 0) {
    delete allData[realCustomerName];
  }
  saveData(allData);

  await bot.sendMessage(
    chatId,
    `✅ گزارش مربوط به پاک شد *${realCustomerName}*:\n\n${deletedReport.report}`);

  // Send main menu
  await sendMainMenu(bot, chatId, userId);

  await bot.answerCallbackQuery(queryId.id || queryId);
}

module.exports = {
  handleDeleteReport,
  handleDeleteSelectCustomer,
  handleDeleteConfirm,
};
