import https from 'https'

interface Utterance {
  transcript: string
  display_name: string
  started_at: Date
}

interface Participant {
  display_name: string
  role: string
}

function formatDuration(startedAt: Date | null, endedAt: Date | null): string {
  if (!startedAt) return '시간 미상'
  const end = endedAt ? new Date(endedAt) : new Date()
  const start = new Date(startedAt)
  const diffMs = end.getTime() - start.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return '1분 미만'
  if (mins < 60) return `약 ${mins}분`
  return `약 ${Math.floor(mins / 60)}시간 ${mins % 60}분`
}

export async function generateSummary(
  title: string | null,
  startedAt: Date | null,
  endedAt: Date | null,
  utterances: Utterance[],
  participants: Participant[],
): Promise<string> {
  const API_KEY = process.env['ANTHROPIC_API_KEY'] ?? ''
  if (!API_KEY) return '> Claude API 키가 설정되지 않았습니다.\n\n발화 기록만 제공됩니다.'

  const date = startedAt
    ? new Date(startedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '날짜 미상'
  const duration = formatDuration(startedAt, endedAt)

  // 참여자 목록 포맷 (호스트 먼저, 이름 뒤에 역할 표시)
  const participantList = participants.length === 0
    ? '(참여자 정보 없음)'
    : participants
        .map((p) => p.role === 'host' ? `${p.display_name} (진행자)` : p.display_name)
        .join(', ')

  const transcript = utterances.length === 0
    ? '(발화 기록 없음)'
    : utterances.map((u) => `**${u.display_name}**: ${u.transcript}`).join('\n')

  const prompt = `다음은 화상회의 발화 기록입니다.

회의 제목: ${title ?? '(제목 없음)'}
일시: ${date}
소요 시간: ${duration}
참여자 (${participants.length}명): ${participantList}

---
${transcript}
---

위 정보를 바탕으로 한국어로 회의록을 작성해주세요.

형식:
## 회의 정보
- **일시**: (날짜 및 시간)
- **소요 시간**: (시간)
- **참여자**: (진행자와 참여자 구분하여 목록)

## 회의 요약
(2~3문장으로 핵심 내용 요약)

## 주요 논의 사항
(불릿 포인트로 3~5개)

## 결정 사항
(합의된 내용, 없으면 "없음")

## 다음 액션
(후속 과제 및 담당자, 없으면 "없음")`

  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
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
