import { create } from 'zustand'

interface MeetingStore {
  displayName: string
  participantId: string | null   // 현재 미팅의 참여자 ID
  token: string | null
  livekitUrl: string | null
  setDisplayName: (name: string) => void
  setConnection: (token: string, livekitUrl: string, participantId: string) => void
  clear: () => void
}

export const useMeetingStore = create<MeetingStore>((set) => ({
  displayName: '',
  participantId: null,
  token: null,
  livekitUrl: null,
  setDisplayName: (name) => set({ displayName: name }),
  setConnection: (token, livekitUrl, participantId) =>
    set({ token, livekitUrl, participantId }),
  clear: () => set({ token: null, livekitUrl: null, participantId: null }),
}))
