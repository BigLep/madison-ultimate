import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

// Initialize Google Auth with service account JSON file
const auth = new GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
});

// Initialize Google Sheets and Drive APIs
export const sheets = google.sheets({ version: 'v4', auth });
export const drive = google.drive({ version: 'v3', auth });

// Helper function to get the most recent file from a Drive folder by timestamp in filename
export async function getMostRecentFileFromFolder(folderId: string): Promise<string | null> {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      orderBy: 'name desc', // This will sort by filename, putting most recent timestamps first
      pageSize: 10,
    });

    const files = response.data.files;
    if (!files || files.length === 0) {
      console.error(`No files found in folder ${folderId}`);
      return null;
    }

    // Find the file with the most recent ISO8601 timestamp in the filename
    const fileWithTimestamp = files.find(file => {
      return file.name && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/.test(file.name);
    });

    if (!fileWithTimestamp?.id) {
      console.error(`No files with timestamp found in folder ${folderId}`);
      return null;
    }

    return fileWithTimestamp.id;
  } catch (error) {
    console.error(`Error fetching files from folder ${folderId}:`, error);
    return null;
  }
}

// Helper function to get the most recent file info including timestamp from filename
export async function getMostRecentFileInfoFromFolder(folderId: string): Promise<{id: string, timestamp: string} | null> {
  try {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      orderBy: 'name desc',
      pageSize: 10,
    });

    const files = response.data.files;
    if (!files || files.length === 0) {
      console.error(`No files found in folder ${folderId}`);
      return null;
    }

    // Find the file with the most recent ISO8601 timestamp in the filename
    const fileWithTimestamp = files.find(file => {
      return file.name && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/.test(file.name);
    });

    if (!fileWithTimestamp?.id || !fileWithTimestamp.name) {
      console.error(`No files with timestamp found in folder ${folderId}`);
      return null;
    }

    // Extract timestamp from filename
    const timestampMatch = fileWithTimestamp.name.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/);
    const timestamp = timestampMatch ? timestampMatch[1] : '';

    return {
      id: fileWithTimestamp.id,
      timestamp
    };
  } catch (error) {
    console.error(`Error fetching files from folder ${folderId}:`, error);
    return null;
  }
}

// Helper function to download CSV content from a Drive file
export async function downloadCsvFromDrive(fileId: string): Promise<string | null> {
  try {
    const response = await drive.files.get({
      fileId,
      alt: 'media',
    });

    return response.data as string;
  } catch (error) {
    console.error(`Error downloading file ${fileId}:`, error);
    return null;
  }
}

// Helper function to get Google Sheets data
export async function getSheetData(sheetId: string, range: string = 'A:Z') {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });

    return response.data.values || [];
  } catch (error) {
    console.error(`Error fetching sheet data for ${sheetId}:`, error);
    return [];
  }
}