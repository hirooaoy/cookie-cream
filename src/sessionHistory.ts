import type { Message } from './prototype'

const sessionMessagesStorageKey = 'cookie-cream/session-messages'

export function loadSessionMessages(storage: Storage | null | undefined = getSessionStorage()): Message[] {
  if (!storage) {
    return []
  }

  try {
    const rawValue = storage.getItem(sessionMessagesStorageKey)

    if (!rawValue) {
      return []
    }

    const parsed = JSON.parse(rawValue) as unknown

    return Array.isArray(parsed) ? parsed.filter(isMessage) : []
  } catch {
    return []
  }
}

export function saveSessionMessages(
  messages: Message[],
  storage: Storage | null | undefined = getSessionStorage(),
): void {
  if (!storage) {
    return
  }

  try {
    if (messages.length === 0) {
      storage.removeItem(sessionMessagesStorageKey)
      return
    }

    storage.setItem(sessionMessagesStorageKey, JSON.stringify(messages))
  } catch {
    // Ignore storage failures so practice can continue normally.
  }
}

export function clearSessionMessages(storage: Storage | null | undefined = getSessionStorage()): void {
  if (!storage) {
    return
  }

  try {
    storage.removeItem(sessionMessagesStorageKey)
  } catch {
    // Ignore storage failures so practice can continue normally.
  }
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.sessionStorage
}

function isMessage(value: unknown): value is Message {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isSpeaker(value.speaker) &&
    typeof value.text === 'string' &&
    (value.target === undefined || value.target === 'Cream' || value.target === 'Cookie') &&
    (value.vocabulary === undefined || isVocabularyList(value.vocabulary))
  )
}

function isVocabularyList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) => isRecord(entry) && typeof entry.term === 'string' && typeof entry.translation === 'string',
    )
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isSpeaker(value: unknown): boolean {
  return value === 'Cream' || value === 'Cookie' || value === 'User' || value === 'System'
}
