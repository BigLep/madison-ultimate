import fs from 'fs/promises';
import path from 'path';
import { 
  getMostRecentFileInfoFromFolder,
  downloadCsvFromDrive,
  getSheetData 
} from '@/lib/google-api';
import { 
  parseSPSFinalForms, 
  parseTeamMailingList, 
  parseQuestionnaireData,
  integratePlayerData
} from '@/lib/data-processing';
import { 
  PlayerSignupStatus,
  SPSFinalFormsRecord,
  MailingListRecord,
  QuestionnaireRecord
} from '@/lib/types';
import { formatToPacificTime } from '@/lib/date-utils';

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), 'tmp');
const CACHE_DURATION_MS = parseInt(process.env.CACHE_DURATION_MINUTES || '30') * 60 * 1000; // Default 30 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  source_timestamp?: string;
}

interface IntegratedData {
  players: PlayerSignupStatus[];
  statistics: {
    totalPlayers: number;
    caretakerSignedFinalForms: number;
    playerSignedFinalForms: number;
    playerClearedPhysical: number;
    caretakerFilledQuestionnaire: number;
    caretaker1JoinedMailingList: number;
    caretaker2JoinedMailingList: number;
    parentsOnMailingList: number;
  };
  timestamps: {
    finalForms: string;
    mailingList: string;
    questionnaire: string;
  };
  lastUpdated: string;
}

class CacheManager {
  private static instance: CacheManager;
  private refreshTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.ensureCacheDir();
    this.startBackgroundRefresh();
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private async ensureCacheDir() {
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create cache directory:', error);
    }
  }

  private getCacheFilePath(key: string): string {
    return path.join(CACHE_DIR, `${key}.json`);
  }

  private async readCacheFile<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const filePath = this.getCacheFilePath(key);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  private async writeCacheFile<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      const filePath = this.getCacheFilePath(key);
      await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
    } catch (error) {
      console.error(`Failed to write cache file ${key}:`, error);
    }
  }

  private isCacheExpired(timestamp: number): boolean {
    return Date.now() - timestamp > CACHE_DURATION_MS;
  }

  // Fetch fresh data from Google APIs
  private async fetchFreshData(): Promise<IntegratedData | null> {
    try {
      console.log('🔄 Fetching fresh data from Google APIs...');
      
      // Fetch all data sources
      const [finalFormsResult, mailingListResult, questionnaireResult] = await Promise.all([
        this.fetchFinalFormsData(),
        this.fetchMailingListData(),
        this.fetchQuestionnaireData()
      ]);

      if (!finalFormsResult.data) {
        console.error('Failed to fetch Final Forms data');
        return null;
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

      const result: IntegratedData = {
        players: playerData,
        statistics: stats,
        timestamps: {
          finalForms: finalFormsResult.timestamp,
          mailingList: mailingListResult.timestamp,
          questionnaire: questionnaireResult.timestamp
        },
        lastUpdated: new Date().toISOString()
      };

      console.log(`✅ Fresh data fetched: ${totalPlayers} players, ${stats.parentsOnMailingList} parents on mailing list`);
      return result;
    } catch (error) {
      console.error('Error fetching fresh data:', error);
      return null;
    }
  }

  private async fetchFinalFormsData() {
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

  private async fetchMailingListData() {
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

  private async fetchQuestionnaireData() {
    try {
      const sheetData = await getSheetData(
        process.env.ADDITIONAL_QUESTIONNAIRE_SHEET_ID!
      );
      
      const data = parseQuestionnaireData(sheetData);
      return { 
        data, 
        timestamp: formatToPacificTime(new Date().toISOString())
      };
    } catch (error) {
      console.error('Error fetching Questionnaire data:', error);
      return { data: null, timestamp: '' };
    }
  }

  // Get integrated data (from cache if available, otherwise fetch fresh)
  public async getIntegratedData(forceRefresh = false): Promise<IntegratedData | null> {
    const cacheKey = 'integrated-data';
    
    // Always check for cached data first
    const cached = await this.readCacheFile<IntegratedData>(cacheKey);
    
    if (!forceRefresh && cached && !this.isCacheExpired(cached.timestamp)) {
      console.log('📦 Serving fresh data from cache');
      return cached.data;
    }

    // Cache expired or force refresh - try to fetch fresh data
    console.log('🔄 Cache expired or force refresh requested, fetching fresh data...');
    const freshData = await this.fetchFreshData();
    
    if (freshData) {
      // Successfully fetched fresh data - update cache
      const cacheEntry: CacheEntry<IntegratedData> = {
        data: freshData,
        timestamp: Date.now()
      };
      await this.writeCacheFile(cacheKey, cacheEntry);
      console.log('💾 Fresh data cached successfully');
      return freshData;
    } else {
      // Failed to fetch fresh data - serve stale cache if available
      if (cached) {
        console.log('⚠️ Failed to fetch fresh data, serving stale cache');
        return cached.data;
      } else {
        console.error('❌ No cached data available and fresh fetch failed');
        return null;
      }
    }
  }

  // Get raw data sources for debug purposes
  public async getDebugData(forceRefresh = false): Promise<any> {
    // Always refresh debug data to get latest
    const [finalFormsResult, mailingListResult] = await Promise.all([
      this.fetchFinalFormsData(),
      this.fetchMailingListData()
    ]);

    if (!finalFormsResult.data || !mailingListResult.data) {
      return null;
    }

    // Also update the integrated cache when debug is called
    if (forceRefresh) {
      await this.getIntegratedData(true);
    }

    // Return debug-specific data processing
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
      name: record.name || '',
      joinedDate: record.joinedDate || ''
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

    return {
      unmatchedEmails,
      matchedEmails,
      totalMailingListEmails: mailingListData.length,
      totalPlayerEmails: allParentEmails.length
    };
  }

  // Start background refresh process
  private startBackgroundRefresh() {
    console.log(`🔄 Starting background refresh every ${CACHE_DURATION_MS / 60000} minutes`);
    
    this.refreshTimer = setInterval(async () => {
      try {
        console.log('⏰ Background refresh triggered');
        await this.getIntegratedData(true);
      } catch (error) {
        console.error('❌ Background refresh failed:', error);
        // Don't throw - let the timer continue for next attempt
      }
    }, CACHE_DURATION_MS);
  }

  // Stop background refresh (for cleanup)
  public stopBackgroundRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      console.log('🛑 Background refresh stopped');
    }
  }
}

export default CacheManager;