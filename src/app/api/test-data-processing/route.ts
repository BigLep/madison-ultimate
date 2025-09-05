import { NextResponse } from 'next/server';
import { 
  getSheetData, 
  getMostRecentFileFromFolder, 
  downloadCsvFromDrive 
} from '@/lib/google-api';
import { 
  parseSPSFinalForms, 
  parseTeamMailingList, 
  parseQuestionnaireData,
  integratePlayerData 
} from '@/lib/data-processing';

export async function GET() {
  try {
    const results: any = {
      timestamp: new Date().toISOString(),
      steps: {},
      errors: []
    };

    // Step 1: Fetch SPS Final Forms data
    console.log('Fetching SPS Final Forms data...');
    try {
      const finalFormsFileId = await getMostRecentFileFromFolder(
        process.env.SPS_FINAL_FORMS_FOLDER_ID!
      );
      
      if (!finalFormsFileId) {
        throw new Error('No Final Forms file found');
      }
      
      const finalFormsCsvContent = await downloadCsvFromDrive(finalFormsFileId);
      if (!finalFormsCsvContent) {
        throw new Error('Failed to download Final Forms CSV');
      }
      
      const finalFormsData = await parseSPSFinalForms(finalFormsCsvContent);
      
      results.steps.finalForms = {
        success: true,
        fileId: finalFormsFileId,
        recordCount: finalFormsData.length,
        sampleRecord: finalFormsData[0]
      };
      
      console.log(`✅ Processed ${finalFormsData.length} Final Forms records`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.steps.finalForms = { success: false, error: errorMsg };
      results.errors.push(`Final Forms: ${errorMsg}`);
    }

    // Step 2: Fetch Team Mailing List data
    console.log('Fetching Team Mailing List data...');
    try {
      const mailingListFileId = await getMostRecentFileFromFolder(
        process.env.TEAM_MAILING_LIST_FOLDER_ID!
      );
      
      if (!mailingListFileId) {
        throw new Error('No Mailing List file found');
      }
      
      const mailingListCsvContent = await downloadCsvFromDrive(mailingListFileId);
      if (!mailingListCsvContent) {
        throw new Error('Failed to download Mailing List CSV');
      }
      
      const mailingListData = await parseTeamMailingList(mailingListCsvContent);
      
      results.steps.mailingList = {
        success: true,
        fileId: mailingListFileId,
        recordCount: mailingListData.length,
        sampleRecord: mailingListData[0]
      };
      
      console.log(`✅ Processed ${mailingListData.length} Mailing List records`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.steps.mailingList = { success: false, error: errorMsg };
      results.errors.push(`Mailing List: ${errorMsg}`);
    }

    // Step 3: Fetch Additional Questionnaire data
    console.log('Fetching Additional Questionnaire data...');
    try {
      const questionnaireSheetData = await getSheetData(
        process.env.ADDITIONAL_QUESTIONNAIRE_SHEET_ID!
      );
      
      const questionnaireData = parseQuestionnaireData(questionnaireSheetData);
      
      results.steps.questionnaire = {
        success: true,
        recordCount: questionnaireData.length,
        sampleRecord: questionnaireData[0]
      };
      
      console.log(`✅ Processed ${questionnaireData.length} Questionnaire records`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      results.steps.questionnaire = { success: false, error: errorMsg };
      results.errors.push(`Questionnaire: ${errorMsg}`);
    }

    // Step 4: Integrate data if all sources were successful
    if (results.steps.finalForms?.success && 
        results.steps.mailingList?.success && 
        results.steps.questionnaire?.success) {
      
      console.log('Integrating player data...');
      try {
        // Re-fetch the data for integration (in a real app, we'd cache this)
        const finalFormsFileId = await getMostRecentFileFromFolder(
          process.env.SPS_FINAL_FORMS_FOLDER_ID!
        );
        const finalFormsCsvContent = await downloadCsvFromDrive(finalFormsFileId!);
        const finalFormsData = await parseSPSFinalForms(finalFormsCsvContent!);

        const mailingListFileId = await getMostRecentFileFromFolder(
          process.env.TEAM_MAILING_LIST_FOLDER_ID!
        );
        const mailingListCsvContent = await downloadCsvFromDrive(mailingListFileId!);
        const mailingListData = await parseTeamMailingList(mailingListCsvContent!);

        const questionnaireSheetData = await getSheetData(
          process.env.ADDITIONAL_QUESTIONNAIRE_SHEET_ID!
        );
        const questionnaireData = parseQuestionnaireData(questionnaireSheetData);

        const integratedPlayerData = await integratePlayerData(
          finalFormsData,
          questionnaireData,
          mailingListData
        );

        results.steps.integration = {
          success: true,
          playerCount: integratedPlayerData.length,
          samplePlayer: integratedPlayerData[0],
          completionStats: {
            hasCaretakerSignedFinalForms: integratedPlayerData.filter(p => p.hasCaretakerSignedFinalForms).length,
            hasPlayerSignedFinalForms: integratedPlayerData.filter(p => p.hasPlayerSignedFinalForms).length,
            hasPlayerClearedPhysical: integratedPlayerData.filter(p => p.hasPlayerClearedPhysical).length,
            hasCaretakerFilledQuestionnaire: integratedPlayerData.filter(p => p.hasCaretakerFilledQuestionnaire).length,
            hasCaretaker1JoinedMailingList: integratedPlayerData.filter(p => p.hasCaretaker1JoinedMailingList).length
          }
        };

        console.log(`✅ Integrated data for ${integratedPlayerData.length} players`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.steps.integration = { success: false, error: errorMsg };
        results.errors.push(`Integration: ${errorMsg}`);
      }
    } else {
      results.steps.integration = { 
        success: false, 
        error: 'Skipped due to previous step failures' 
      };
    }

    // Overall success
    results.overallSuccess = results.errors.length === 0;

    return NextResponse.json(results);
  } catch (error) {
    console.error('Data processing test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}