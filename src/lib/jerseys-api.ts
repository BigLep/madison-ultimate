// Shared request handling for the gated /api/jerseys routes (ADR 0009).

import { NextRequest, NextResponse } from 'next/server';
import { listRosteredPlayers, RosteredPlayerSummary } from './coach-directory';
import { cleanManagerName } from './jerseys';

export function jsonError(error: string, status: number) {
  return NextResponse.json({ success: false, error }, { status });
}

export function serverError(context: string, error: unknown) {
  console.error(`${context}:`, error);
  return jsonError(error instanceof Error ? error.message : 'Unknown error', 500);
}

/** The request body plus the Jersey Manager name every write is stamped with. */
export async function readWriteBody(request: NextRequest): Promise<{ body: Record<string, unknown>; by: string } | NextResponse> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return jsonError('Invalid request body', 400);
  const by = cleanManagerName((body as Record<string, unknown>).by);
  if (!by) return jsonError('Your name is required (Jersey Manager name, up to 60 characters).', 400);
  return { body: body as Record<string, unknown>, by };
}

export async function findRosteredPlayer(playerId: unknown): Promise<RosteredPlayerSummary | null> {
  if (typeof playerId !== 'string' || !playerId) return null;
  return (await listRosteredPlayers()).find(p => p.playerId === playerId) ?? null;
}
