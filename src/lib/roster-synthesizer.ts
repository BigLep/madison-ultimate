import { getRosterMetadata, getRosterData, parseDataSourceMapping, type RosterColumnMetadata } from './roster-metadata';
import { updateSheetData, appendSheetData } from './google-api';
import { ROSTER_SHEET_ID } from './roster-metadata';
import { getIntegratedData } from './data-processing';
import type { PlayerSignupStatus } from './types';

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
  
  constructor() {
    this.metadata = null;
    this.existingRosterData = [];
    this.sourceData = [];
  }

  async initialize(): Promise<void> {
    // Load roster metadata and existing data
    this.metadata = await getRosterMetadata();
    this.existingRosterData = await getRosterData();
    
    // Load source data (same as Stage 1)
    this.sourceData = await getIntegratedData();
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
        const newRow = this.buildPlayerRow(sourcePlayer, null);
        newRows.push(newRow);
        result.newPlayersAdded++;
        result.changes.push({
          playerName: sourcePlayer.firstName + ' ' + sourcePlayer.lastName,
          action: 'added',
          changes: {},
        });
      }
    }

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
      let value = '';

      if (existingPlayer && column.humanEditable) {
        // Preserve existing value for human-editable fields
        value = existingPlayer.data[column.columnName] || '';
      } else {
        // Use source data for non-human-editable fields
        value = this.mapSourceDataToColumn(sourcePlayer, column);
      }

      row[column.columnIndex] = value;
    }

    return row;
  }

  private mapSourceDataToColumn(sourcePlayer: PlayerSignupStatus, column: RosterColumnMetadata): string {
    const mapping = parseDataSourceMapping(column.source);
    if (!mapping) return '';

    const dataSource = mapping.dataSource.toLowerCase();
    const sourceColumn = mapping.sourceColumn || column.columnName;

    // Map from source player data based on data source
    if (dataSource.includes('sps final forms') || dataSource.includes('final forms')) {
      return this.mapFromFinalForms(sourcePlayer, sourceColumn);
    } else if (dataSource.includes('additional questionnaire') || dataSource.includes('questionnaire')) {
      return this.mapFromQuestionnaire(sourcePlayer, sourceColumn);
    } else if (dataSource.includes('mailing list')) {
      return this.mapFromMailingList(sourcePlayer, sourceColumn);
    }

    return '';
  }

  private mapFromFinalForms(sourcePlayer: PlayerSignupStatus, sourceColumn: string): string {
    const columnLower = sourceColumn.toLowerCase();
    
    if (columnLower.includes('first name')) return sourcePlayer.firstName;
    if (columnLower.includes('last name')) return sourcePlayer.lastName;
    if (columnLower.includes('grade')) return sourcePlayer.grade;
    if (columnLower.includes('gender')) return sourcePlayer.gender;
    if (columnLower.includes('caretaker signed') || columnLower.includes('parent signed')) {
      return sourcePlayer.hasCaretakerSignedFinalForms ? 'Yes' : 'No';
    }
    if (columnLower.includes('student signed') || columnLower.includes('player signed')) {
      return sourcePlayer.hasPlayerSignedFinalForms ? 'Yes' : 'No';
    }
    if (columnLower.includes('physical')) {
      return sourcePlayer.hasPlayerClearedPhysical ? 'Yes' : 'No';
    }

    return '';
  }

  private mapFromQuestionnaire(sourcePlayer: PlayerSignupStatus, sourceColumn: string): string {
    return sourcePlayer.hasCaretakerFilledQuestionnaire ? 'Yes' : 'No';
  }

  private mapFromMailingList(sourcePlayer: PlayerSignupStatus, sourceColumn: string): string {
    const columnLower = sourceColumn.toLowerCase();
    
    if (columnLower.includes('caretaker 1') || columnLower.includes('parent 1')) {
      return sourcePlayer.hasCaretaker1JoinedMailingList ? 'Yes' : 'No';
    }
    if (columnLower.includes('caretaker 2') || columnLower.includes('parent 2')) {
      return sourcePlayer.hasCaretaker2JoinedMailingList ? 'Yes' : 'No';
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
    // Apply updates to existing rows
    for (let i = 0; i < updatedRows.length; i++) {
      if (updatedRows[i]) {
        const range = `A${this.metadata.dataStartRow + i}:Z${this.metadata.dataStartRow + i}`;
        await updateSheetData(ROSTER_SHEET_ID, range, [updatedRows[i]]);
      }
    }

    // Append new rows
    if (newRows.length > 0) {
      const range = `A${this.metadata.dataStartRow}:Z${this.metadata.dataStartRow}`;
      await appendSheetData(ROSTER_SHEET_ID, range, newRows);
    }
  }
}