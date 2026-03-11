import 'dotenv/config'

export type ServerConfig = {
  port: number
  nova: {
    enabled: boolean
    region: string
    textModelId: string
    sonicModelId: string
    voiceId: string
  }
}

const DEFAULT_PORT = 8787
const DEFAULT_REGION = 'us-east-1'
const DEFAULT_TEXT_MODEL_ID = 'us.amazon.nova-2-lite-v1:0'
const DEFAULT_SONIC_MODEL_ID = 'amazon.nova-2-sonic-v1:0'
const DEFAULT_VOICE_ID = 'matthew'

export function getServerConfig(): ServerConfig {
  return {
    port: parseInteger(process.env.PORT, DEFAULT_PORT),
    nova: {
      enabled: parseBoolean(process.env.BEDROCK_NOVA_ENABLED, true),
      region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? DEFAULT_REGION,
      textModelId: process.env.BEDROCK_NOVA_TEXT_MODEL_ID ?? DEFAULT_TEXT_MODEL_ID,
      sonicModelId: process.env.BEDROCK_NOVA_SONIC_MODEL_ID ?? process.env.BEDROCK_NOVA_MODEL_ID ?? DEFAULT_SONIC_MODEL_ID,
      voiceId: process.env.BEDROCK_NOVA_VOICE_ID ?? DEFAULT_VOICE_ID,
    },
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback
  }

  const normalized = value.trim().toLowerCase()

  if (normalized === 'true') {
    return true
  }

  if (normalized === 'false') {
    return false
  }

  return fallback
}

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number.parseInt(value, 10)

  return Number.isNaN(parsed) ? fallback : parsed
}
