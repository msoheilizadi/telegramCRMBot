const { loadData, saveData, getTodayDate } = require('./data');
const { ALLOWED_USERS } = require('./config');
const { sendMainMenu, userStates } = require('./menu');

function isAuthorized(userId) {
    return ALLOWED_USERS.includes(userId);
}

function registerHandlers(bot) {
    // /start command
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        if (!isAuthorized(userId)) {
            return bot.sendMessage(chatId, "❌ You are not authorized to use this bot.");
        }
        await sendMainMenu(bot, chatId, userId);
    });

    // Callback queries (button presses)
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const userId = query.from.id;
    const callbackData = query.data;

    if (!isAuthorized(userId)) {
        return bot.answerCallbackQuery(query.id, { text: "⛔️ Access denied.", show_alert: true });
    }

    const userState = userStates[userId] || {};
    const prevMsgId = userState.lastBotMessageId;

    if (prevMsgId) {
        try {
            await bot.deleteMessage(chatId, prevMsgId);
        } catch (err) {
            console.warn('⚠️ Could not delete previous message:', err.message);
        }
    }

    // 🔙 Back to main menu
    if (callbackData === 'back_to_menu') {
        await sendMainMenu(bot, chatId, userId);
        return bot.answerCallbackQuery(query.id);
    }

    // 📚 View customer history
    if (callbackData === 'view_history') {
        const allData = loadData();
        const customers = Object.keys(allData);

        if (customers.length === 0) {
            return bot.sendMessage(chatId, "❌ No customers found.");
        }

        const buttons = customers.map(name => [{ text: name, callback_data: `history:${name}` }]);
        buttons.push([{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]);

        const message = await bot.sendMessage(chatId, "📚 Select a customer to view their history:", {
            reply_markup: { inline_keyboard: buttons }
        });

        userStates[userId] = { lastBotMessageId: message.message_id };
        return bot.answerCallbackQuery(query.id);
    }

    // Display specific customer's report history
    if (callbackData.startsWith('history:')) {
        const customerName = callbackData.split(':')[1];
        const allData = loadData();
        const history = allData[customerName];

        if (!history || history.length === 0) {
            return bot.sendMessage(chatId, `❌ No reports found for ${customerName}.`);
        }

        let response = `📄 Report history for ${customerName}:\n\n`;
        history.forEach(entry => {
            response += `🗓️ ${entry.date}:\n${entry.report}\n\n`;
        });

        await bot.sendMessage(chatId, response);
        await bot.sendMessage(chatId, "🔽", {
            reply_markup: {
                inline_keyboard: [[{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]]
            }
        });
        return bot.answerCallbackQuery(query.id);
    }

    // ➕ Add report flow
    if (callbackData === 'add_report') {
        const allData = loadData();
        const customers = Object.keys(allData);

        const buttons = customers.map(name => [{ text: name, callback_data: `add_report_existing_customer:${name}` }]);
        buttons.push([{ text: "➕ Add New Customer", callback_data: "add_report_new_customer" }]);
        buttons.push([{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]);

        const message = await bot.sendMessage(chatId, "🧾 Select a customer or add a new one:", {
            reply_markup: { inline_keyboard: buttons }
        });

        userStates[userId] = { lastBotMessageId: message.message_id };
        return bot.answerCallbackQuery(query.id);
    }

    // Adding report for an existing customer
    if (callbackData.startsWith('add_report_existing_customer:')) {
        const customerName = callbackData.split(':')[1];
        userStates[userId] = { step: 'waiting_report_text', customerName };

        await bot.sendMessage(chatId, `✏️ Write the report for *${customerName}*:`, { parse_mode: 'Markdown' });
        return bot.answerCallbackQuery(query.id);
    }

    // Add new customer before writing report
    if (callbackData === 'add_report_new_customer') {
        userStates[userId] = { step: 'waiting_new_customer_name' };
        await bot.sendMessage(chatId, "🧾 Please enter the *new customer name*:", { parse_mode: 'Markdown' });
        return bot.answerCallbackQuery(query.id);
    }

    // Fallback answer
    await bot.answerCallbackQuery(query.id);
});


    // Handle text messages (Add report flow)
    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text = msg.text?.trim();

        const user = userStates[userId];
        if (!user || !user.step) return;
        if (!isAuthorized(userId)) return;

        const data = loadData();

        if (user.step === 'waiting_new_customer_name') {
            user.customerName = text;
            user.step = 'waiting_report_text';
            return bot.sendMessage(chatId, `✏️ Now write the report for *${text}*:`, { parse_mode: 'Markdown' });
        }

        if (user.step === 'waiting_report_text') {
            const today = getTodayDate();
            const customer = user.customerName;

            if (!data[customer]) data[customer] = [];
            data[customer].push({ date: today, report: text });
            saveData(data);

            delete userStates[userId];

            await bot.sendMessage(chatId, `✅ Report saved for ${customer} on ${today}.`);
            
            // Show extended menu including edit/delete
            const message = await bot.sendMessage(chatId, "What would you like to do next?", {
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

        if (data === 'edit_report') {
    const allData = loadData();
    const customers = Object.keys(allData);

    if (customers.length === 0) {
        return bot.sendMessage(chatId, "❌ No customers found.");
    }

    const buttons = customers.map(name => [{ text: name, callback_data: `edit_select_customer:${name}` }]);
    buttons.push([{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]);

    const message = await bot.sendMessage(chatId, "Select a customer to edit their reports:", {
        reply_markup: {
            inline_keyboard: buttons
        }
    });

    userStates[userId] = { lastBotMessageId: message.message_id };
    return;
}

if (data.startsWith('edit_select_customer:')) {
    const customer = data.split(':')[1];
    const allData = loadData();
    const reports = allData[customer];

    if (!reports || reports.length === 0) {
        return bot.sendMessage(chatId, `❌ No reports found for ${customer}.`);
    }

    const buttons = reports.map((rep, i) => [{
        text: `${rep.date}: ${rep.report.substring(0, 20)}${rep.report.length > 20 ? '...' : ''}`,
        callback_data: `edit_report_text:${customer}:${i}`
    }]);
    buttons.push([{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]);

    const message = await bot.sendMessage(chatId, `Select a report to edit for *${customer}*:`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    });

    userStates[userId] = { lastBotMessageId: message.message_id };
    return;
}

if (data.startsWith('edit_report_text:')) {
    const [, customer, indexStr] = data.split(':');
    const index = parseInt(indexStr);

    userStates[userId] = {
        step: 'waiting_edit_report_text',
        customerName: customer,
        reportIndex: index
    };

    return bot.sendMessage(chatId, `✏️ Send new text for the report dated *${getTodayDate()}* for customer *${customer}*:`, { parse_mode: 'Markdown' });
}

// When user sends edited report text
if (user.step === 'waiting_edit_report_text') {
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

if (data === 'delete_report') {
    const allData = loadData();
    const customers = Object.keys(allData);

    if (customers.length === 0) {
        return bot.sendMessage(chatId, "❌ No customers found.");
    }

    const buttons = customers.map(name => [{ text: name, callback_data: `delete_select_customer:${name}` }]);
    buttons.push([{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]);

    const message = await bot.sendMessage(chatId, "Select a customer to delete their reports:", {
        reply_markup: {
            inline_keyboard: buttons
        }
    });

    userStates[userId] = { lastBotMessageId: message.message_id };
    return;
}

if (data.startsWith('delete_select_customer:')) {
    const customer = data.split(':')[1];
    const allData = loadData();
    const reports = allData[customer];

    if (!reports || reports.length === 0) {
        return bot.sendMessage(chatId, `❌ No reports found for ${customer}.`);
    }

    const buttons = reports.map((rep, i) => [{
        text: `${rep.date}: ${rep.report.substring(0, 20)}${rep.report.length > 20 ? '...' : ''}`,
        callback_data: `delete_confirm:${customer}:${i}`
    }]);
    buttons.push([{ text: "🔙 Back to Menu", callback_data: "back_to_menu" }]);

    const message = await bot.sendMessage(chatId, `Select a report to delete for *${customer}*:`, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: buttons }
    });

    userStates[userId] = { lastBotMessageId: message.message_id };
    return;
}

const allData = loadData();

if (!allData[customer] || !allData[customer][index]) {
    return bot.sendMessage(chatId, "❌ Report not found or already deleted.");
}

allData[customer].splice(index, 1);
if (allData[customer].length === 0) {
    delete allData[customer];
}
saveData(allData);



    });
}

module.exports = { registerHandlers };
