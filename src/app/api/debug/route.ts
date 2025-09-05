import { NextResponse } from 'next/server';
import { 
  getSheetData, 
  getMostRecentFileInfoFromFolder,
  downloadCsvFromDrive 
} from '@/lib/google-api';
import { 
  parseSPSFinalForms, 
  parseTeamMailingList, 
  parseQuestionnaireData,
  findEmailInMailingList
} from '@/lib/data-processing';

export async function GET() {
  try {
    // Fetch all data sources
    const [finalFormsResult, mailingListResult] = await Promise.all([
      fetchFinalFormsDataWithTimestamp(),
      fetchMailingListDataWithTimestamp()
    ]);

    if (!finalFormsResult.data || !mailingListResult.data) {
      return NextResponse.json(
        { error: 'Failed to fetch data sources' }, 
        { status: 500 }
      );
    }

    const finalFormsData = finalFormsResult.data;
    const mailingListData = mailingListResult.data;

    // Collect all parent emails from Final Forms
    const allParentEmails: { email: string; playerName: string; parentType: string }[] = [];
    for (const record of finalFormsData) {
      const playerName = `${record.playerFirstName} ${record.playerLastName}`;
      
      if (record.caretaker1Email) {
        allParentEmails.push({
          email: record.caretaker1Email.toLowerCase(),
          playerName,
          parentType: 'Parent 1'
        });
      }
      
      if (record.caretaker2Email) {
        allParentEmails.push({
          email: record.caretaker2Email.toLowerCase(),
          playerName,
          parentType: 'Parent 2'
        });
      }
    }

    // Get all mailing list emails
    const mailingListEmails = mailingListData.map(record => ({
      email: record.email.toLowerCase(),
      nickname: record.nickname || '',
      status: record.status || ''
    }));

    // Find matched emails
    const matchedEmails: { email: string; playerName: string; parentType: string }[] = [];
    const parentEmailSet = new Set(allParentEmails.map(pe => pe.email));
    
    for (const mailingEmail of mailingListEmails) {
      const matchingParent = allParentEmails.find(pe => pe.email === mailingEmail.email);
      if (matchingParent) {
        matchedEmails.push(matchingParent);
      }
    }

    // Find unmatched emails (on mailing list but not in Final Forms)
    const unmatchedEmails = mailingListEmails.filter(mailingEmail => 
      !parentEmailSet.has(mailingEmail.email)
    );

    return NextResponse.json({
      unmatchedEmails,
      matchedEmails,
      totalMailingListEmails: mailingListData.length,
      totalPlayerEmails: allParentEmails.length
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      unmatchedEmails: [],
      matchedEmails: [],
      totalMailingListEmails: 0,
      totalPlayerEmails: 0
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
    return { data, timestamp: fileInfo.timestamp };
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
    return { data, timestamp: fileInfo.timestamp };
  } catch (error) {
    console.error('Error fetching Mailing List data:', error);
    return { data: null, timestamp: '' };
  }
}