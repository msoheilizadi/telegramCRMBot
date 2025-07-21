const { loadData, saveData, getTodayDate } = require("./data");
const { isAuthorized, deletePreviousMessage } = require("./auth");
const { sendMainMenu, userStates } = require("./menu");
const { appendReportToSheet } = require("./services/index");
const { handleCallbackQuery } = require("./handlers/callbackQueryHandler");

function registerHandlers(bot) {
  // /start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (!isAuthorized(userId)) {
      return bot.sendMessage(
        chatId,
        "❌ You are not authorized to use this bot."
      );
    }
    await sendMainMenu(bot, chatId, userId);
  });

  bot.on("callback_query", (query) => {
    // answer immediately (fire & forget)
    bot.answerCallbackQuery(query.id).catch(() => {});

    // handle callback query asynchronously, no await here
    handleCallbackQuery(bot, query).catch(console.error);
  });

  // Handle text messages (Add report flow)
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text?.trim();

    const user = userStates[userId];
    if (!user || !user.step) return;
    if (!isAuthorized(userId)) return;

    const data = loadData();

    if (user.step === "waiting_new_customer_name") {
      user.customerName = text;
      user.step = "waiting_report_text";
      return bot.sendMessage(chatId, `✏️ حالا متن گزارش رو برای بنویس *${text}*:`, {
        parse_mode: "Markdown",
      });
    }

    if (user.step === "waiting_report_text") {
      const today = getTodayDate();
      const customer = user.customerName;

      if (!data[customer]) data[customer] = [];
      data[customer].push({ date: today, report: text });
      saveData(data);

      delete userStates[userId];

      // Save to Google Sheets
      try {
        await appendReportToSheet({
          customer,
          date: today,
          report: text,
          userId,
        });
      } catch (err) {
        console.error("❌ Failed to save to Google Sheets:", err.message);
      }

      await bot.sendMessage(
        chatId,
        `✅ گزارش مربوط به شخص${customer} در ${today} ذخیره شد`
      );

      // Show extended menu including edit/delete
      const message = await bot.sendMessage(
        chatId,
        "حالا چه کاری میخوای انجام بدی؟",
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📝 اضافه کردن گزارش", callback_data: "add_report" }],
              [{ text: "📖 دیدن تاریخچه گزارشات", callback_data: "view_history" }],
              [{ text: "✏️ ویرایش گزارش", callback_data: "edit_report" }],
              [{ text: "🗑️ پاک کردن گزارش", callback_data: "delete_report" }],
            ],
          },
        }
      );
      userStates[userId] = { lastBotMessageId: message.message_id };
    }

    if (user.step === "waiting_edit_report_text") {
      const { customerName, reportIndex } = user;
      const allData = loadData();

      if (!allData[customerName] || !allData[customerName][reportIndex]) {
        delete userStates[userId];
        return bot.sendMessage(
          chatId,
          "❌ Report not found or already deleted."
        );
      }

      const oldReportText = allData[customerName][reportIndex].report;
      const reportDate = allData[customerName][reportIndex].date;

      // Update local JSON
      allData[customerName][reportIndex].report = text;
      saveData(allData);

      // Update Google Sheets
      try {
        const rows = await loadDataFromSheet();
        // Find matching row by customer, date, and old report text
        const row = rows.find(
          (r) =>
            r.customer === customerName &&
            r.date === reportDate &&
            r.report === oldReportText
        );
        if (row) {
          await updateReportInSheet(row.rowNumber, text);
        } else {
          console.warn(
            "⚠️ Could not find matching report in Google Sheets to update"
          );
        }
      } catch (err) {
        console.error("❌ Failed to update Google Sheets:", err);
      }

      delete userStates[userId];

      await bot.sendMessage(chatId, `✅ 'گزارش اپدیت شد' ${customerName}.`);
      await sendMainMenu(bot, chatId, userId);
      return;
    }
  });
}

module.exports = { registerHandlers };
