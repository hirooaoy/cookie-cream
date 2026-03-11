import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getServerConfig, type ServerConfig } from '../server/config.js'
import { resolveServerTurn } from '../server/turnService.js'
import { initialConversation, type Phase, type UserTarget } from '../src/prototype.js'

type EvalCase = {
  id: string
  category: string
  transcript: string
  expectedRoute: UserTarget
  phase?: Phase
}

type EvalSuite = {
  utterances: EvalCase[]
}

type EvalFailure = {
  id: string
  category: string
  transcript: string
  expected: UserTarget
  actual: UserTarget | 'none'
  source: string
}

const currentFilePath = fileURLToPath(import.meta.url)
const currentDir = dirname(currentFilePath)

async function main(): Promise<void> {
  const suite = await loadEvalSuite()
  const config = getEvalConfig(getServerConfig())
  const failures: EvalFailure[] = []
  const sourceCounts = new Map<string, number>()

  for (const utterance of suite.utterances) {
    const result = await resolveServerTurn(
      {
        transcript: utterance.transcript,
        phase: utterance.phase ?? 'normal',
        recentMessages: initialConversation.messages,
        learnerLanguage: 'English',
        targetLanguage: 'Spanish',
      },
      config,
    )
    const actualRoute = result.meta.route

    sourceCounts.set(result.meta.source, (sourceCounts.get(result.meta.source) ?? 0) + 1)

    if (actualRoute !== utterance.expectedRoute) {
      failures.push({
        id: utterance.id,
        category: utterance.category,
        transcript: utterance.transcript,
        expected: utterance.expectedRoute,
        actual: actualRoute,
        source: result.meta.source,
      })
    }
  }

  const total = suite.utterances.length
  const passed = total - failures.length

  console.log(`Total: ${total}`)
  console.log(`Passed: ${passed}`)
  console.log(`Failed: ${failures.length}`)

  if (sourceCounts.size > 0) {
    console.log(`Sources: ${formatSourceCounts(sourceCounts)}`)
  }

  if (failures.length > 0) {
    console.log('')
    console.log('Failed cases:')

    for (const failure of failures) {
      console.log(
        `- ${failure.id} [${failure.category}] expected=${failure.expected} actual=${failure.actual} source=${failure.source} transcript="${failure.transcript}"`,
      )
    }
  }
}

async function loadEvalSuite(): Promise<EvalSuite> {
  const filePath = join(currentDir, 'utterances.json')
  const raw = await readFile(filePath, 'utf8')

  return JSON.parse(raw) as EvalSuite
}

function getEvalConfig(config: ServerConfig): ServerConfig {
  if (!config.nova.enabled) {
    return config
  }

  if (hasAwsRuntimeConfig()) {
    return config
  }

  return {
    ...config,
    nova: {
      ...config.nova,
      enabled: false,
    },
  }
}

function hasAwsRuntimeConfig(): boolean {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID ||
      process.env.AWS_PROFILE ||
      process.env.AWS_WEB_IDENTITY_TOKEN_FILE ||
      process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI,
  )
}

function formatSourceCounts(sourceCounts: Map<string, number>): string {
  return [...sourceCounts.entries()]
    .map(([source, count]) => `${source}=${count}`)
    .join(', ')
}

main().catch((error) => {
  console.error('Route eval failed.', error)
  process.exitCode = 1
})
