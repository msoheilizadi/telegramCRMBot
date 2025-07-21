// googleSheets.js
const { google } = require("googleapis");
const path = require("path");
require('dotenv').config();

let auth;
if (process.env.GOOGLE_CREDENTIALS_JSON) {
  // Railway / production
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
} else {
  // Local dev
  auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}


const SHEET_ID = "1xEDA_IZp-fhiPCuNw_Eo3QJIMiJ3g3LONZ1t2XIBdG8"; // Replace with your Google Sheet ID

async function appendReportToSheet({ customer, date, report, userId }) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: "Sheet1!A1", // or your desired range
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    resource: {
      values: [[date, customer, report, userId]],
    },
  });

  return response.status === 200;
}

module.exports = { appendReportToSheet };
