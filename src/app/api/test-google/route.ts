import { NextResponse } from 'next/server';
import { getSheetData, getMostRecentFileFromFolder, downloadCsvFromDrive } from '@/lib/google-api';

export async function GET() {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: Google Sheets API - Additional Questionnaire
    console.log('Testing Google Sheets API...');
    try {
      const sheetData = await getSheetData(process.env.ADDITIONAL_QUESTIONNAIRE_SHEET_ID!, 'A1:Z10');
      results.tests.googleSheets = {
        success: true,
        rowCount: sheetData.length,
        sampleData: sheetData.slice(0, 3), // First 3 rows for preview
      };
      console.log('✅ Google Sheets API working');
    } catch (error) {
      results.tests.googleSheets = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.error('❌ Google Sheets API failed:', error);
    }

    // Test 2: Google Drive API - SPS Final Forms folder
    console.log('Testing Google Drive API (SPS Final Forms)...');
    try {
      const mostRecentFileId = await getMostRecentFileFromFolder(process.env.SPS_FINAL_FORMS_FOLDER_ID!);
      results.tests.driveSpsFinalForms = {
        success: !!mostRecentFileId,
        fileId: mostRecentFileId,
      };
      
      if (mostRecentFileId) {
        // Try to download a small portion of the CSV
        const csvContent = await downloadCsvFromDrive(mostRecentFileId);
        results.tests.driveSpsFinalForms.csvPreview = csvContent?.substring(0, 500) + '...';
        console.log('✅ SPS Final Forms Drive access working');
      }
    } catch (error) {
      results.tests.driveSpsFinalForms = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.error('❌ SPS Final Forms Drive API failed:', error);
    }

    // Test 3: Google Drive API - Team Mailing List folder
    console.log('Testing Google Drive API (Team Mailing List)...');
    try {
      const mostRecentFileId = await getMostRecentFileFromFolder(process.env.TEAM_MAILING_LIST_FOLDER_ID!);
      results.tests.driveMailingList = {
        success: !!mostRecentFileId,
        fileId: mostRecentFileId,
      };
      
      if (mostRecentFileId) {
        const csvContent = await downloadCsvFromDrive(mostRecentFileId);
        results.tests.driveMailingList.csvPreview = csvContent?.substring(0, 500) + '...';
        console.log('✅ Team Mailing List Drive access working');
      }
    } catch (error) {
      results.tests.driveMailingList = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      console.error('❌ Team Mailing List Drive API failed:', error);
    }

    // Overall success check
    const allTestsPassed = Object.values(results.tests).every((test: any) => test.success);
    results.overallSuccess = allTestsPassed;

    return NextResponse.json(results);
  } catch (error) {
    console.error('Test API route error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}