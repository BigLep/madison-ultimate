import { NextResponse } from 'next/server';

function isWhatsAppInviteUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && parsed.hostname === 'chat.whatsapp.com';
  } catch {
    return false;
  }
}

/** Unlisted join path: linked from /player/$id and the player portal only, never the public homepage. */
export function GET() {
  const destination = process.env.WHATSAPP_COMMUNITY_JOIN_URL?.trim();
  if (!destination || !isWhatsAppInviteUrl(destination)) {
    return new NextResponse('Not found', { status: 404 });
  }
  return NextResponse.redirect(destination, 302);
}
