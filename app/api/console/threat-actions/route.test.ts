import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetSessionUser = vi.fn()
const mockGetConsoleProfile = vi.fn()
const mockQuery = vi.fn()
const mockConnect = vi.fn()

vi.mock('@/lib/auth/session', () => ({
  getSessionUser: mockGetSessionUser,
}))

vi.mock('@/lib/auth/console', () => ({
  getConsoleProfile: mockGetConsoleProfile,
}))

vi.mock('@/lib/db', () => ({
  getPool: () => ({ connect: mockConnect }),
}))

describe('POST /api/console/threat-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when user is not authenticated', async () => {
    mockGetSessionUser.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/console/threat-actions/route')
    const request = new Request('http://localhost/api/console/threat-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threatId: 't1', action: 'delete' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns 403 when role is not allowed', async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: 'user-1' })
    mockGetConsoleProfile.mockResolvedValueOnce({ role: 'viewer' })

    const { POST } = await import('@/app/api/console/threat-actions/route')
    const request = new Request('http://localhost/api/console/threat-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threatId: 't1', action: 'delete' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('maps block action to kill and commits changes', async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: 'user-1' })
    mockGetConsoleProfile.mockResolvedValueOnce({
      role: 'admin',
      account: { id: 'acc-1' },
    })

    const mockClient = {
      query: mockQuery,
      release: vi.fn(),
    }
    mockConnect.mockResolvedValueOnce(mockClient)

    mockQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            name: 'Bad Process',
            status: 'detected',
            account_id: 'acc-1',
            endpoint_id: 'endpoint-1',
            file_path: '/tmp/bad.exe',
            file_hash: 'hash-1',
            process_id: 123,
          },
        ],
      }) // SELECT threat
      .mockResolvedValueOnce(undefined) // UPDATE threat
      .mockResolvedValueOnce(undefined) // INSERT threat_actions
      .mockResolvedValueOnce({ rows: [{ id: 'cmd-1' }] }) // INSERT threat_action_commands
      .mockResolvedValueOnce(undefined) // INSERT audit
      .mockResolvedValueOnce(undefined) // COMMIT

    const { POST } = await import('@/app/api/console/threat-actions/route')
    const request = new Request('http://localhost/api/console/threat-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threatId: 'threat-1', action: 'block', notes: 'manual block' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, command_id: 'cmd-1' })

    const updateCall = mockQuery.mock.calls[2]
    expect(updateCall[1][1]).toBe('killed')

    const insertActionCall = mockQuery.mock.calls[3]
    expect(insertActionCall[1][1]).toBe('kill')

    const commandInsertCall = mockQuery.mock.calls[4]
    expect(commandInsertCall[1][3]).toBe('kill')

    expect(mockQuery).toHaveBeenCalledWith('COMMIT')
  })

  it('handles allow action as allowed status', async () => {
    mockGetSessionUser.mockResolvedValueOnce({ id: 'user-1' })
    mockGetConsoleProfile.mockResolvedValueOnce({
      role: 'operator',
      account: { id: 'acc-1' },
    })

    const mockClient = {
      query: mockQuery,
      release: vi.fn(),
    }
    mockConnect.mockResolvedValueOnce(mockClient)

    mockQuery
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            name: 'False Positive',
            status: 'detected',
            account_id: 'acc-1',
            endpoint_id: 'endpoint-1',
            file_path: '/tmp/false-positive.exe',
            file_hash: 'hash-fp',
            process_id: 77,
          },
        ],
      }) // SELECT threat
      .mockResolvedValueOnce(undefined) // UPDATE threat
      .mockResolvedValueOnce(undefined) // INSERT threat_actions
      .mockResolvedValueOnce({ rows: [{ id: 'cmd-2' }] }) // INSERT threat_action_commands
      .mockResolvedValueOnce(undefined) // INSERT audit
      .mockResolvedValueOnce(undefined) // COMMIT

    const { POST } = await import('@/app/api/console/threat-actions/route')
    const request = new Request('http://localhost/api/console/threat-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threatId: 'threat-2', action: 'allow' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const updateCall = mockQuery.mock.calls[2]
    expect(updateCall[1][1]).toBe('allowed')
  })
})
