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

// Cache configuration - 2 minutes for in-memory cache
const CACHE_DURATION_MS = 2 * 60 * 1000; // 2 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
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
  private memoryCache: Map<string, CacheEntry<IntegratedData>> = new Map();

  private constructor() {
    // Simple in-memory only cache
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
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

  // Get integrated data (from memory cache if available, otherwise fetch fresh)
  public async getIntegratedData(forceRefresh = false): Promise<IntegratedData | null> {
    const cacheKey = 'integrated-data';
    
    // Check in-memory cache first
    const cached = this.memoryCache.get(cacheKey);
    
    if (!forceRefresh && cached && !this.isCacheExpired(cached.timestamp)) {
      console.log('📦 Serving data from memory cache');
      return cached.data;
    }

    // Cache expired or force refresh - fetch fresh data
    console.log('🔄 Cache expired or force refresh, fetching fresh data...');
    const freshData = await this.fetchFreshData();
    
    if (freshData) {
      // Successfully fetched fresh data - update memory cache
      const cacheEntry: CacheEntry<IntegratedData> = {
        data: freshData,
        timestamp: Date.now()
      };
      this.memoryCache.set(cacheKey, cacheEntry);
      console.log('💾 Fresh data cached in memory');
      return freshData;
    } else {
      // Failed to fetch fresh data - serve stale cache if available
      if (cached) {
        console.log('⚠️ Failed to fetch fresh data, serving stale memory cache');
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

  // Clear memory cache (useful for testing)
  public clearCache() {
    this.memoryCache.clear();
    console.log('🧹 Memory cache cleared');
  }
}

export default CacheManager;