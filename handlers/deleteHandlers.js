// deleteHandlers.js

const { loadData, saveData } = require("../data");
const { sendMainMenu, userStates } = require("../menu");
const { deleteRowInSheet, loadDataFromSheet } = require("../services/index");

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
    "یک شخص را انتخاب کن تا گزارش مربوط به او را حذف کنید",
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
  buttons.push([{ text: "🔙 برگشت به منو اصلی", callback_data: "back_to_menu" }]);

  const message = await bot.sendMessage(
    chatId,
    `یک گزارش را انتخاب کن تا حذف شود *${customer}*:`,
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

  const deletedReport = reports[reportIndex];

  // 1. Delete from Google Sheets
  try {
    const sheetData = await loadDataFromSheet();

    // Find matching row in sheet by customer, date, report, userId
    const rowToDelete = sheetData.find(row => 
      row.customer === customer &&
      row.date === deletedReport.date &&
      row.report === deletedReport.report
      // optionally match userId if you saved it
    );

    if (rowToDelete) {
      await deleteRowInSheet(rowToDelete.rowNumber);
      console.log(`Deleted row ${rowToDelete.rowNumber} in Google Sheets.`);
    } else {
      console.warn("Report not found in Google Sheets, skipping sheet deletion.");
    }
  } catch (error) {
    console.error("Failed to delete report from Google Sheets:", error);
    // You can decide to notify the user or just continue
  }

  // 2. Delete from local JSON data
  reports.splice(reportIndex, 1);
  if (reports.length === 0) {
    delete allData[customer];
  }
  saveData(allData);

  await bot.sendMessage(
    chatId,
    `✅ گزارش مربوط به پاک شد*${customer}*:\n\n${deletedReport.report}`,
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
