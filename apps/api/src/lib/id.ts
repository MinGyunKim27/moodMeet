import KSUID from 'ksuid'

export async function newId(prefix: string): Promise<string> {
  const ksuid = await KSUID.random()
  return `${prefix}_${ksuid.string}`
}
