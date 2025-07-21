const fs = require('fs');
const { DATA_FILE } = require('./config');
const moment = require('moment-jalaali');
moment.loadPersian({ dialect: 'persian-modern', usePersianDigits: false });

function loadData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getTodayDate() {
  return moment().format('jYYYY/jMM/jDD'); // Example: 1403/04/30
}

module.exports = { loadData, saveData, getTodayDate };
