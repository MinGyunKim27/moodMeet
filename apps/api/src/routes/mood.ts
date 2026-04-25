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

interface ClientState {
  ws: WebSocket
  // 내가 각 상대방에게 부여한 가중치 (key: 상대 participantId, value: 0~5)
  peerWeights: Map<string, number>
  isSpeaking: boolean
}

interface RoomState {
  clients: Map<string, ClientState>
  latestMood: Map<string, { valence: number; arousal: number; samples: number }>
  tickTimer: ReturnType<typeof setInterval> | null
}

// 방별 상태 인메모리
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

/**
 * viewerId 시점에서 나머지 참여자 무드 집계
 * - viewer가 각 상대에게 설정한 peerWeights 사용
 * - 미설정 상대는 기본 가중치 1
 */
function aggregateForViewer(room: RoomState, viewerId: string) {
  const viewer = room.clients.get(viewerId)
  let sumV = 0, sumA = 0, totalWeight = 0, count = 0

  for (const [ptcId, mood] of room.latestMood) {
    if (ptcId === viewerId) continue
    const weight = viewer?.peerWeights.get(ptcId) ?? 1
    if (weight === 0) continue // 가중치 0 = 이 사람 무드 무시
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

// 전체 단순 평균 (DB 저장용 — 가중치 무관)
function aggregateAll(room: RoomState) {
  let sumV = 0, sumA = 0, count = 0
  for (const [, mood] of room.latestMood) {
    sumV += mood.valence
    sumA += mood.arousal
    count++
  }
  if (count === 0) return null
  return { valence: sumV / count, arousal: sumA / count, sampleCount: count }
}

export async function moodRoute(app: FastifyInstance) {
  app.get<{ Params: { meetingId: string }; Querystring: { participantId: string } }>(
    '/:meetingId',
    { websocket: true },
    (socket, req) => {
      const { meetingId } = req.params
      const { participantId } = req.query

      const room = getRoom(meetingId)
      room.clients.set(participantId, {
        ws: socket,
        peerWeights: new Map(),
        isSpeaking: false,
      })

      // 5초 tick
      if (!room.tickTimer) {
        room.tickTimer = setInterval(async () => {
          // 각 클라이언트에게 본인 시점의 가중치 적용 무드 전송
          for (const [clientId, { ws }] of room.clients.entries()) {
            if (ws.readyState !== 1 /* OPEN */) continue
            const result = aggregateForViewer(room, clientId)
            if (!result) continue
            ws.send(JSON.stringify({ type: 'mood_update', ...result, ts: new Date().toISOString() }))
          }

          // DB 저장용 전체 단순 평균
          const overall = aggregateAll(room)
          if (!overall) return

          const entryId = await newId('mood').catch(() => null)
          if (entryId) {
            await sql`
              INSERT INTO mood_series (meeting_id, bucket_ts, valence_agg, arousal_agg, hue, sample_count, speaker_ptc_id, model_version)
              VALUES (${meetingId}, now(), ${overall.valence}, ${overall.arousal}, ${moodToHue(overall.valence)}, ${overall.sampleCount}, ${null}, 'face-api@1.7.15')
              ON CONFLICT DO NOTHING
            `.catch(() => null)
          }
        }, 5000)
      }

      socket.on('message', (raw: Buffer) => {
        try {
          const payload = JSON.parse(raw.toString()) as MoodPayload & {
            type?: string
            targetId?: string
            weight?: number
          }
          if (payload.participantId !== participantId) return

          // 상대방 가중치 변경 메시지
          if (payload.type === 'set_peer_weight') {
            const targetId = payload.targetId
            if (!targetId) return
            const w = Math.min(5, Math.max(0, Number(payload.weight) ?? 1))
            const c = room.clients.get(participantId)
            if (c) c.peerWeights.set(targetId, w)
            return
          }

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
