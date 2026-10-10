import { NextResponse } from 'next/server';
import { APP_CONFIG } from '@/lib/app-config';

/** Short, shareable path that redirects to the feedback Google Form (FEEDBACK_FORM_URL in app-config.ts). */
export function GET() {
  const destination = APP_CONFIG.FEEDBACK_FORM_URL;
  if (!destination) {
    return new NextResponse('Not found', { status: 404 });
  }
  return NextResponse.redirect(destination, 302);
}
