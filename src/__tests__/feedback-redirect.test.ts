import { describe, it, expect } from 'vitest';
import { GET } from '@/app/feedback/route';
import { APP_CONFIG } from '@/lib/app-config';

describe('GET /feedback', () => {
  it('redirects to the configured feedback form', () => {
    const res = GET();
    if (APP_CONFIG.FEEDBACK_FORM_URL) {
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(APP_CONFIG.FEEDBACK_FORM_URL);
    } else {
      expect(res.status).toBe(404);
    }
  });
});
