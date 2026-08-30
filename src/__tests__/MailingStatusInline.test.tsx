// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MailingStatusInline } from '@/components/MailingStatusInline'

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response
}

describe('MailingStatusInline', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an error when Join fails instead of leaving the status unchanged with no feedback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          statuses: [
            { label: 'Student personal email', email: 'emma@example.com', subscribed: false },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: false, error: 'Buttondown request failed' }, false, 502)
      )
    vi.stubGlobal('fetch', fetchMock)

    render(<MailingStatusInline playerId="twpqs" matchLabel="Student personal email" />)

    await waitFor(() => expect(screen.getByRole('button', { name: /Join/ })).toBeInTheDocument())
    expect(screen.getByText(/not subscribed/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Join/ }))

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent(/Couldn't update newsletter status/)
    expect(screen.getByText(/not subscribed/)).toBeInTheDocument()
    expect(screen.queryByText(/^subscribed$/)).not.toBeInTheDocument()
  })
})
