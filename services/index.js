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

async function loadDataFromSheet() {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: "Sheet1!A:D",
  });

  const rows = response.data.values || [];

  // Map rows to objects including the row number
  return rows.map((row, i) => ({
    rowNumber: i + 1, // Sheet rows start at 1
    date: row[0] || "",
    customer: row[1] || "",
    report: row[2] || "",
    userId: row[3] || "",
  }));
}

async function updateReportInSheet(rowNumber, newReportText) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  // assuming report is in column C (index 3)
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Sheet1!C${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    resource: {
      values: [[newReportText]],
    },
  });

  return response.status === 200;
}

async function deleteRowInSheet(rowNumber) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  // Get sheetId dynamically
  const res = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet = res.data.sheets.find(s => s.properties.title === "Sheet1");
  const sheetId = sheet ? sheet.properties.sheetId : 0;

  const requests = [{
    deleteDimension: {
      range: {
        sheetId: sheetId,
        dimension: "ROWS",
        startIndex: rowNumber - 1, // zero-based
        endIndex: rowNumber,
      },
    },
  }];

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { requests },
  });

  return response.status === 200;
}




module.exports = { appendReportToSheet, loadDataFromSheet, updateReportInSheet, deleteRowInSheet };
