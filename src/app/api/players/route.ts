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
    // Fetch all data sources
    const [finalFormsData, mailingListData, questionnaireData] = await Promise.all([
      fetchFinalFormsData(),
      fetchMailingListData(),
      fetchQuestionnaireData()
    ]);

    if (!finalFormsData) {
      return NextResponse.json(
        { error: 'Failed to fetch Final Forms data' }, 
        { status: 500 }
      );
    }

    // Integrate all data sources
    const playerData = await integratePlayerData(
      finalFormsData,
      questionnaireData || [],
      mailingListData || []
    );

    // Calculate summary statistics
    const totalPlayers = playerData.length;
    const stats = {
      totalPlayers,
      caretakerSignedFinalForms: playerData.filter(p => p.hasCaretakerSignedFinalForms).length,
      playerSignedFinalForms: playerData.filter(p => p.hasPlayerSignedFinalForms).length,
      playerClearedPhysical: playerData.filter(p => p.hasPlayerClearedPhysical).length,
      caretakerFilledQuestionnaire: playerData.filter(p => p.hasCaretakerFilledQuestionnaire).length,
      caretaker1JoinedMailingList: playerData.filter(p => p.hasCaretaker1JoinedMailingList).length,
      caretaker2JoinedMailingList: playerData.filter(p => p.hasCaretaker2JoinedMailingList).length,
    };

    return NextResponse.json({
      players: playerData,
      statistics: stats,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Players API error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      players: [],
      statistics: null
    }, { status: 500 });
  }
}

async function fetchFinalFormsData() {
  try {
    const fileId = await getMostRecentFileFromFolder(
      process.env.SPS_FINAL_FORMS_FOLDER_ID!
    );
    if (!fileId) return null;
    
    const csvContent = await downloadCsvFromDrive(fileId);
    if (!csvContent) return null;
    
    return await parseSPSFinalForms(csvContent);
  } catch (error) {
    console.error('Error fetching Final Forms data:', error);
    return null;
  }
}

async function fetchMailingListData() {
  try {
    const fileId = await getMostRecentFileFromFolder(
      process.env.TEAM_MAILING_LIST_FOLDER_ID!
    );
    if (!fileId) return null;
    
    const csvContent = await downloadCsvFromDrive(fileId);
    if (!csvContent) return null;
    
    return await parseTeamMailingList(csvContent);
  } catch (error) {
    console.error('Error fetching Mailing List data:', error);
    return null;
  }
}

async function fetchQuestionnaireData() {
  try {
    const sheetData = await getSheetData(
      process.env.ADDITIONAL_QUESTIONNAIRE_SHEET_ID!
    );
    
    return parseQuestionnaireData(sheetData);
  } catch (error) {
    console.error('Error fetching Questionnaire data:', error);
    return null;
  }
}