import type { FastifyInstance } from 'fastify'
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk'
import { z } from 'zod'
import { sql } from '../db/client.js'
import { newId } from '../lib/id.js'
import { generateSummary } from '../lib/claude.js'

const LIVEKIT_URL = process.env['LIVEKIT_URL'] ?? 'ws://localhost:7880'
const LIVEKIT_API_KEY = process.env['LIVEKIT_API_KEY'] ?? 'devkey'
const LIVEKIT_API_SECRET = process.env['LIVEKIT_API_SECRET'] ?? 'devsecret'
const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'

const createMeetingSchema = z.object({
  title: z.string().max(120).optional(),
  displayName: z.string().min(1).max(60),
  deviceId: z.string().uuid(),
})

const joinSchema = z.object({
  displayName: z.string().min(1).max(60),
  deviceId: z.string().uuid(),
})

const utteranceSchema = z.object({
  participantId: z.string(),
  transcript: z.string().min(1).max(2000),
})

export async function meetingsRoute(app: FastifyInstance) {
  // GET /api/meetings?deviceId=... — 내 미팅 목록
  app.get<{ Querystring: { deviceId?: string } }>('/', async (req, reply) => {
    const { deviceId } = req.query
    if (!deviceId) return reply.code(400).send({ code: 'BAD_REQUEST', message: 'deviceId required' })

    const rows = await sql`
      SELECT m.id, m.title, m.status,
             m.started_at AS "startedAt", m.ended_at AS "endedAt", m.created_at AS "createdAt"
      FROM meetings m
      JOIN users u ON u.id = m.host_user_id
      WHERE u.device_id = ${deviceId} AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 50
    `
    return rows
  })

  // POST /api/meetings — 미팅 생성
  app.post<{ Body: unknown }>('/', async (req, reply) => {
    const body = createMeetingSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ code: 'VALIDATION_ERROR', message: body.error.message })

    const { title, displayName, deviceId } = body.data
    const userId = await newId('usr')
    const meetingId = await newId('meet')
    const participantId = await newId('ptc')

    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO users (id, email, display_name, locale, device_id)
        VALUES (${userId}, ${`device_${deviceId.slice(0, 8)}@moodmeet.local`}, ${displayName}, 'ko', ${deviceId})
        ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
      `
      // email 충돌 시 기존 userId 가져오기
      const existing = await tx`SELECT id FROM users WHERE device_id = ${deviceId} LIMIT 1`
      const finalUserId = (existing[0]?.['id'] as string | undefined) ?? userId

      await tx`
        INSERT INTO meetings (id, host_user_id, title, status, join_token_hash, settings)
        VALUES (
          ${meetingId}, ${finalUserId}, ${title ?? null}, 'scheduled', ${meetingId},
          ${JSON.stringify({ allowRecording: false, moodEnabled: true, passwordProtected: false })}
        )
      `
      await tx`
        INSERT INTO participants (id, meeting_id, user_id, display_name, role)
        VALUES (${participantId}, ${meetingId}, ${finalUserId}, ${displayName}, 'host')
      `
    })

    const token = await buildLiveKitToken(meetingId, participantId, displayName, 'host')
    reply.code(201)
    return {
      meeting: { id: meetingId, title: title ?? null, status: 'scheduled' },
      participantId,
      token,
      livekitUrl: LIVEKIT_URL,
      joinUrl: `${APP_URL}/meeting/${meetingId}`,
    }
  })

  // GET /api/meetings/:id
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const rows = await sql`
      SELECT id, host_user_id, title, status, started_at, ended_at, settings, created_at
      FROM meetings WHERE id = ${req.params.id} AND deleted_at IS NULL
    `
    if (rows.length === 0) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Meeting not found' })
    return rows[0]
  })

  // POST /api/meetings/:id/join
  app.post<{ Params: { id: string }; Body: unknown }>('/:id/join', async (req, reply) => {
    const body = joinSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ code: 'VALIDATION_ERROR', message: body.error.message })

    const { displayName, deviceId } = body.data
    const { id: meetingId } = req.params

    const meetings = await sql`SELECT id, status FROM meetings WHERE id = ${meetingId} AND deleted_at IS NULL`
    if (meetings.length === 0) return reply.code(404).send({ code: 'NOT_FOUND', message: 'Meeting not found' })
    if (['ended', 'archived'].includes(meetings[0]!['status'] as string))
      return reply.code(410).send({ code: 'MEETING_ENDED', message: 'Meeting has ended' })

    const userId = await newId('usr')
    const participantId = await newId('ptc')

    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO users (id, email, display_name, locale, device_id)
        VALUES (${userId}, ${`device_${deviceId.slice(0, 8)}@moodmeet.local`}, ${displayName}, 'ko', ${deviceId})
        ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
      `
      await tx`
        INSERT INTO participants (id, meeting_id, user_id, display_name, role)
        VALUES (${participantId}, ${meetingId}, ${userId}, ${displayName}, 'member')
        ON CONFLICT (meeting_id, user_id) DO NOTHING
      `
      await tx`
        UPDATE meetings SET status = 'live', started_at = now()
        WHERE id = ${meetingId} AND status = 'scheduled'
      `
    })

    const token = await buildLiveKitToken(meetingId, participantId, displayName, 'member')
    return { token, livekitUrl: LIVEKIT_URL, participantId }
  })

  // POST /api/meetings/:id/utterances — 발화 저장
  app.post<{ Params: { id: string }; Body: unknown }>('/:id/utterances', async (req, reply) => {
    const body = utteranceSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ code: 'VALIDATION_ERROR', message: body.error.message })

    const { participantId, transcript } = body.data
    const uttId = await newId('utt')

    await sql`
      INSERT INTO utterances (id, meeting_id, ptc_id, started_at, ended_at, transcript)
      VALUES (${uttId}, ${req.params.id}, ${participantId}, now() - interval '5 seconds', now(), ${transcript})
    `
    reply.code(201)
    return { id: uttId }
  })

  // GET /api/meetings/:id/utterances — 전체 발화 목록
  app.get<{ Params: { id: string } }>('/:id/utterances', async (req, reply) => {
    const rows = await sql`
      SELECT u.transcript, p.display_name AS "displayName",
             u.started_at AS "startedAt"
      FROM utterances u JOIN participants p ON p.id = u.ptc_id
      WHERE u.meeting_id = ${req.params.id}
      ORDER BY u.started_at ASC
    `
    return rows
  })

  // GET /api/meetings/:id/summary
  app.get<{ Params: { id: string } }>('/:id/summary', async (req, reply) => {
    const rows = await sql`
      SELECT summary_md AS "summaryMd", generated_at AS "generatedAt"
      FROM meeting_minutes WHERE meeting_id = ${req.params.id}
    `
    if (rows.length === 0) return { meetingId: req.params.id, hasSummary: false, summaryMd: '', generatedAt: null }
    return { meetingId: req.params.id, hasSummary: true, ...rows[0] }
  })

  // POST /api/meetings/:id/summary — Claude로 요약 생성
  app.post<{ Params: { id: string } }>('/:id/summary', async (req, reply) => {
    const { id: meetingId } = req.params

    // 미팅 정보 + 발화 목록 조회
    const [meetingRows, utteranceRows] = await Promise.all([
      sql`SELECT title, started_at, ended_at FROM meetings WHERE id = ${meetingId}`,
      sql`
        SELECT u.transcript, p.display_name, u.started_at
        FROM utterances u JOIN participants p ON p.id = u.ptc_id
        WHERE u.meeting_id = ${meetingId}
        ORDER BY u.started_at ASC
      `,
    ])

    if (meetingRows.length === 0) return reply.code(404).send({ code: 'NOT_FOUND' })
    const meeting = meetingRows[0]!

    const summaryMd = await generateSummary(
      meeting['title'] as string | null,
      meeting['started_at'] as Date | null,
      utteranceRows as unknown as { transcript: string; display_name: string; started_at: Date }[],
    )

    await sql`
      INSERT INTO meeting_minutes (meeting_id, summary_md, top_moments, llm_model, generated_at)
      VALUES (${meetingId}, ${summaryMd}, '[]', 'claude-sonnet-4-6', now())
      ON CONFLICT (meeting_id) DO UPDATE SET summary_md = EXCLUDED.summary_md, generated_at = now()
    `

    reply.code(201)
    return { meetingId, hasSummary: true, summaryMd, generatedAt: new Date().toISOString() }
  })

  // DELETE /api/meetings/:id — 미팅 종료
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    await sql`UPDATE meetings SET status = 'ended', ended_at = now() WHERE id = ${req.params.id}`
    const svc = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
    await svc.deleteRoom(req.params.id).catch(() => null)
    reply.code(204)
  })
}

async function buildLiveKitToken(meetingId: string, participantId: string, displayName: string, role: string) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantId, name: displayName, ttl: '2h',
  })
  at.addGrant({ roomJoin: true, room: meetingId, canPublish: role !== 'guest', canSubscribe: true, canPublishData: true })
  return at.toJwt()
}
