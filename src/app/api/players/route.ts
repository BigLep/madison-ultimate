import { NextResponse } from 'next/server';
import { 
  getSheetData, 
  getMostRecentFileFromFolder, 
  getMostRecentFileInfoFromFolder,
  downloadCsvFromDrive 
} from '@/lib/google-api';
import { 
  parseSPSFinalForms, 
  parseTeamMailingList, 
  parseQuestionnaireData,
  integratePlayerData 
} from '@/lib/data-processing';
import { formatToPacificTime, getCurrentPacificTime } from '@/lib/date-utils';

export async function GET() {
  try {
    // Fetch all data sources with timestamp info
    const [finalFormsResult, mailingListResult, questionnaireResult] = await Promise.all([
      fetchFinalFormsDataWithTimestamp(),
      fetchMailingListDataWithTimestamp(),
      fetchQuestionnaireDataWithTimestamp()
    ]);

    if (!finalFormsResult.data) {
      return NextResponse.json(
        { error: 'Failed to fetch Final Forms data' }, 
        { status: 500 }
      );
    }

    // Integrate all data sources
    const playerData = await integratePlayerData(
      finalFormsResult.data,
      questionnaireResult.data || [],
      mailingListResult.data || []
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
      parentsOnMailingList: playerData.reduce((count, p) => {
        return count + (p.hasCaretaker1JoinedMailingList ? 1 : 0) + (p.hasCaretaker2JoinedMailingList ? 1 : 0);
      }, 0),
    };

    return NextResponse.json({
      players: playerData,
      statistics: stats,
      timestamps: {
        finalForms: finalFormsResult.timestamp,
        mailingList: mailingListResult.timestamp,
        questionnaire: questionnaireResult.timestamp
      },
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Players API error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      players: [],
      statistics: null,
      timestamps: null
    }, { status: 500 });
  }
}

async function fetchFinalFormsDataWithTimestamp() {
  try {
    const fileInfo = await getMostRecentFileInfoFromFolder(
      process.env.SPS_FINAL_FORMS_FOLDER_ID!
    );
    if (!fileInfo) return { data: null, timestamp: '' };
    
    const csvContent = await downloadCsvFromDrive(fileInfo.id);
    if (!csvContent) return { data: null, timestamp: '' };
    
    const data = await parseSPSFinalForms(csvContent);
    return { 
      data, 
      timestamp: formatToPacificTime(fileInfo.timestamp) 
    };
  } catch (error) {
    console.error('Error fetching Final Forms data:', error);
    return { data: null, timestamp: '' };
  }
}

async function fetchMailingListDataWithTimestamp() {
  try {
    const fileInfo = await getMostRecentFileInfoFromFolder(
      process.env.TEAM_MAILING_LIST_FOLDER_ID!
    );
    if (!fileInfo) return { data: null, timestamp: '' };
    
    const csvContent = await downloadCsvFromDrive(fileInfo.id);
    if (!csvContent) return { data: null, timestamp: '' };
    
    const data = await parseTeamMailingList(csvContent);
    return { 
      data, 
      timestamp: formatToPacificTime(fileInfo.timestamp) 
    };
  } catch (error) {
    console.error('Error fetching Mailing List data:', error);
    return { data: null, timestamp: '' };
  }
}

async function fetchQuestionnaireDataWithTimestamp() {
  try {
    const sheetData = await getSheetData(
      process.env.ADDITIONAL_QUESTIONNAIRE_SHEET_ID!
    );
    
    const data = parseQuestionnaireData(sheetData);
    return { 
      data, 
      timestamp: getCurrentPacificTime() 
    };
  } catch (error) {
    console.error('Error fetching Questionnaire data:', error);
    return { data: null, timestamp: '' };
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