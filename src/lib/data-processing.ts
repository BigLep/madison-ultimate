import csv from 'csv-parser';
import { Readable } from 'stream';
import * as levenshtein from 'fast-levenshtein';
import { 
  SPSFinalFormsRecord, 
  QuestionnaireRecord, 
  MailingListRecord, 
  PlayerSignupStatus,
  FuzzyMatchResult 
} from './types';

// CSV parsing utilities
export async function parseCsvString(csvContent: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const stream = Readable.from([csvContent]);
    
    stream
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

// Parse SPS Final Forms CSV export
export async function parseSPSFinalForms(csvContent: string): Promise<SPSFinalFormsRecord[]> {
  const rawData = await parseCsvString(csvContent);
  
  // Debug: Log first row to see available columns
  if (rawData.length > 0) {
    console.log('📋 Available Final Forms columns:', Object.keys(rawData[0]));
  }
  
  return rawData.map(row => ({
    // Player basic info
    playerFirstName: row['First Name'] || '',
    playerLastName: row['Last Name'] || '',
    playerGrade: row['Grade'] || '',
    playerGender: row['Gender'] || '',
    playerEmail: row['Email'] || '',
    playerDateOfBirth: row['Date of Birth'] || '',
    
    // Parent 1 info
    parent1FirstName: row['Parent 1 First Name'] || '',
    parent1LastName: row['Parent 1 Last Name'] || '',
    parent1Email: row['Parent 1 Email'] || '',
    
    // Parent 2 info
    parent2FirstName: row['Parent 2 First Name'] || '',
    parent2LastName: row['Parent 2 Last Name'] || '',
    parent2Email: row['Parent 2 Email'] || '',
    
    // Status fields
    parentsSignedStatus: row['Are All Forms Parent Signed'] === 'true',
    studentsSignedStatus: row['Are All Forms Student Signed'] === 'true',
    physicalClearanceStatus: row['Physical Clearance'] === 'Cleared',
    
    // Legacy fields for backward compatibility
    caretaker1Email: row['Parent 1 Email'] || row['Email'] || '',
    caretaker2Email: row['Parent 2 Email'] || ''
  }));
}

// Parse Team Mailing List CSV export  
export async function parseTeamMailingList(csvContent: string): Promise<MailingListRecord[]> {
  // Remove the first line "Members for group madisonultimatefall25" before parsing
  const lines = csvContent.split('\n');
  const csvWithoutFirstLine = lines.slice(1).join('\n'); // Skip first line
  
  const rawData = await parseCsvString(csvWithoutFirstLine);
  
  // Filter out any invalid rows
  const dataRows = rawData.filter(row => 
    row['Email address'] && 
    row['Email address'] !== 'Email address' &&
    row['Email address'].includes('@') // Must be a valid email
  );
  
  return dataRows.map(row => ({
    email: row['Email address'] || '',
    name: row['Nickname'] || '',
    joinedDate: `${row['Join year']}-${row['Join month']}-${row['Join day']}`
  }));
}

// Parse Additional Questionnaire from Google Sheets
export function parseQuestionnaireData(sheetData: string[][]): QuestionnaireRecord[] {
  if (sheetData.length < 2) return []; // Need at least header + 1 data row
  
  const headers = sheetData[0];
  const dataRows = sheetData.slice(1);
  
  // Debug: Log available questionnaire columns
  console.log('📋 Available Questionnaire columns:', headers);
  
  // Find column indices
  const timestampIndex = headers.findIndex(h => h.toLowerCase().includes('timestamp'));
  const playerNameIndex = headers.findIndex(h => h.toLowerCase().includes('player name'));
  const pronounIndex = headers.findIndex(h => 
    h.toLowerCase().includes('pronoun') || 
    h.toLowerCase().includes('pronouns') ||
    h.toLowerCase().includes('player pronouns')
  );
  
  console.log(`📋 Column indices: timestamp=${timestampIndex}, playerName=${playerNameIndex}, pronouns=${pronounIndex}`);
  
  return dataRows.map(row => {
    const playerName = row[playerNameIndex] || '';
    const [firstName, ...lastNameParts] = playerName.split(' ');
    
    return {
      playerFirstName: firstName || '',
      playerLastName: lastNameParts.join(' ') || '',
      caretakerEmail: '', // Would need to extract from form if available
      submissionTimestamp: row[timestampIndex] || '',
      pronouns: row[pronounIndex] || ''
    };
  });
}

// Fuzzy matching utilities
export function calculateNameSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) return 0;
  
  const normalized1 = name1.toLowerCase().trim();
  const normalized2 = name2.toLowerCase().trim();
  
  if (normalized1 === normalized2) return 1.0;
  
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const distance = levenshtein.get(normalized1, normalized2);
  
  return Math.max(0, (maxLength - distance) / maxLength);
}

export function fuzzyMatchPlayer(
  targetFirstName: string, 
  targetLastName: string, 
  candidates: Array<{firstName: string, lastName: string}>
): FuzzyMatchResult {
  let bestMatch: FuzzyMatchResult = { match: false, confidence: 0 };
  
  for (const candidate of candidates) {
    const firstNameSim = calculateNameSimilarity(targetFirstName, candidate.firstName);
    const lastNameSim = calculateNameSimilarity(targetLastName, candidate.lastName);
    
    // Combined confidence score (weighted towards last name)
    const confidence = (firstNameSim * 0.3) + (lastNameSim * 0.7);
    
    if (confidence > bestMatch.confidence) {
      bestMatch = {
        match: confidence > 0.8, // 80% similarity threshold
        confidence,
        matchedName: `${candidate.firstName} ${candidate.lastName}`
      };
    }
  }
  
  return bestMatch;
}

// Email matching utility
export function findEmailInMailingList(
  emails: string[], 
  mailingList: MailingListRecord[]
): { email: string; found: boolean }[] {
  const mailingEmails = mailingList.map(record => record.email.toLowerCase());
  
  return emails.map(email => ({
    email,
    found: mailingEmails.includes(email.toLowerCase())
  }));
}

// Main data integration function
export async function integratePlayerData(
  finalFormsData: SPSFinalFormsRecord[],
  questionnaireData: QuestionnaireRecord[],
  mailingListData: MailingListRecord[]
): Promise<PlayerSignupStatus[]> {
  const integratedData: PlayerSignupStatus[] = [];
  
  // Use Final Forms as the primary source since it has the most complete player info
  for (const finalFormsRecord of finalFormsData) {
    // Find matching questionnaire record
    const questionnaireMatch = fuzzyMatchPlayer(
      finalFormsRecord.playerFirstName,
      finalFormsRecord.playerLastName,
      questionnaireData.map(q => ({
        firstName: q.playerFirstName,
        lastName: q.playerLastName
      }))
    );
    
    // Check if caretaker emails are in mailing list
    const emailsToCheck = [finalFormsRecord.caretaker1Email];
    if (finalFormsRecord.caretaker2Email) {
      emailsToCheck.push(finalFormsRecord.caretaker2Email);
    }
    
    const emailMatches = findEmailInMailingList(emailsToCheck, mailingListData);
    
    const playerStatus: PlayerSignupStatus = {
      firstName: finalFormsRecord.playerFirstName,
      lastName: finalFormsRecord.playerLastName,
      grade: finalFormsRecord.playerGrade,
      gender: finalFormsRecord.playerGender,
      hasCaretakerSignedFinalForms: finalFormsRecord.parentsSignedStatus,
      hasPlayerSignedFinalForms: finalFormsRecord.studentsSignedStatus,
      hasPlayerClearedPhysical: finalFormsRecord.physicalClearanceStatus,
      hasCaretakerFilledQuestionnaire: questionnaireMatch.match && questionnaireMatch.confidence > 0.8,
      hasCaretaker1JoinedMailingList: emailMatches[0]?.found || false,
      hasCaretaker2JoinedMailingList: emailMatches[1]?.found || false
    };
    
    integratedData.push(playerStatus);
  }
  
  return integratedData;
}