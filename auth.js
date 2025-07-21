const { userStates } = require("./menu");
const { ALLOWED_USERS } = require("./config");

function isAuthorized(userId) {
  return ALLOWED_USERS.includes(userId);
}

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

module.exports = {
  isAuthorized,
  deletePreviousMessage,
  ALLOWED_USERS,
};
