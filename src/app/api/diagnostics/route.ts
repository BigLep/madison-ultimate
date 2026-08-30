import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getSheetData, getMostRecentFileInfoFromFolder } from '../../../lib/google-api';
import { getDriveFolderName } from '../../../lib/google-oauth-drive';
import { SHEET_CONFIG } from '../../../lib/sheet-config';
import { probeButtondownPermissions } from '../../../lib/buttondown-api';

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
    'ADDITIONAL_QUESTIONNAIRE_SHEET_ID',
    'SIGNUPS_SHEET_ID',
  ];

  requiredEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
      addResult('Environment', envVar, 'pass', `Set (${value.substring(0, 10)}...)`);
    } else {
      addResult('Environment', envVar, 'fail', 'Not set or empty');
    }
  });

  // Optional, per SEASON_SETUP.md: only the legacy team-mailing-list-CSV roster
  // feature (roster-synthesizer.ts) uses it, and it degrades gracefully without it.
  if (process.env.TEAM_MAILING_LIST_FOLDER_ID) {
    addResult('Environment', 'TEAM_MAILING_LIST_FOLDER_ID', 'pass',
      `Set (${process.env.TEAM_MAILING_LIST_FOLDER_ID.substring(0, 10)}...)`);
  } else {
    addResult('Environment', 'TEAM_MAILING_LIST_FOLDER_ID', 'warning',
      'Not set (legacy team-mailing-list-CSV roster feature will not work)');
  }

  // These vars are required for player-photo upload itself (google-oauth-drive.ts throws
  // without them), a signup-critical feature — 2026-08-30: production shipped without them
  // for a while because this only warned, not failed. Check as a hard failure, not a warning.
  const requiredPhotoUploadEnvVars = [
    'GOOGLE_OAUTH_CLIENT_ID',
    'GOOGLE_OAUTH_CLIENT_SECRET',
    'GOOGLE_OAUTH_REFRESH_TOKEN',
    'PHOTOS_FOLDER_ID',
  ];

  requiredPhotoUploadEnvVars.forEach(envVar => {
    const value = process.env[envVar];
    if (value) {
      addResult('Environment', envVar, 'pass', `Set (${value.substring(0, 10)}...)`);
    } else {
      addResult('Environment', envVar, 'fail', 'Not set: player photo upload will not work');
    }
  });

  // FALL_2025_ROSTER_SHEET_ID is checked as a warning, not a failure: unlike the vars above,
  // the rest of the app (including new photo uploads) works fine without it, only the
  // Fall-2025-photo-carryover feature degrades.
  if (process.env.FALL_2025_ROSTER_SHEET_ID) {
    addResult('Environment', 'FALL_2025_ROSTER_SHEET_ID', 'pass',
      `Set (${process.env.FALL_2025_ROSTER_SHEET_ID.substring(0, 10)}...)`);
  } else {
    addResult('Environment', 'FALL_2025_ROSTER_SHEET_ID', 'warning',
      'Not set (player photo carryover from Fall 2025 will not work)');
  }

  // Invite URL must never appear in diagnostics output (or the client bundle).
  if (process.env.WHATSAPP_COMMUNITY_JOIN_URL) {
    addResult('Environment', 'WHATSAPP_COMMUNITY_JOIN_URL', 'pass', 'Set');
  } else {
    addResult('Environment', 'WHATSAPP_COMMUNITY_JOIN_URL', 'warning', 'Not set (/whatsapp will 404)');
  }

  // Do not print any prefix of the key.
  if (process.env.BUTTONDOWN_API_KEY) {
    addResult('Environment', 'BUTTONDOWN_API_KEY', 'pass', 'Set');
  } else {
    addResult('Environment', 'BUTTONDOWN_API_KEY', 'warning',
      'Not set (newsletter status, Join / Leave, and auto-subscribe are disabled)');
  }

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
      // turbopackIgnore: this path is only ever a small, env-configured credentials file (e.g.
      // "./.google-service-account.json"), never user input; without the ignore, Turbopack's
      // static analysis traces the whole project as a dependency of this route (see Next 16
      // build warning: "Dynamic filesystem access causes tracing of the whole project").
      const credentialsPath = path.join(/* turbopackIgnore: true */ process.cwd(), serviceAccountKeyFile);
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

    // Test signups sheet access. Every /signup submission depends on this, so verify
    // it beyond the env-var-is-set check above.
    const signupsSheetId = process.env.SIGNUPS_SHEET_ID;
    if (signupsSheetId) {
      const signupsData = await getSheetData(signupsSheetId, 'A1:D2');
      if (signupsData && signupsData.length > 0) {
        addResult('Sheets Access', 'Signups Sheet', 'pass',
          `Successfully accessed sheet. Found ${signupsData.length} rows.`);
      } else {
        addResult('Sheets Access', 'Signups Sheet', 'warning',
          'Sheet accessible but no data found in A1:D2 range');
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

  // 5. Photo Upload (OAuth identity access, separate from the service account above)
  try {
    const hasOAuthCreds = Boolean(
      process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    );
    const photosFolderId = process.env.PHOTOS_FOLDER_ID;

    if (!hasOAuthCreds) {
      addResult('Photo Upload', 'OAuth Identity', 'fail',
        'GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN not fully set; photo upload is disabled');
    } else if (!photosFolderId) {
      addResult('Photo Upload', 'Photos Folder', 'fail', 'PHOTOS_FOLDER_ID not set; photo upload is disabled');
    } else {
      const folderName = await getDriveFolderName(photosFolderId);
      if (folderName) {
        addResult('Photo Upload', 'Photos Folder', 'pass',
          `OAuth identity can access the photos folder: "${folderName}"`);
      } else {
        addResult('Photo Upload', 'Photos Folder', 'fail',
          'OAuth credentials are set but could not access PHOTOS_FOLDER_ID (invalid/expired refresh token, or the folder is not shared with this identity)');
      }
    }

    // Photo Carryover reads the Fall 2025 roster via the service account (not OAuth), so this
    // can fail independently of the OAuth identity check above.
    const fall2025SheetId = SHEET_CONFIG.FALL_2025_ROSTER_SHEET_ID;
    if (!fall2025SheetId) {
      addResult('Photo Upload', 'Fall 2025 Roster (Carryover)', 'warning', 'FALL_2025_ROSTER_SHEET_ID not set');
    } else {
      const header = await getSheetData(fall2025SheetId, `'${SHEET_CONFIG.ROSTER_SHEET_NAME}'!A1:AQ1`);
      const headerRow = (header[0] || []).map(String);
      const hasStudentId = headerRow.includes('StudentID');
      const hasPhotoColumn = headerRow.includes('Photo Download');
      if (hasStudentId && hasPhotoColumn) {
        addResult('Photo Upload', 'Fall 2025 Roster (Carryover)', 'pass',
          'Service account can read the Fall 2025 roster; StudentID and Photo Download columns found');
      } else if (headerRow.length === 0) {
        addResult('Photo Upload', 'Fall 2025 Roster (Carryover)', 'fail',
          'Could not read the Fall 2025 roster header row (sharing or sheet/tab name issue)');
      } else {
        addResult('Photo Upload', 'Fall 2025 Roster (Carryover)', 'fail',
          `Fall 2025 roster readable, but missing expected column(s): ${[
            !hasStudentId && 'StudentID',
            !hasPhotoColumn && 'Photo Download',
          ].filter(Boolean).join(', ')}`);
      }
    }
  } catch (error) {
    addResult('Photo Upload', 'Photo Upload Checks', 'fail',
      `Error checking photo upload access: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 6. Final Forms Refresh (GitHub Actions trigger, separate from the Drive export credentials
  // the workflow itself uses). Read-only: this only fetches workflow metadata, it never dispatches.
  try {
    const ghToken = process.env.FINALFORMS_GITHUB_TOKEN;
    const ghRepo = process.env.FINALFORMS_GITHUB_REPO;
    const ghWorkflowFile = process.env.FINALFORMS_GITHUB_WORKFLOW_FILE;

    if (!ghToken || !ghRepo || !ghWorkflowFile) {
      addResult('Final Forms Refresh', 'GitHub Actions Trigger', 'warning',
        'FINALFORMS_GITHUB_TOKEN/REPO/WORKFLOW_FILE not fully set; the dashboard\'s manual refresh button is disabled (this is optional, everything else still works)');
    } else {
      const res = await fetch(
        `https://api.github.com/repos/${ghRepo}/actions/workflows/${ghWorkflowFile}`,
        {
          headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: 'application/vnd.github+json',
          },
        }
      );

      const ghHeaders = {
        Authorization: `Bearer ${ghToken}`,
        Accept: 'application/vnd.github+json',
      };

      if (res.ok) {
        const workflow = await res.json();
        addResult('Final Forms Refresh', 'GitHub Actions Trigger', 'pass',
          `Token can see "${workflow.name}" on ${ghRepo} (state: ${workflow.state})`);

        // Read access alone doesn't prove workflow_dispatch will work (that needs Actions:
        // write). Probe write permission without ever starting a real run: attempt to cancel
        // an already-*completed* run. GitHub checks permission before run state, so a token
        // without write access gets 403; one with write access gets 409 ("already completed")
        // since there's nothing to cancel — either way, no run is affected.
        try {
          const runsRes = await fetch(
            `https://api.github.com/repos/${ghRepo}/actions/workflows/${ghWorkflowFile}/runs?status=completed&per_page=1`,
            { headers: ghHeaders }
          );
          const runsData = runsRes.ok ? await runsRes.json() : null;
          const runId = runsData?.workflow_runs?.[0]?.id;

          if (!runId) {
            addResult('Final Forms Refresh', 'GitHub Actions Write Permission', 'warning',
              'No completed workflow run found yet to probe write access against; this will self-resolve after the first run');
          } else {
            const cancelRes = await fetch(
              `https://api.github.com/repos/${ghRepo}/actions/runs/${runId}/cancel`,
              { method: 'POST', headers: ghHeaders }
            );
            if (cancelRes.status === 409) {
              addResult('Final Forms Refresh', 'GitHub Actions Write Permission', 'pass',
                'Token has Actions: write (probed via cancel on a completed run, which GitHub rejected as already-finished rather than as unauthorized)');
            } else if (cancelRes.status === 403) {
              addResult('Final Forms Refresh', 'GitHub Actions Write Permission', 'fail',
                'FINALFORMS_GITHUB_TOKEN can read this workflow but lacks Actions: write, so the refresh button\'s workflow_dispatch call will fail. Check the fine-grained PAT\'s "Actions" permission is set to "Read and write"');
            } else {
              addResult('Final Forms Refresh', 'GitHub Actions Write Permission', 'warning',
                `Unexpected response probing write access (HTTP ${cancelRes.status}); verify manually before relying on this result`);
            }
          }
        } catch (error) {
          addResult('Final Forms Refresh', 'GitHub Actions Write Permission', 'warning',
            `Could not probe write access: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } else if (res.status === 401) {
        addResult('Final Forms Refresh', 'GitHub Actions Trigger', 'fail',
          'FINALFORMS_GITHUB_TOKEN was rejected (expired or revoked)');
      } else if (res.status === 403) {
        addResult('Final Forms Refresh', 'GitHub Actions Trigger', 'fail',
          'FINALFORMS_GITHUB_TOKEN lacks Actions permission on this repo, or the token\'s account is not a collaborator');
      } else if (res.status === 404) {
        addResult('Final Forms Refresh', 'GitHub Actions Trigger', 'fail',
          `Workflow not found: check FINALFORMS_GITHUB_REPO ("${ghRepo}") and FINALFORMS_GITHUB_WORKFLOW_FILE ("${ghWorkflowFile}")`);
      } else {
        addResult('Final Forms Refresh', 'GitHub Actions Trigger', 'fail',
          `Unexpected GitHub API response: ${res.status} ${res.statusText}`);
      }
    }
  } catch (error) {
    addResult('Final Forms Refresh', 'GitHub Actions Trigger', 'fail',
      `Error checking GitHub Actions access: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 7. Buttondown (optional). Read-only keys still list subscribers, so a GET-only
  // check would hide the failure mode Join / Leave actually hits. The write probe
  // PATCHes a reserved address that should not exist: 404 = can write, 403 = read-only.
  try {
    const probe = await probeButtondownPermissions();
    switch (probe.status) {
      case 'not-configured':
        addResult('Buttondown', 'API Key', 'warning',
          'BUTTONDOWN_API_KEY not set; newsletter Join / Leave and auto-subscribe are disabled (RSS team updates still work)');
        break;
      case 'no-access':
        addResult('Buttondown', 'API Key', 'fail', probe.message);
        break;
      case 'read-only':
        addResult('Buttondown', 'Subscriber Read', 'pass', 'Key can list subscribers');
        addResult('Buttondown', 'Subscriber Write', 'fail', probe.message);
        break;
      case 'full-access':
        addResult('Buttondown', 'Subscriber Read', 'pass', 'Key can list subscribers');
        addResult('Buttondown', 'Subscriber Write', 'pass', probe.message);
        break;
    }
  } catch (error) {
    addResult('Buttondown', 'API Key', 'fail',
      `Error checking Buttondown: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 8. System Checks
  try {
    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    if (majorVersion >= 24) {
      addResult('System', 'Node.js Version', 'pass', `Version ${nodeVersion} (24.x Active LTS required)`);
    } else {
      addResult('System', 'Node.js Version', 'warning', `Version ${nodeVersion} (24.x Active LTS required)`);
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