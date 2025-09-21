import { getSheetData } from './google-api';
import { SHEET_CONFIG } from './sheet-config';

export interface RosterColumnMetadata {
  columnName: string;
  type: string;
  source: string;
  additionalNote: string;
  columnIndex: number;
}

export interface RosterMetadata {
  columns: RosterColumnMetadata[];
  dataStartRow: number; // Row where actual player data starts (after metadata)
}

const ROSTER_SHEET_ID = SHEET_CONFIG.ROSTER_SHEET_ID;

// Parse the metadata rows of the roster sheet to understand column structure
export async function getRosterMetadata(): Promise<RosterMetadata> {
  try {
    // Get the metadata rows
    const metadataRows = await getSheetData(ROSTER_SHEET_ID, `A1:Z${SHEET_CONFIG.METADATA_ROWS}`);
    
    if (metadataRows.length < SHEET_CONFIG.METADATA_ROWS) {
      throw new Error(`Expected ${SHEET_CONFIG.METADATA_ROWS} metadata rows, got ${metadataRows.length}`);
    }

    const [columnNameRow, typeRow, sourceRow, additionalNoteRow] = metadataRows;
    
    const columns: RosterColumnMetadata[] = [];
    
    // Process each column that has a column name
    for (let i = 0; i < columnNameRow.length; i++) {
      const columnName = columnNameRow[i]?.trim();
      if (!columnName) continue; // Skip empty columns
      
      columns.push({
        columnName,
        type: typeRow[i]?.trim() || 'string',
        source: sourceRow[i]?.trim() || '',
        additionalNote: additionalNoteRow[i]?.trim() || '',
        columnIndex: i,
      });
    }

    return {
      columns,
      dataStartRow: SHEET_CONFIG.DATA_START_ROW, // Data starts after metadata rows
    };
  } catch (error) {
    console.error('Error fetching roster metadata:', error);
    throw error;
  }
}

// Get existing roster player data (excluding metadata rows)
export async function getRosterData(): Promise<any[][]> {
  try {
    const metadata = await getRosterMetadata();
    const range = `A${metadata.dataStartRow}:Z1000`; // Get up to 1000 rows of data
    return await getSheetData(ROSTER_SHEET_ID, range);
  } catch (error) {
    console.error('Error fetching roster data:', error);
    throw error;
  }
}

// Parse data source mapping from the "source" field
export function parseDataSourceMapping(source: string): { 
  dataSource: string; 
  sourceColumn: string;
} | null {
  if (!source) return null;
  
  // Expected format: "SPS Final Forms: First Name" or "Additional Questionnaire: Player Name"
  const match = source.match(/^([^:]+):\s*(.+)$/);
  if (match) {
    return {
      dataSource: match[1].trim(),
      sourceColumn: match[2].trim(),
    };
  }
  
  // If no colon, assume the whole string is the data source name
  return {
    dataSource: source.trim(),
    sourceColumn: '', // Will use column name as fallback
  };
}


// Export the roster sheet ID for use in other modules
export { ROSTER_SHEET_ID };