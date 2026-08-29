import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/whatsapp/route';

describe('GET /whatsapp', () => {
  const original = process.env.WHATSAPP_COMMUNITY_JOIN_URL;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.WHATSAPP_COMMUNITY_JOIN_URL;
    } else {
      process.env.WHATSAPP_COMMUNITY_JOIN_URL = original;
    }
  });

  beforeEach(() => {
    delete process.env.WHATSAPP_COMMUNITY_JOIN_URL;
  });

  it('redirects to a configured chat.whatsapp.com invite', async () => {
    process.env.WHATSAPP_COMMUNITY_JOIN_URL = 'https://chat.whatsapp.com/TESTINVITEONLY';
    const res = await GET();
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://chat.whatsapp.com/TESTINVITEONLY');
  });

  it('returns 404 when the invite is not configured', async () => {
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it('returns 404 when the env value is not a WhatsApp invite', async () => {
    process.env.WHATSAPP_COMMUNITY_JOIN_URL = 'https://example.com/phishing';
    const res = await GET();
    expect(res.status).toBe(404);
  });
});
