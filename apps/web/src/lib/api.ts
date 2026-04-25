// 배포 시 VITE_API_URL=https://xxx.railway.app 설정, 로컬은 상대경로
const BASE = import.meta.env['VITE_API_URL']
  ? `${import.meta.env['VITE_API_URL']}/api`
  : '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = !!init?.body
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    ...init,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error((err as { message: string }).message)
  }
  return res.json() as Promise<T>
}

export interface MeetingListItem {
  id: string
  title: string | null
  status: string
  startedAt: string | null
  endedAt: string | null
  createdAt: string
}

export interface SummaryData {
  meetingId: string
  summaryMd: string
  generatedAt: string
  hasSummary: boolean
}

export interface UtteranceItem {
  transcript: string
  displayName: string
  startedAt: string
}

export interface MoodSeriesPoint {
  bucketTs: string
  valence: number
  arousal: number
  hue: number
  sampleCount: number
}

export const api = {
  createMeeting: (displayName: string, deviceId: string, title?: string) =>
    request<{ meeting: { id: string }; participantId: string; role: 'host'; token: string; livekitUrl: string; joinUrl: string }>('/meetings', {
      method: 'POST',
      body: JSON.stringify({ displayName, deviceId, title }),
    }),

  joinMeeting: (meetingId: string, displayName: string, deviceId: string) =>
    request<{ token: string; livekitUrl: string; participantId: string; role: 'member' }>(
      `/meetings/${meetingId}/join`,
      { method: 'POST', body: JSON.stringify({ displayName, deviceId }) },
    ),

  getMeeting: (meetingId: string) =>
    request<{ id: string; title: string | null; status: string }>(`/meetings/${meetingId}`),

  getMyMeetings: (deviceId: string) =>
    request<MeetingListItem[]>(`/meetings?deviceId=${deviceId}`),

  endMeeting: (meetingId: string) =>
    request<void>(`/meetings/${meetingId}`, { method: 'DELETE' }),

  addUtterance: (meetingId: string, participantId: string, transcript: string) =>
    request<void>(`/meetings/${meetingId}/utterances`, {
      method: 'POST',
      body: JSON.stringify({ participantId, transcript }),
    }),

  getSummary: (meetingId: string) =>
    request<SummaryData>(`/meetings/${meetingId}/summary`),

  generateSummary: (meetingId: string) =>
    request<SummaryData>(`/meetings/${meetingId}/summary`, { method: 'POST' }),

  getUtterances: (meetingId: string) =>
    request<UtteranceItem[]>(`/meetings/${meetingId}/utterances`),

  getMoodSeries: (meetingId: string) =>
    request<MoodSeriesPoint[]>(`/meetings/${meetingId}/mood-series`),
}
