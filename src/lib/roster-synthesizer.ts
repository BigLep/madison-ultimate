import { getRosterMetadata, getRosterData, parseDataSourceMapping, type RosterColumnMetadata } from './roster-metadata';
import { updateSheetData, appendSheetData, getMostRecentFileInfoFromFolder, downloadCsvFromDrive, getSheetData } from './google-api';
import { ROSTER_SHEET_ID } from './roster-metadata';
import CacheManager from './cache-manager';
import { parseSPSFinalForms, parseTeamMailingList, parseQuestionnaireData } from './data-processing';
import type { PlayerSignupStatus, SPSFinalFormsRecord, MailingListRecord, QuestionnaireRecord } from './types';

export interface RosterSynthesisResult {
  newPlayersAdded: number;
  existingPlayersUpdated: number;
  orphanedPlayers: string[]; // Players on roster but not in Final Forms
  sourceFileInfo: {
    spsFormsFile: string;
    mailingListFile: string;
    questionnaireSheetId: string;
  };
  changes: RosterChangeLog[];
}

export interface RosterChangeLog {
  playerName: string;
  action: 'added' | 'updated' | 'skipped';
  changes: Record<string, { old: string; new: string }>;
  reason?: string;
}

interface RosterPlayer {
  firstName: string;
  lastName: string;
  fullName: string;
  rowIndex: number;
  data: Record<string, any>;
}

export class RosterSynthesizer {
  private metadata: any;
  private existingRosterData: any[][];
  private sourceData: PlayerSignupStatus[];
  private rawFinalFormsData: SPSFinalFormsRecord[];
  private rawQuestionnaireData: QuestionnaireRecord[];
  private rawMailingListData: MailingListRecord[];
  
  constructor() {
    this.metadata = null;
    this.existingRosterData = [];
    this.sourceData = [];
    this.rawFinalFormsData = [];
    this.rawQuestionnaireData = [];
    this.rawMailingListData = [];
  }

  async initialize(): Promise<void> {
    // Load roster metadata and existing data
    this.metadata = await getRosterMetadata();
    this.existingRosterData = await getRosterData();
    
    // Load integrated data for player matching
    const cacheManager = CacheManager.getInstance();
    const cachedData = await cacheManager.getIntegratedData();
    
    if (!cachedData || !cachedData.players) {
      throw new Error('Failed to fetch integrated player data');
    }
    
    this.sourceData = cachedData.players;
    
    // Load raw data sources for complete field mapping
    await this.loadRawDataSources();
  }
  
  private async loadRawDataSources(): Promise<void> {
    console.log('🔄 Loading raw data sources for complete field mapping...');
    
    // Load Final Forms data
    const finalFormsFolder = process.env.SPS_FINAL_FORMS_FOLDER_ID;
    if (finalFormsFolder) {
      const finalFormsFileInfo = await getMostRecentFileInfoFromFolder(finalFormsFolder);
      if (finalFormsFileInfo) {
        console.log(`📊 Using Final Forms file: ${finalFormsFileInfo.name} (${finalFormsFileInfo.timestamp})`);
        const finalFormsCsv = await downloadCsvFromDrive(finalFormsFileInfo.id);
        if (finalFormsCsv) {
          this.rawFinalFormsData = await parseSPSFinalForms(finalFormsCsv);
          console.log(`📄 Loaded ${this.rawFinalFormsData.length} Final Forms records from ${finalFormsFileInfo.name}`);
        }
      }
    }
    
    // Load Questionnaire data
    const questionnaireSheetId = process.env.ADDITIONAL_QUESTIONNAIRE_SHEET_ID;
    if (questionnaireSheetId) {
      const questionnaireData = await getSheetData(questionnaireSheetId);
      this.rawQuestionnaireData = parseQuestionnaireData(questionnaireData);
      console.log(`📄 Loaded ${this.rawQuestionnaireData.length} Questionnaire records`);
    }
    
    // Load Mailing List data
    const mailingListFolder = process.env.TEAM_MAILING_LIST_FOLDER_ID;
    if (mailingListFolder) {
      const mailingListFileInfo = await getMostRecentFileInfoFromFolder(mailingListFolder);
      if (mailingListFileInfo) {
        const mailingListCsv = await downloadCsvFromDrive(mailingListFileInfo.id);
        if (mailingListCsv) {
          this.rawMailingListData = await parseTeamMailingList(mailingListCsv);
          console.log(`📄 Loaded ${this.rawMailingListData.length} Mailing List records`);
        }
      }
    }
  }

  async synthesizeRoster(): Promise<RosterSynthesisResult> {
    await this.initialize();

    const result: RosterSynthesisResult = {
      newPlayersAdded: 0,
      existingPlayersUpdated: 0,
      orphanedPlayers: [],
      sourceFileInfo: {
        spsFormsFile: 'SPS Final Forms (most recent)',
        mailingListFile: 'Team Mailing List (most recent)', 
        questionnaireSheetId: process.env.ADDITIONAL_QUESTIONNAIRE_SHEET_ID || '',
      },
      changes: [],
    };

    // Parse existing roster players
    const existingPlayers = this.parseExistingRosterPlayers();
    console.log(`🔍 Found ${existingPlayers.length} existing players in roster sheet`);
    
    // Find orphaned players (on roster but not in source data)
    result.orphanedPlayers = this.findOrphanedPlayers(existingPlayers);

    // Process each player from source data
    const updatedRows: any[][] = [];
    const newRows: any[][] = [];

    for (const sourcePlayer of this.sourceData) {
      const existingPlayer = this.findMatchingPlayer(sourcePlayer, existingPlayers);
      
      if (existingPlayer) {
        // Update existing player
        const updatedRow = this.buildPlayerRow(sourcePlayer, existingPlayer);
        const changeLog = this.comparePlayerData(existingPlayer, updatedRow, sourcePlayer);
        
        if (changeLog.changes && Object.keys(changeLog.changes).length > 0) {
          updatedRows[existingPlayer.rowIndex] = updatedRow;
          result.existingPlayersUpdated++;
          result.changes.push(changeLog);
        } else {
          result.changes.push({
            playerName: sourcePlayer.firstName + ' ' + sourcePlayer.lastName,
            action: 'skipped',
            changes: {},
            reason: 'No changes needed',
          });
        }
      } else {
        // Add new player
        console.log(`➕ Adding new player: ${sourcePlayer.firstName} ${sourcePlayer.lastName}`);
        const newRow = this.buildPlayerRow(sourcePlayer, null);
        console.log(`📋 New row data:`, newRow.slice(0, 5)); // Log first 5 fields
        newRows.push(newRow);
        result.newPlayersAdded++;
        result.changes.push({
          playerName: sourcePlayer.firstName + ' ' + sourcePlayer.lastName,
          action: 'added',
          changes: {},
        });
      }
    }
    
    console.log(`📊 Processing summary: ${result.newPlayersAdded} new players, ${result.existingPlayersUpdated} updates`);

    // Apply changes to Google Sheets
    await this.applyChangesToSheet(updatedRows, newRows);

    return result;
  }

  private parseExistingRosterPlayers(): RosterPlayer[] {
    const players: RosterPlayer[] = [];
    
    for (let i = 0; i < this.existingRosterData.length; i++) {
      const row = this.existingRosterData[i];
      if (!row || row.length === 0) continue;

      // Find first name and last name columns
      const firstNameCol = this.findColumnByName('First Name') || this.findColumnByName('Player First Name');
      const lastNameCol = this.findColumnByName('Last Name') || this.findColumnByName('Player Last Name');
      
      if (firstNameCol === -1 || lastNameCol === -1) continue;

      const firstName = row[firstNameCol]?.toString().trim() || '';
      const lastName = row[lastNameCol]?.toString().trim() || '';
      
      if (!firstName && !lastName) continue;

      const playerData: Record<string, any> = {};
      this.metadata.columns.forEach((col: RosterColumnMetadata, index: number) => {
        playerData[col.columnName] = row[col.columnIndex] || '';
      });

      players.push({
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        rowIndex: i,
        data: playerData,
      });
    }

    return players;
  }

  private findMatchingPlayer(sourcePlayer: PlayerSignupStatus, existingPlayers: RosterPlayer[]): RosterPlayer | null {
    const sourceFullName = `${sourcePlayer.firstName} ${sourcePlayer.lastName}`.toLowerCase();
    
    // Try exact match first
    for (const player of existingPlayers) {
      if (player.fullName.toLowerCase() === sourceFullName) {
        return player;
      }
    }

    // Try fuzzy match (using same logic as Stage 1)
    for (const player of existingPlayers) {
      const similarity = this.calculateNameSimilarity(sourceFullName, player.fullName.toLowerCase());
      if (similarity > 0.8) { // 80% confidence threshold
        return player;
      }
    }

    return null;
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(name1, name2);
    const maxLength = Math.max(name1.length, name2.length);
    return maxLength === 0 ? 1 : (maxLength - distance) / maxLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private buildPlayerRow(sourcePlayer: PlayerSignupStatus, existingPlayer: RosterPlayer | null): any[] {
    const row: any[] = new Array(this.metadata.columns.length).fill('');

    for (const column of this.metadata.columns) {
      // Always use source data - no human editable fields
      const value = this.mapSourceDataToColumn(sourcePlayer, column);
      row[column.columnIndex] = value;
      
      // Debug: Log first player's mappings
      if (sourcePlayer.firstName === 'Donovan') {
        console.log(`🔍 ${column.columnName}: "${value}" (source: ${column.source})`);
      }
    }

    return row;
  }


  private mapSourceDataToColumn(sourcePlayer: PlayerSignupStatus, column: RosterColumnMetadata): string {
    const mapping = parseDataSourceMapping(column.source);
    if (!mapping) return '';

    const dataSource = mapping.dataSource.toLowerCase();
    const sourceColumn = mapping.sourceColumn || column.columnName;

    // Find matching raw Final Forms record for this player
    const finalFormsRecord = this.findFinalFormsRecord(sourcePlayer);
    
    // Map from raw source data based on data source
    if (dataSource.includes('finalforms') || dataSource.includes('final forms') || dataSource.includes('sps final forms')) {
      return this.mapFromFinalForms(finalFormsRecord, sourceColumn);
    } else if (dataSource.includes('additionalinfoform') || dataSource.includes('additional questionnaire') || dataSource.includes('questionnaire')) {
      return this.mapFromQuestionnaire(sourcePlayer, finalFormsRecord, sourceColumn);
    } else if (dataSource.includes('mailinglist') || dataSource.includes('mailing list')) {
      return this.mapFromMailingList(finalFormsRecord, sourceColumn);
    }

    return '';
  }

  private findFinalFormsRecord(sourcePlayer: PlayerSignupStatus): SPSFinalFormsRecord | null {
    // Find matching Final Forms record by name
    const match = this.rawFinalFormsData.find(record => 
      record.playerFirstName === sourcePlayer.firstName && 
      record.playerLastName === sourcePlayer.lastName
    ) || null;
    
    // Debug: Log the first match to see data structure
    if (match && sourcePlayer.firstName === 'Donovan') {
      console.log('🔍 Final Forms Record for Donovan:', {
        playerFirstName: match.playerFirstName,
        playerLastName: match.playerLastName,
        playerEmail: match.playerEmail,
        parent1FirstName: match.parent1FirstName,
        parent1LastName: match.parent1LastName,
        parent1Email: match.parent1Email,
        parent2FirstName: match.parent2FirstName,
        parent2LastName: match.parent2LastName,
        parent2Email: match.parent2Email
      });
    }
    
    return match;
  }

  private mapFromFinalForms(finalFormsRecord: SPSFinalFormsRecord | null, sourceColumn: string): string {
    if (!finalFormsRecord) return '';
    
    const columnLower = sourceColumn.toLowerCase();
    
    // Player basic info (be specific to avoid matching parent fields)
    if (columnLower.includes('first name') && !columnLower.includes('parent')) return finalFormsRecord.playerFirstName;
    if (columnLower.includes('last name') && !columnLower.includes('parent')) return finalFormsRecord.playerLastName;
    if (columnLower.includes('grade')) return finalFormsRecord.playerGrade;
    if (columnLower.includes('gender')) return finalFormsRecord.playerGender;
    if (columnLower.includes('date of birth')) return finalFormsRecord.playerDateOfBirth;
    
    // Student email categorization
    if (columnLower.includes('student sps email')) {
      return finalFormsRecord.playerEmail.endsWith('@seattleschools.org') ? finalFormsRecord.playerEmail : '';
    }
    if (columnLower.includes('student personal email') && !columnLower.includes('mailing list')) {
      const email = finalFormsRecord.playerEmail;
      // Only set if it's not SPS and not used as a parent email
      if (!email.endsWith('@seattleschools.org') && 
          email !== finalFormsRecord.parent1Email && 
          email !== finalFormsRecord.parent2Email) {
        return email;
      }
      return '';
    }
    
    // Parent 1 info
    if (columnLower.includes('parent 1 first name')) return finalFormsRecord.parent1FirstName;
    if (columnLower.includes('parent 1 last name')) return finalFormsRecord.parent1LastName;
    if (columnLower.includes('parent 1 email')) return finalFormsRecord.parent1Email;
    
    // Parent 2 info
    if (columnLower.includes('parent 2 first name')) return finalFormsRecord.parent2FirstName || '';
    if (columnLower.includes('parent 2 last name')) return finalFormsRecord.parent2LastName || '';
    if (columnLower.includes('parent 2 email')) return finalFormsRecord.parent2Email || '';
    
    // Status fields
    if (columnLower.includes('caretaker signed') || columnLower.includes('parent signed')) {
      return finalFormsRecord.parentsSignedStatus ? 'TRUE' : 'FALSE';
    }
    if (columnLower.includes('student signed') || columnLower.includes('player signed')) {
      return finalFormsRecord.studentsSignedStatus ? 'TRUE' : 'FALSE';
    }
    if (columnLower.includes('physical cleared') || columnLower.includes('physical clearance')) {
      return finalFormsRecord.physicalClearanceStatus ? 'TRUE' : 'FALSE';
    }

    return '';
  }

  private mapFromQuestionnaire(sourcePlayer: PlayerSignupStatus, finalFormsRecord: SPSFinalFormsRecord | null, sourceColumn: string): string {
    // Find matching questionnaire record
    const questionnaireRecord = this.rawQuestionnaireData.find(record =>
      record.playerFirstName === sourcePlayer.firstName &&
      record.playerLastName === sourcePlayer.lastName
    );
    
    if (!questionnaireRecord) return '';
    
    const columnLower = sourceColumn.toLowerCase();
    
    // Extract specific questionnaire fields
    if (columnLower.includes('pronoun')) {
      return questionnaireRecord.pronouns || '';
    }
    
    // For other questionnaire fields, return if questionnaire was filled
    return questionnaireRecord ? 'TRUE' : 'FALSE';
  }

  private mapFromMailingList(finalFormsRecord: SPSFinalFormsRecord | null, sourceColumn: string): string {
    if (!finalFormsRecord) return '';
    
    const columnLower = sourceColumn.toLowerCase();
    const mailingEmails = this.rawMailingListData.map(record => record.email.toLowerCase());
    
    // Check Parent 1 email
    if (columnLower.includes('parent 1')) {
      const parent1Email = finalFormsRecord.parent1Email.toLowerCase();
      return mailingEmails.includes(parent1Email) ? 'TRUE' : 'FALSE';
    }
    
    // Check Parent 2 email
    if (columnLower.includes('parent 2')) {
      const parent2Email = (finalFormsRecord.parent2Email || '').toLowerCase();
      return parent2Email && mailingEmails.includes(parent2Email) ? 'TRUE' : 'FALSE';
    }
    
    // Check student email
    if (columnLower.includes('student')) {
      const studentEmail = finalFormsRecord.playerEmail.toLowerCase();
      return mailingEmails.includes(studentEmail) ? 'TRUE' : 'FALSE';
    }

    return '';
  }

  private comparePlayerData(existingPlayer: RosterPlayer, updatedRow: any[], sourcePlayer: PlayerSignupStatus): RosterChangeLog {
    const changes: Record<string, { old: string; new: string }> = {};

    for (const column of this.metadata.columns) {
      const oldValue = (existingPlayer.data[column.columnName] || '').toString();
      const newValue = (updatedRow[column.columnIndex] || '').toString();
      
      if (oldValue !== newValue) {
        changes[column.columnName] = { old: oldValue, new: newValue };
      }
    }

    return {
      playerName: sourcePlayer.firstName + ' ' + sourcePlayer.lastName,
      action: 'updated',
      changes,
    };
  }

  private findOrphanedPlayers(existingPlayers: RosterPlayer[]): string[] {
    const orphaned: string[] = [];

    for (const player of existingPlayers) {
      const matchingSource = this.sourceData.find(sp => 
        this.calculateNameSimilarity(
          `${sp.firstName} ${sp.lastName}`.toLowerCase(),
          player.fullName.toLowerCase()
        ) > 0.8
      );

      if (!matchingSource) {
        orphaned.push(player.fullName);
      }
    }

    return orphaned;
  }

  private findColumnByName(columnName: string): number {
    const column = this.metadata.columns.find((col: RosterColumnMetadata) => 
      col.columnName.toLowerCase().includes(columnName.toLowerCase())
    );
    return column ? column.columnIndex : -1;
  }

  private async applyChangesToSheet(updatedRows: any[][], newRows: any[][]): Promise<void> {
    console.log(`🔧 Applying changes: ${updatedRows.length} updates, ${newRows.length} new rows`);
    
    // Rate limiting configuration
    const BATCH_SIZE = 10; // Process 10 rows at a time
    const DELAY_BETWEEN_BATCHES_MS = 2000; // 2 second delay between batches
    const DELAY_BETWEEN_INDIVIDUAL_UPDATES_MS = 100; // 100ms delay between individual updates
    
    // Helper function to add delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Apply updates to existing rows with rate limiting
    if (updatedRows.length > 0) {
      console.log(`🚀 Processing ${updatedRows.length} row updates with rate limiting...`);
      
      for (let batchStart = 0; batchStart < updatedRows.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, updatedRows.length);
        const batch = updatedRows.slice(batchStart, batchEnd);
        
        console.log(`📦 Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(updatedRows.length / BATCH_SIZE)} (rows ${batchStart + 1}-${batchEnd})`);
        
        // Process batch with individual delays
        for (let i = 0; i < batch.length; i++) {
          const globalIndex = batchStart + i;
          if (batch[i]) {
            const range = `A${this.metadata.dataStartRow + globalIndex}:Z${this.metadata.dataStartRow + globalIndex}`;
            console.log(`📝 Updating row ${globalIndex + this.metadata.dataStartRow} (${i + 1}/${batch.length} in batch)`);
            
            try {
              await updateSheetData(ROSTER_SHEET_ID, range, [batch[i]]);
              
              // Add delay between individual updates within batch
              if (i < batch.length - 1) {
                await delay(DELAY_BETWEEN_INDIVIDUAL_UPDATES_MS);
              }
            } catch (error) {
              console.error(`❌ Failed to update row ${globalIndex + this.metadata.dataStartRow}:`, error);
              // Continue with other updates despite individual failures
            }
          }
        }
        
        // Add delay between batches
        if (batchEnd < updatedRows.length) {
          console.log(`⏱️ Waiting ${DELAY_BETWEEN_BATCHES_MS}ms before next batch...`);
          await delay(DELAY_BETWEEN_BATCHES_MS);
        }
      }
      
      console.log(`✅ Completed ${updatedRows.length} row updates`);
    }

    // Append new rows (if any)
    if (newRows.length > 0) {
      console.log(`➕ Appending ${newRows.length} new rows`);
      const range = `A${this.metadata.dataStartRow}:Z${this.metadata.dataStartRow}`;
      console.log(`📋 First row data:`, JSON.stringify(newRows[0]));
      console.log(`📋 First row length:`, newRows[0]?.length);
      console.log(`📋 Expected columns:`, this.metadata.columns.length);
      
      try {
        const result = await appendSheetData(ROSTER_SHEET_ID, range, newRows);
        console.log(`✅ Append successful:`, result);
      } catch (error) {
        console.error(`❌ Append failed:`, error);
        throw error;
      }
    } else {
      console.log(`⚠️ No new rows to append`);
    }
  }
}