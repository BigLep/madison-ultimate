import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { 
  getSheetData, 
  getMostRecentFileFromFolder, 
  downloadCsvFromDrive 
} from '@/lib/google-api';

export async function GET() {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      cached: {}
    };

    const tmpDir = join(process.cwd(), 'tmp');

    // Cache SPS Final Forms CSV
    console.log('Caching SPS Final Forms data...');
    const finalFormsFileId = await getMostRecentFileFromFolder(
      process.env.SPS_FINAL_FORMS_FOLDER_ID!
    );
    
    if (finalFormsFileId) {
      const finalFormsCsvContent = await downloadCsvFromDrive(finalFormsFileId);
      if (finalFormsCsvContent) {
        const finalFormsPath = join(tmpDir, 'sps-final-forms.csv');
        await writeFile(finalFormsPath, finalFormsCsvContent);
        results.cached.finalForms = {
          success: true,
          fileId: finalFormsFileId,
          path: finalFormsPath,
          size: finalFormsCsvContent.length
        };
        console.log(`✅ Cached Final Forms to ${finalFormsPath}`);
      }
    }

    // Cache Team Mailing List CSV
    console.log('Caching Team Mailing List data...');
    const mailingListFileId = await getMostRecentFileFromFolder(
      process.env.TEAM_MAILING_LIST_FOLDER_ID!
    );
    
    if (mailingListFileId) {
      const mailingListCsvContent = await downloadCsvFromDrive(mailingListFileId);
      if (mailingListCsvContent) {
        const mailingListPath = join(tmpDir, 'team-mailing-list.csv');
        await writeFile(mailingListPath, mailingListCsvContent);
        results.cached.mailingList = {
          success: true,
          fileId: mailingListFileId,
          path: mailingListPath,
          size: mailingListCsvContent.length
        };
        console.log(`✅ Cached Mailing List to ${mailingListPath}`);
      }
    }

    // Cache Additional Questionnaire data (as JSON)
    console.log('Caching Additional Questionnaire data...');
    const questionnaireSheetData = await getSheetData(
      process.env.ADDITIONAL_QUESTIONNAIRE_SHEET_ID!
    );
    
    if (questionnaireSheetData.length > 0) {
      const questionnairePath = join(tmpDir, 'additional-questionnaire.json');
      await writeFile(questionnairePath, JSON.stringify(questionnaireSheetData, null, 2));
      results.cached.questionnaire = {
        success: true,
        path: questionnairePath,
        rows: questionnaireSheetData.length
      };
      console.log(`✅ Cached Questionnaire to ${questionnairePath}`);
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Cache data error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}