const userStates = {}; // Will be imported by handlers

async function sendMainMenu(bot, chatId, userId) {
    const message = await bot.sendMessage(chatId, "🏠 Main Menu — What would you like to do?", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📝 Add Report", callback_data: "add_report" }],
                [{ text: "📖 View History", callback_data: "view_history" }],
                [{ text: "✏️ Edit Report", callback_data: "edit_report" }],
                [{ text: "🗑️ Delete Report", callback_data: "delete_report" }]
            ]
        }
    });

    userStates[userId] = { lastBotMessageId: message.message_id };
}

module.exports = { sendMainMenu, userStates };
