import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { parseTeamMailingList, parseCsvString } from '@/lib/data-processing';

export async function GET() {
  try {
    // Read cached mailing list file
    const mailingListPath = join(process.cwd(), 'tmp', 'team-mailing-list.csv');
    const csvContent = await readFile(mailingListPath, 'utf8');
    
    // Show raw content (first 500 chars)
    const rawPreview = csvContent.substring(0, 500);
    
    // Try parsing as CSV
    const rawCsvData = await parseCsvString(csvContent);
    
    // Try our mailing list parser
    const parsedMailingList = await parseTeamMailingList(csvContent);
    
    return NextResponse.json({
      rawPreview,
      rawCsvRowCount: rawCsvData.length,
      sampleRawRow: rawCsvData[0],
      parsedMailingListCount: parsedMailingList.length,
      sampleParsedRecord: parsedMailingList[0],
      allEmailAddresses: rawCsvData.map(row => row['Email address']).filter(Boolean)
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}