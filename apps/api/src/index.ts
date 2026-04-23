import dotenv from 'dotenv'
dotenv.config({ override: true })
import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { meetingsRoute } from './routes/meetings.js'
import { healthRoute } from './routes/health.js'
import { moodRoute } from './routes/mood.js'

const app = Fastify({ logger: { level: 'info' } })

await app.register(cors, {
  origin: (origin, cb) => {
    const allowed = [
      'http://localhost:3000',
      'http://localhost:5173',
      process.env['APP_URL'],
    ].filter(Boolean)
    // Vercel preview URLs (.vercel.app) 전체 허용
    if (!origin || allowed.includes(origin) || origin.endsWith('.vercel.app')) {
      cb(null, true)
    } else {
      cb(new Error('Not allowed by CORS'), false)
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
})
await app.register(websocket)

await app.register(healthRoute)
await app.register(meetingsRoute, { prefix: '/api/meetings' })
await app.register(moodRoute, { prefix: '/api/mood' })

const port = Number(process.env['PORT'] ?? 4000)
await app.listen({ port, host: '0.0.0.0' })
console.log(`API listening on http://localhost:${port}`)
