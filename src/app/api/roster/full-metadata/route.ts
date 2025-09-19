import { NextResponse } from 'next/server';
import { getSheetData } from '../../../../lib/google-api';

const ROSTER_SHEET_ID = process.env.ROSTER_SHEET_ID || '1ZZA5TxHu8nmtyNORm3xYtN5rzP3p1jtW178UgRcxLA8';

export async function GET() {
  try {
    // Read a wider range to capture all columns including Portal columns
    const metadataRows = await getSheetData(ROSTER_SHEET_ID, 'A1:AZ4');

    if (metadataRows.length < 4) {
      return NextResponse.json({
        success: false,
        error: `Expected 4 metadata rows, got ${metadataRows.length}`
      });
    }

    const [columnNameRow, typeRow, sourceRow, additionalNoteRow] = metadataRows;

    const columns = [];

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
        columnLetter: String.fromCharCode(65 + i), // A, B, C, etc.
      });
    }

    // Look for Portal-specific columns
    const portalLookupColumn = columns.find(col =>
      col.columnName.toLowerCase().includes('portal') &&
      col.columnName.toLowerCase().includes('lookup')
    );

    const portalIdColumn = columns.find(col =>
      col.columnName.toLowerCase().includes('portal') &&
      col.columnName.toLowerCase().includes('id') &&
      !col.columnName.toLowerCase().includes('lookup')
    );

    return NextResponse.json({
      success: true,
      data: {
        totalColumns: columns.length,
        columns,
        portalColumns: {
          lookupKey: portalLookupColumn || null,
          portalId: portalIdColumn || null
        }
      }
    });
  } catch (error) {
    console.error('Error fetching full roster metadata:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}