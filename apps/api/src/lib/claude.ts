import https from 'https'

interface Utterance {
  transcript: string
  display_name: string
  started_at: Date
}

export async function generateSummary(
  title: string | null,
  startedAt: Date | null,
  utterances: Utterance[],
): Promise<string> {
  const API_KEY = process.env['ANTHROPIC_API_KEY'] ?? ''
  if (!API_KEY) return '> Claude API 키가 설정되지 않았습니다.\n\n발화 기록만 제공됩니다.'

  const transcript = utterances.length === 0
    ? '(발화 기록 없음)'
    : utterances.map((u) => `**${u.display_name}**: ${u.transcript}`).join('\n')

  const date = startedAt ? new Date(startedAt).toLocaleDateString('ko-KR') : '날짜 미상'

  const prompt = `다음은 화상회의 발화 기록입니다.

회의 제목: ${title ?? '(제목 없음)'}
날짜: ${date}

---
${transcript}
---

위 발화 기록을 바탕으로 한국어로 회의록을 작성해주세요.

형식:
## 회의 요약
(2~3문장으로 핵심 내용)

## 주요 논의 사항
(불릿 포인트로 3~5개)

## 결정 사항
(합의된 내용, 없으면 "없음")

## 다음 액션
(후속 과제, 없으면 "없음")`

  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => {
          try {
            const json = JSON.parse(data) as { content: { text: string }[] }
            resolve(json.content[0]?.text ?? '요약 생성 실패')
          } catch {
            reject(new Error('Claude API 응답 파싱 실패'))
          }
        })
      },
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}
