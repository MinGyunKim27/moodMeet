export interface ApiResponse<T> {
  data: T
  requestId: string
}

export interface ApiError {
  code: string
  message: string
  requestId: string
}

// --- Meetings ---

export interface CreateMeetingRequest {
  title?: string
  password?: string
  settings?: Partial<import('./meeting.js').MeetingSettings>
}

export interface CreateMeetingResponse {
  meeting: import('./meeting.js').Meeting
  joinUrl: string
}

export interface JoinTokenResponse {
  token: string
  livekitUrl: string
  expiresAt: string
}

// --- Mood Aggregation ---

export interface SubmitMoodRequest {
  bucketTs: string
  valenceAvg: number
  arousalAvg: number
  samples: number
}
