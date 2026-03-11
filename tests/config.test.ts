import { describe, expect, it, vi } from 'vitest'

describe('server config defaults', () => {
  it('defaults the text model to Nova 2 Lite', async () => {
    const originalEnv = {
      DOTENV_CONFIG_PATH: process.env.DOTENV_CONFIG_PATH,
      BEDROCK_NOVA_TEXT_MODEL_ID: process.env.BEDROCK_NOVA_TEXT_MODEL_ID,
      BEDROCK_NOVA_SONIC_MODEL_ID: process.env.BEDROCK_NOVA_SONIC_MODEL_ID,
      BEDROCK_NOVA_MODEL_ID: process.env.BEDROCK_NOVA_MODEL_ID,
      BEDROCK_NOVA_ENABLED: process.env.BEDROCK_NOVA_ENABLED,
      AWS_REGION: process.env.AWS_REGION,
      AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION,
      PORT: process.env.PORT,
      BEDROCK_NOVA_VOICE_ID: process.env.BEDROCK_NOVA_VOICE_ID,
    }

    process.env.DOTENV_CONFIG_PATH = '.env.test-missing'
    delete process.env.BEDROCK_NOVA_TEXT_MODEL_ID
    delete process.env.BEDROCK_NOVA_SONIC_MODEL_ID
    delete process.env.BEDROCK_NOVA_MODEL_ID
    delete process.env.BEDROCK_NOVA_ENABLED
    delete process.env.AWS_REGION
    delete process.env.AWS_DEFAULT_REGION
    delete process.env.PORT
    delete process.env.BEDROCK_NOVA_VOICE_ID

    vi.resetModules()
    const { getServerConfig } = await import('../server/config')

    expect(getServerConfig().nova.textModelId).toBe('us.amazon.nova-2-lite-v1:0')

    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key]
        return
      }

      process.env[key] = value
    })
  })
})
