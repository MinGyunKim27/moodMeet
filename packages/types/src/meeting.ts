export type MeetingStatus = 'scheduled' | 'live' | 'ended' | 'archived'
export type ParticipantRole = 'host' | 'cohost' | 'member' | 'guest'

export interface Meeting {
  id: string // "meet_<ksuid>"
  hostUserId: string
  title: string | null
  status: MeetingStatus
  startedAt: string | null // ISO 8601
  endedAt: string | null
  settings: MeetingSettings
  createdAt: string
}

export interface MeetingSettings {
  allowRecording: boolean
  moodEnabled: boolean
  passwordProtected: boolean
}

export interface Participant {
  id: string // "ptc_<ksuid>"
  meetingId: string
  userId: string | null // null = 게스트
  displayName: string
  role: ParticipantRole
  weight: number // 0..5, default 1.00
  consentExpression: boolean
  consentRecording: boolean
  joinedAt: string | null
  leftAt: string | null
}

export interface User {
  id: string // "usr_<ksuid>"
  displayName: string
  locale: string
  createdAt: string
}
