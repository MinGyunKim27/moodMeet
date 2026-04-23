import { create } from 'zustand'

interface MeetingStore {
  displayName: string
  participantId: string | null
  role: 'host' | 'member' | null
  token: string | null
  livekitUrl: string | null
  setDisplayName: (name: string) => void
  setConnection: (token: string, livekitUrl: string, participantId: string, role: 'host' | 'member') => void
  clear: () => void
}

export const useMeetingStore = create<MeetingStore>((set) => ({
  displayName: '',
  participantId: null,
  role: null,
  token: null,
  livekitUrl: null,
  setDisplayName: (name) => set({ displayName: name }),
  setConnection: (token, livekitUrl, participantId, role) =>
    set({ token, livekitUrl, participantId, role }),
  clear: () => set({ token: null, livekitUrl: null, participantId: null, role: null }),
}))
