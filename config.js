const path = require('path');
require('dotenv').config();

module.exports = {
    TOKEN: process.env.TELEGRAM_BOT_TOKEN, // replace with your token
    DATA_FILE: path.join(__dirname, 'customer_reports.json'),
    ALLOWED_USERS: [105974471, 668058250]
};
