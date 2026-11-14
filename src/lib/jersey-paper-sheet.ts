// The Check-in tab's "Download as XLSX": a printable sheet of outstanding Program Jerseys for a
// Jersey Manager who would rather tick names off on paper. Columns: Player, Team, Jersey,
// Returned? (blank, to check off), Note (blank, to write in). Every table cell has a border so it
// prints as a grid. Server-only (exceljs).

import ExcelJS from 'exceljs';
import { formatJerseySize } from './signup-form-schema';
import { formatFullDate } from './date-formatters';
import type { OutstandingRow } from './jerseys';

const THIN = { style: 'thin' as const };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

/** "Blue", "TBD", or "Not on Roster": plain words, since team emoji print poorly. */
function teamLabel(team: string): string {
  return team.trim() ? team.trim() : 'TBD';
}

export async function outstandingJerseysWorkbook(rows: OutstandingRow[], { title, today }: { title: string; today: string }): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Outstanding jerseys', {
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '3:3' },
  });
  sheet.columns = [
    { key: 'player', width: 28 },
    { key: 'team', width: 14 },
    { key: 'jersey', width: 22 },
    { key: 'returned', width: 11 },
    { key: 'note', width: 40 },
  ];

  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = { bold: true, size: 14 };
  sheet.getCell('A2').value = `${rows.length} still out as of ${formatFullDate(today)}`;
  sheet.getCell('A2').font = { italic: true, color: { argb: 'FF555555' } };

  const header = sheet.getRow(3);
  header.values = ['Player', 'Team', 'Jersey', 'Returned?', 'Note'];
  header.font = { bold: true };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } } as ExcelJS.Fill;

  rows.forEach((r, i) => {
    const row = sheet.getRow(4 + i);
    row.values = [r.playerName, teamLabel(r.team), r.size ? `${formatJerseySize(r.size) || r.size} (${r.size})` : '', '', ''];
    row.height = 22;
  });

  for (let rowNumber = 3; rowNumber < 4 + rows.length; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    for (let col = 1; col <= 5; col++) {
      const cell = row.getCell(col);
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', horizontal: col === 4 ? 'center' : 'left', wrapText: col === 5 };
    }
  }
  sheet.views = [{ state: 'frozen', ySplit: 3 }];

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
