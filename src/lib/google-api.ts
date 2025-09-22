import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

// Initialize Google Auth with service account - supports both file path and direct JSON content
function createGoogleAuth(): GoogleAuth {
  const scopes = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/gmail.readonly',
  ];

  // Check if direct JSON content is provided (for Vercel deployment)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      return new GoogleAuth({
        credentials,
        scopes,
      });
    } catch (error) {
      console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON:', error);
      throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY format - must be valid JSON');
    }
  }

  // Fallback to file path (for local development)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
    return new GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
      scopes,
    });
  }

  throw new Error('Either GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SERVICE_ACCOUNT_KEY_FILE must be set');
}

const auth = createGoogleAuth();

// Export auth for other services
export const getAuth = () => auth;

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
export async function getMostRecentFileInfoFromFolder(folderId: string): Promise<{id: string, timestamp: string, name: string} | null> {
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

    console.log(`📁 Found ${files.length} files in folder ${folderId}:`);
    files.forEach(file => {
      console.log(`  📄 ${file.name} (modified: ${file.modifiedTime})`);
    });

    // Find all files with ISO8601 timestamps in filename
    const filesWithTimestamp = files.filter(file => {
      return file.name && /\d{4}-\d{2}-\d{2}T\d{2}[_:]\d{2}[_:]\d{2}Z/.test(file.name);
    });

    if (filesWithTimestamp.length === 0) {
      console.error(`No files with timestamp found in folder ${folderId}`);
      return null;
    }

    console.log(`🕐 Found ${filesWithTimestamp.length} files with timestamps:`);
    
    // Sort by timestamp in filename (most recent first)
    const sortedFiles = filesWithTimestamp.map(file => {
      const timestampMatch = file.name!.match(/(\d{4}-\d{2}-\d{2}T\d{2}[_:]\d{2}[_:]\d{2}Z)/);
      const timestamp = timestampMatch ? timestampMatch[1].replace(/_/g, ':') : '';
      return {
        ...file,
        extractedTimestamp: timestamp
      };
    }).sort((a, b) => {
      // Sort by extracted timestamp descending (most recent first)
      return b.extractedTimestamp.localeCompare(a.extractedTimestamp);
    });

    sortedFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. 📄 ${file.name} (timestamp: ${file.extractedTimestamp})`);
    });

    const mostRecentFile = sortedFiles[0];
    console.log(`🎯 Selected most recent file: ${mostRecentFile.name}`);

    return {
      id: mostRecentFile.id!,
      timestamp: mostRecentFile.extractedTimestamp,
      name: mostRecentFile.name!
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

// Helper function to get sheet data with hyperlink information
export async function getSheetDataWithHyperlinks(sheetId: string, sheetName: string, range: string = 'A:Z') {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
      ranges: [`'${sheetName}'!${range}`],
      includeGridData: true,
    });

    const sheet = response.data.sheets?.[0];
    const gridData = sheet?.data?.[0];

    if (!gridData?.rowData) {
      return [];
    }

    // Convert grid data to our expected format, preserving hyperlinks
    const rows = gridData.rowData.map(row => {
      return (row.values || []).map(cell => {
        const displayValue = cell.formattedValue || cell.effectiveValue?.stringValue || '';

        // If cell has a hyperlink, return an object with both text and URL
        if (cell.hyperlink) {
          return {
            text: displayValue,
            url: cell.hyperlink
          };
        }
        return displayValue;
      });
    });

    return rows;
  } catch (error) {
    console.error(`Error fetching sheet data with hyperlinks for ${sheetId}:`, error);
    return [];
  }
}

// Helper function to get sheet metadata (dimensions, sheet names, etc.)
export async function getSheetMetadata(sheetId: string) {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    const sheetList = response.data.sheets || [];
    const metadata = sheetList.map(sheet => ({
      title: sheet.properties?.title || '',
      sheetId: sheet.properties?.sheetId || 0,
      rowCount: sheet.properties?.gridProperties?.rowCount || 0,
      columnCount: sheet.properties?.gridProperties?.columnCount || 0,
    }));

    return {
      spreadsheetTitle: response.data.properties?.title || '',
      sheets: metadata,
    };
  } catch (error) {
    console.error(`Error fetching sheet metadata for ${sheetId}:`, error);
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

// Batch get multiple ranges in a single API call
export async function getBatchSheetData(sheetId: string, ranges: string[]) {
  try {
    const response = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sheetId,
      ranges,
    });
    return response.data.valueRanges?.map(range => range.values || []) || [];
  } catch (error) {
    console.error(`Error fetching batch sheet data for ${sheetId}:`, error);
    return [];
  }
}

// Helper function to update Google Sheets data (batch update)
export async function updateSheetData(sheetId: string, range: string, values: any[][]) {
  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    return response.data;
  } catch (error) {
    console.error(`Error updating sheet data for ${sheetId}:`, error);
    throw error;
  }
}

// Helper function to append data to Google Sheets
export async function appendSheetData(sheetId: string, range: string, values: any[][]) {
  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values,
      },
    });

    return response.data;
  } catch (error) {
    console.error(`Error appending sheet data for ${sheetId}:`, error);
    throw error;
  }
}

// Helper function to clear a range in Google Sheets
export async function clearSheetData(sheetId: string, range: string) {
  try {
    const response = await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range,
    });

    return response.data;
  } catch (error) {
    console.error(`Error clearing sheet data for ${sheetId}:`, error);
    throw error;
  }
}