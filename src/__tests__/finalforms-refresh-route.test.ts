import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SIGNUPS_COLUMNS } from '@/lib/signups-config';
import { signupRecord } from './fixtures/signup-record';

vi.mock('@/lib/google-api', () => ({
  getMostRecentFileInfoFromFolder: vi.fn(),
  downloadCsvFromDrive: vi.fn(),
}));

vi.mock('@/lib/sheet-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/sheet-config')>();
  return {
    ...actual,
    SHEET_CONFIG: {
      ...actual.SHEET_CONFIG,
      SPS_FINAL_FORMS_FOLDER_ID: 'test-ff-folder',
    },
  };
});

import { getMostRecentFileInfoFromFolder, downloadCsvFromDrive } from '@/lib/google-api';
import { findFinalFormsMatch, clearFinalFormsCache } from '@/lib/final-forms';
import { POST } from '@/app/api/signup/finalforms-refresh/route';

const getFile = vi.mocked(getMostRecentFileInfoFromFolder);
const downloadCsv = vi.mocked(downloadCsvFromDrive);

const SIGNUP = signupRecord({
  [SIGNUPS_COLUMNS.LAST_NAME]: 'Sololast',
  [SIGNUPS_COLUMNS.DATE_OF_BIRTH]: '2013-05-01',
});

function csvWith(physicalCleared: string): string {
  return [
    'Student ID,First Name,Last Name,Date of Birth,Grade,Parent Signed,Student Signed,Physical Clearance,Physical Expiration,Email,Cell Phone,Parent 1 First Name,Parent 1 Last Name,Parent 1 Email,Parent 1 Cell Phone,Parent 2 First Name,Parent 2 Last Name,Parent 2 Email,Parent 2 Cell Phone',
    `FF-CASEY,Casey,Sololast,2013-05-01,8,true,true,${physicalCleared},,casey@example.com,555-0300,Pat,One,ct1@example.com,555-0101,,,`,
  ].join('\n');
}

describe('POST /api/signup/finalforms-refresh', () => {
  const originalEnv = { ...process.env };
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearFinalFormsCache();
    vi.clearAllMocks();
    process.env.FINALFORMS_GITHUB_TOKEN = 'test-token';
    process.env.FINALFORMS_GITHUB_REPO = 'org/repo';
    process.env.FINALFORMS_GITHUB_WORKFLOW_FILE = 'finalforms-export.yml';
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it('clears the in-memory snapshot after a successful dispatch, so the next join sees newer Drive data', async () => {
    getFile.mockResolvedValue({ id: 'file-1', timestamp: '2026-08-28T05:15:11Z', name: 'students_basic.csv' });
    downloadCsv.mockResolvedValue(csvWith('not cleared'));

    const before = await findFinalFormsMatch(SIGNUP);
    expect(before?.record.physicalCleared).toBe(false);
    expect(downloadCsv).toHaveBeenCalledTimes(1);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 0 }) }) // in-progress check
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // dispatch call

    const res = await POST();
    expect((await res.json()).status).toBe('started');

    downloadCsv.mockResolvedValue(csvWith('cleared'));
    const after = await findFinalFormsMatch(SIGNUP);
    expect(after?.record.physicalCleared).toBe(true);
    expect(downloadCsv).toHaveBeenCalledTimes(2);
  });

  it('also clears the cache when a sync is already in progress', async () => {
    getFile.mockResolvedValue({ id: 'file-1', timestamp: '2026-08-28T05:15:11Z', name: 'students_basic.csv' });
    downloadCsv.mockResolvedValue(csvWith('not cleared'));

    await findFinalFormsMatch(SIGNUP);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ total_count: 1 }) });

    const res = await POST();
    expect((await res.json()).status).toBe('already-running');

    downloadCsv.mockResolvedValue(csvWith('cleared'));
    const after = await findFinalFormsMatch(SIGNUP);
    expect(after?.record.physicalCleared).toBe(true);
    expect(downloadCsv).toHaveBeenCalledTimes(2);
  });

  it('reports not configured (and does not touch the cache) when env vars are missing', async () => {
    delete process.env.FINALFORMS_GITHUB_TOKEN;
    const res = await POST();
    expect(res.status).toBe(503);
    expect((await res.json()).configured).toBe(false);
  });
});
