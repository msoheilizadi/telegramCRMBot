const fs = require('fs');
const { DATA_FILE } = require('./config');

function loadData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

module.exports = { loadData, saveData, getTodayDate };
