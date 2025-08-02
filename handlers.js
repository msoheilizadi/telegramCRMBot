const { loadData, saveData, getTodayDate } = require("./data");
const { isAuthorized, deletePreviousMessage } = require("./auth");
const { sendMainMenu, userStates, sendBackToMenuButton } = require("./menu");
const {
  appendReportToSheet,
  loadDataFromSheet,
  checkAndSendReminders,
} = require("./services/index");
const { handleCallbackQuery } = require("./handlers/callbackQueryHandler");
const moment = require("moment-jalaali");

const keywords = ["جلسه", "پرزنت", "حضوری", "meeting"];
const keywords2 = ["تماس", "ارسال", "فرستادن"];

function isValidJalaaliDate(dateStr) {
  if (!moment(dateStr, "jYYYY-jMM-jDD", true).isValid()) return false;

  // Parse moment object
  const m = moment(dateStr, "jYYYY-jMM-jDD", true);
  if (!m.isValid()) return false;

  const year = m.jYear();
  const month = m.jMonth() + 1; // jMonth() is zero-based
  const day = m.jDate();

  // Check month range
  if (month < 1 || month > 12) return false;

  // Get days in this month/year
  const daysInMonth = moment.jDaysInMonth(year, month - 1); // month zero-based

  if (day < 1 || day > daysInMonth) return false;

  return true;
}

function registerHandlers(bot) {
  // /start command

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = userStates[userId]; // Add this at the top after checking authorization

    if (!isAuthorized(userId)) {
      return bot.sendMessage(
        chatId,
        "❌ You are not authorized to use this bot."
      );
    }

    try {
      const data = await loadDataFromSheet();
      await checkAndSendReminders(bot); // Check and send reminders on startup

      const customer_reports = {}; // NEW object, no loading from JSON

      // Skip header row (assuming loadDataFromSheet returns all rows including header)
      data.slice(1).forEach((entry) => {
        if (!customer_reports[entry.customer]) {
          customer_reports[entry.customer] = [];
        }
        customer_reports[entry.customer].push({
          date: entry.date,
          report: entry.report,
          userId: entry.userId,
          rowNumber: entry.rowNumber,
        });
      });

      saveData(customer_reports); // Overwrites the JSON file

      console.log("✅ customer_reports overwritten and saved.");

      await sendMainMenu(bot, chatId, msg.from.id);
      await sendBackToMenuButton(bot, chatId);
    } catch (error) {
      console.error("❌ Error loading or saving customer reports:", error);
      bot.sendMessage(
        chatId,
        "⚠️ Failed to load customer reports. Please try again."
      );
    }
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

    if (text && text.includes("منو اصلی")) {
      return sendMainMenu(bot, chatId, msg.from.id);
    }

    const user = userStates[userId];
    if (!user || !user.step) return;
    if (!isAuthorized(userId)) return;

    const data = loadData();

    if (user && user.step === "waiting_meeting_date") {
      const remindDate = text.trim();
      const remindType = "meeting";

      if (!isValidJalaaliDate(remindDate)) {
        return bot.sendMessage(
          chatId,
          "❌ تاریخ وارد شده معتبر نیست. لطفاً دوباره به صورت مثال 1404-08-22 وارد کن."
        );
      }

      // Delete user state here BEFORE sending messages, so no duplicate processing:
      delete userStates[userId];

      try {
        await appendReportToSheet({
          customer: user.customerName,
          date: user.reportDate,
          report: user.reportText,
          remindType,
          remindDate,
        });

        await bot.sendMessage(
          chatId,
          `✅ گزارش و یادآوری جلسه ذخیره شد برای ${remindDate}.`
        );
        await sendMainMenu(bot, chatId, userId);

        delete userStates[userId];
      } catch (err) {
        console.error("❌ Failed to save meeting info:", err.message);
        await bot.sendMessage(
          chatId,
          "❌ خطا در ذخیره‌سازی یادآوری جلسه. لطفا دوباره تلاش کنید."
        );
      }
      return;
    }

    if (user.step === "waiting_new_customer_name") {
      user.customerName = text;
      user.step = "waiting_report_text";
      return bot.sendMessage(
        chatId,
        `✏️ حالا متن گزارش رو برای بنویس *${text}*:`
      );
    }

    if (user.step === "waiting_report_text") {
      const today = getTodayDate();
      const customer = user.customerName;

      if (!data[customer]) data[customer] = [];
      data[customer].push({ date: today, report: text });
      saveData(data);

      // Store report temporarily before final submission
      user.reportText = text;
      user.reportDate = today;
      user.step = "check_meeting_keywords";

      const hasMeetingKeyword = keywords.some((word) => text.includes(word));
      if (hasMeetingKeyword) {
        return bot.sendMessage(
          chatId,
          `📌 به نظر می‌رسد این گزارش شامل ملاقات حضوری است. درسته؟`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: "✅ بله", callback_data: "confirm_meeting_yes" }],
                [{ text: "❌ نه", callback_data: "confirm_meeting_no" }],
              ],
            },
          }
        );
      }

      const hasKeyword2 = keywords2.some((word) => text.includes(word));

      if (hasKeyword2) {
        user.step = "confirm_send_file"; // مرحله بعدی
        return bot.sendMessage(chatId, `❓ آیا باید فایلی برای ارسال شود؟`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ بله", callback_data: "confirm_send_file_yes" }],
              [{ text: "❌ نه", callback_data: "confirm_send_file_no" }],
            ],
          },
        });
      }

      // If no keyword, finalize directly
      delete userStates[userId];

      try {
        await appendReportToSheet({
          customer,
          date: today,
          report: text,
        });
      } catch (err) {
        console.error("❌ Failed to save to Google Sheets:", err.message);
      }

      return bot.sendMessage(
        chatId,
        `✅ گزارش مربوط به شخص ${customer} در ${today} ذخیره شد`
      );
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
