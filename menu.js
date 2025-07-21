const userStates = {}; // Will be imported by handlers

async function sendMainMenu(bot, chatId, userId) {
    const message = await bot.sendMessage(chatId, "🏠 منو اصلی — چه کاری میخواهی انجام بدی؟", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📝 اضافه کردن گزارش", callback_data: "add_report" }],
                [{ text: "📖 دیدن تاریخچه گزارشات", callback_data: "view_history" }],
                [{ text: "✏️ ادیت گزارش", callback_data: "edit_report" }],
                [{ text: "🗑️ پاک کردن گزارش ", callback_data: "delete_report" }]
            ]
        }
    });

    userStates[userId] = { lastBotMessageId: message.message_id };
}

module.exports = { sendMainMenu, userStates };
