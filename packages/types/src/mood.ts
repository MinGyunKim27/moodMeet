export interface MoodBucket {
  meetingId: string
  bucketTs: string // ISO 8601, 5s bucket
  valenceAgg: number // -1..1
  arousalAgg: number // -1..1
  hue: number // 0..360
  sampleCount: number
  speakerPtcId: string | null
  modelVersion: string
}

export interface LocalMoodSample {
  valence: number
  arousal: number
  timestamp: number // ms
}

export interface MoodPayload {
  participantId: string
  valenceAvg: number
  arousalAvg: number
  samples: number
}
