import { NextRequest, NextResponse } from 'next/server';
import { getPlayerDataByPortalId } from '../../../../lib/portal-cache';

/**
 * Debug: return raw column names and row values for a player so we can compare
 * spreadsheet headers vs what extractPlayerData expects.
 * GET /api/debug/player-row?portalId=e8l06b12
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const portalId = searchParams.get('portalId');
    if (!portalId) {
      return NextResponse.json({ success: false, error: 'portalId required' }, { status: 400 });
    }

    const playerData = await getPlayerDataByPortalId(portalId);
    if (!playerData) {
      return NextResponse.json({ success: false, error: 'Player not found' }, { status: 404 });
    }

    const { rowData, columnMapping } = playerData;
    const columnNames = Object.keys(columnMapping).sort();
    const rowByColumn: Record<string, string> = {};
    for (const name of columnNames) {
      const idx = columnMapping[name];
      const val = rowData[idx];
      rowByColumn[name] = val != null ? String(val).trim() : '';
    }

    return NextResponse.json({
      success: true,
      portalId,
      columnNames,
      rowByColumn,
      columnCount: columnNames.length,
    });
  } catch (error) {
    console.error('Debug player-row failed:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
