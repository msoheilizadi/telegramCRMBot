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
    return bot.sendMessage(chatId, `✏️ Now write the report for *${text}*:`, {
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

    data[customer].push({ date: today, report: text });
    saveData(data);

    // Save to Google Sheets
    try {
      await appendReportToSheet({ customer, date: today, report: text, userId });
    } catch (err) {
      console.error("❌ Failed to save to Google Sheets:", err.message);
    }

    await bot.sendMessage(
      chatId,
      `✅ Report saved for ${customer} on ${today}.`
    );

    // Show extended menu including edit/delete
    const message = await bot.sendMessage(
      chatId,
      "What would you like to do next?",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📝 Add Report", callback_data: "add_report" }],
            [{ text: "📖 View History", callback_data: "view_history" }],
            [{ text: "✏️ Edit Report", callback_data: "edit_report" }],
            [{ text: "🗑️ Delete Report", callback_data: "delete_report" }],
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
      return bot.sendMessage(chatId, "❌ Report not found or already deleted.");
    }

    allData[customerName][reportIndex].report = text;
    saveData(allData);

    delete userStates[userId];

    await bot.sendMessage(chatId, `✅ Report updated for ${customerName}.`);
    await sendMainMenu(bot, chatId, userId);
    return;
  }
});
}


module.exports = { registerHandlers };
