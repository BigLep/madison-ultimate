import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getSheetData, getMostRecentFileInfoFromFolder } from '../../../lib/google-api';

interface DiagnosticResult {
  category: string;
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

interface DiagnosticReport {
  timestamp: string;
  overall: 'pass' | 'fail' | 'warning';
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  results: DiagnosticResult[];
}

export async function GET(request: NextRequest) {
  const results: DiagnosticResult[] = [];
  const startTime = new Date().toISOString();

  // Helper function to add results
  const addResult = (category: string, name: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any) => {
    results.push({ category, name, status, message, details });
  };

  // 1. Environment Variables Check
  const requiredEnvVars = [
    'ROSTER_SHEET_ID',
    'SPS_FINAL_FORMS_FOLDER_ID',
    'TEAM_MAILING_LIST_FOLDER_ID',
    'ADDITIONAL_QUESTIONNAIRE_SHEET_ID',
  ];

  requiredEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
      addResult('Environment', envVar, 'pass', `Set (${value.substring(0, 10)}...)`);
    } else {
      addResult('Environment', envVar, 'fail', 'Not set or empty');
    }
  });

  // Check service account credential configuration
  const serviceAccountKeyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKeyFile || serviceAccountKey) {
    addResult('Environment', 'Service Account Config', 'pass',
      serviceAccountKeyFile ? `Using key file: ${serviceAccountKeyFile}` : 'Using direct key content');
  } else {
    addResult('Environment', 'Service Account Config', 'fail',
      'Neither GOOGLE_SERVICE_ACCOUNT_KEY_FILE nor GOOGLE_SERVICE_ACCOUNT_KEY is set');
  }

  // 2. Credential File Access
  try {
    // Check service account file
    if (serviceAccountKeyFile) {
      const credentialsPath = path.join(process.cwd(), serviceAccountKeyFile);
      if (fs.existsSync(credentialsPath)) {
        const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        addResult('Credentials', 'Service Account File', 'pass',
          `File exists and parsed successfully. Client email: ${credentials.client_email}`);
      } else {
        addResult('Credentials', 'Service Account File', 'fail',
          `File not found: ${credentialsPath}`);
      }
    }

  } catch (error) {
    addResult('Credentials', 'File Access', 'fail',
      `Error reading credential files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 3. Google Sheets Access
  try {
    // Test roster sheet access
    const rosterSheetId = process.env.ROSTER_SHEET_ID;
    if (rosterSheetId) {
      const rosterData = await getSheetData(rosterSheetId, 'A1:D4');
      if (rosterData && rosterData.length > 0) {
        addResult('Sheets Access', 'Roster Sheet', 'pass',
          `Successfully accessed sheet. Found ${rosterData.length} rows of metadata.`);
      } else {
        addResult('Sheets Access', 'Roster Sheet', 'warning',
          'Sheet accessible but no data found in A1:D4 range');
      }
    }

    // Test additional questionnaire sheet access
    const questionnaireSheetId = process.env.ADDITIONAL_QUESTIONNAIRE_SHEET_ID;
    if (questionnaireSheetId) {
      const questionnaireData = await getSheetData(questionnaireSheetId, 'A1:E2');
      if (questionnaireData && questionnaireData.length > 0) {
        addResult('Sheets Access', 'Questionnaire Sheet', 'pass',
          `Successfully accessed sheet. Found ${questionnaireData.length} rows.`);
      } else {
        addResult('Sheets Access', 'Questionnaire Sheet', 'warning',
          'Sheet accessible but no data found');
      }
    }
  } catch (error) {
    addResult('Sheets Access', 'Google Sheets API', 'fail',
      `Error accessing sheets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 4. Google Drive Access
  try {
    // Test SPS Final Forms folder
    const spsFolderId = process.env.SPS_FINAL_FORMS_FOLDER_ID;
    if (spsFolderId) {
      const spsFileInfo = await getMostRecentFileInfoFromFolder(spsFolderId);
      if (spsFileInfo) {
        addResult('Drive Access', 'SPS Final Forms Folder', 'pass',
          `Successfully accessed folder. Most recent file: ${spsFileInfo.name}`);
      } else {
        addResult('Drive Access', 'SPS Final Forms Folder', 'warning',
          'Folder accessible but no timestamped files found');
      }
    }

    // Test team mailing list folder
    const mailingListFolderId = process.env.TEAM_MAILING_LIST_FOLDER_ID;
    if (mailingListFolderId) {
      const mailingFileInfo = await getMostRecentFileInfoFromFolder(mailingListFolderId);
      if (mailingFileInfo) {
        addResult('Drive Access', 'Team Mailing List Folder', 'pass',
          `Successfully accessed folder. Most recent file: ${mailingFileInfo.name}`);
      } else {
        addResult('Drive Access', 'Team Mailing List Folder', 'warning',
          'Folder accessible but no timestamped files found');
      }
    }
  } catch (error) {
    addResult('Drive Access', 'Google Drive API', 'fail',
      `Error accessing Drive folders: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 5. System Checks
  try {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    if (majorVersion >= 18) {
      addResult('System', 'Node.js Version', 'pass', `Version ${nodeVersion} (>= 18 required)`);
    } else {
      addResult('System', 'Node.js Version', 'warning', `Version ${nodeVersion} (18+ recommended)`);
    }

    // Check timezone
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    addResult('System', 'Timezone', 'pass', `System timezone: ${timezone}`);

    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    if (heapUsedMB < 200) {
      addResult('System', 'Memory Usage', 'pass', `${heapUsedMB}MB used of ${heapTotalMB}MB allocated`);
    } else {
      addResult('System', 'Memory Usage', 'warning', `${heapUsedMB}MB used of ${heapTotalMB}MB allocated (high usage)`);
    }
  } catch (error) {
    addResult('System', 'System Checks', 'fail',
      `Error checking system info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Calculate summary
  const summary = {
    total: results.length,
    passed: results.filter(r => r.status === 'pass').length,
    failed: results.filter(r => r.status === 'fail').length,
    warnings: results.filter(r => r.status === 'warning').length,
  };

  // Determine overall status
  let overall: 'pass' | 'fail' | 'warning' = 'pass';
  if (summary.failed > 0) {
    overall = 'fail';
  } else if (summary.warnings > 0) {
    overall = 'warning';
  }

  const report: DiagnosticReport = {
    timestamp: startTime,
    overall,
    summary,
    results,
  };

  return NextResponse.json(report, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}