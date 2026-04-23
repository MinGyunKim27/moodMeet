import type { FastifyInstance } from 'fastify'
import type { WebSocket } from '@fastify/websocket'
import { sql } from '../db/client.js'
import { newId } from '../lib/id.js'
import { moodToHue } from '../lib/hue.js'

interface MoodPayload {
  participantId: string
  valenceAvg: number
  arousalAvg: number
  samples: number
  isSpeaking?: boolean
}

interface RoomState {
  clients: Map<string, { ws: WebSocket; weight: number; isSpeaking: boolean }>
  latestMood: Map<string, { valence: number; arousal: number; samples: number }>
  tickTimer: ReturnType<typeof setInterval> | null
}

// 방별 상태 인메모리 (Redis 없을 때 폴백)
const rooms = new Map<string, RoomState>()

function getRoom(meetingId: string): RoomState {
  if (!rooms.has(meetingId)) {
    rooms.set(meetingId, {
      clients: new Map(),
      latestMood: new Map(),
      tickTimer: null,
    })
  }
  return rooms.get(meetingId)!
}

function aggregate(room: RoomState, speakingId: string | null) {
  let sumV = 0, sumA = 0, totalWeight = 0, count = 0

  for (const [ptcId, mood] of room.latestMood) {
    if (ptcId === speakingId) continue // 발화자 제외
    const client = room.clients.get(ptcId)
    const weight = client?.weight ?? 1
    sumV += mood.valence * weight
    sumA += mood.arousal * weight
    totalWeight += weight
    count++
  }

  if (count === 0) return null
  const valence = sumV / totalWeight
  const arousal = sumA / totalWeight
  return { valence, arousal, hue: moodToHue(valence), sampleCount: count }
}

function broadcast(room: RoomState, payload: object) {
  const msg = JSON.stringify(payload)
  for (const { ws } of room.clients.values()) {
    if (ws.readyState === 1 /* OPEN */) ws.send(msg)
  }
}

export async function moodRoute(app: FastifyInstance) {
  // WebSocket: ws://localhost:4000/api/mood/:meetingId
  app.get<{ Params: { meetingId: string }; Querystring: { participantId: string } }>(
    '/:meetingId',
    { websocket: true },
    (socket, req) => {
      const { meetingId } = req.params
      const { participantId } = req.query

      const room = getRoom(meetingId)
      room.clients.set(participantId, { ws: socket, weight: 1, isSpeaking: false })

      // 5초 tick — 처음 클라이언트 연결 시 시작
      if (!room.tickTimer) {
        room.tickTimer = setInterval(async () => {
          const speakingEntry = [...room.clients.entries()].find(([, c]) => c.isSpeaking)
          const speakerId = speakingEntry?.[0] ?? null
          const result = aggregate(room, speakerId)
          if (!result) return

          broadcast(room, { type: 'mood_update', ...result, ts: new Date().toISOString() })

          // mood_series 저장 (DB 없으면 무시)
          const entryId = await newId('mood').catch(() => null)
          if (entryId) {
            await sql`
              INSERT INTO mood_series (meeting_id, bucket_ts, valence_agg, arousal_agg, hue, sample_count, speaker_ptc_id, model_version)
              VALUES (${meetingId}, now(), ${result.valence}, ${result.arousal}, ${result.hue}, ${result.sampleCount}, ${speakerId}, 'face-api@1.7.15')
              ON CONFLICT DO NOTHING
            `.catch(() => null)
          }
        }, 5000)
      }

      socket.on('message', (raw: Buffer) => {
        try {
          const payload = JSON.parse(raw.toString()) as MoodPayload
          if (payload.participantId !== participantId) return

          room.latestMood.set(participantId, {
            valence: payload.valenceAvg,
            arousal: payload.arousalAvg,
            samples: payload.samples,
          })
          if (payload.isSpeaking !== undefined) {
            const c = room.clients.get(participantId)
            if (c) c.isSpeaking = payload.isSpeaking
          }
        } catch {
          // 파싱 실패 무시
        }
      })

      socket.on('close', () => {
        room.clients.delete(participantId)
        room.latestMood.delete(participantId)

        if (room.clients.size === 0 && room.tickTimer) {
          clearInterval(room.tickTimer)
          rooms.delete(meetingId)
        }
      })
    },
  )
}
