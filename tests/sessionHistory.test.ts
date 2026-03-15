import { describe, expect, it } from 'vitest'
import { clearSessionMessages, loadSessionMessages, saveSessionMessages } from '../src/sessionHistory'

describe('sessionHistory', () => {
  it('round-trips saved session messages with vocabulary intact', () => {
    const storage = createStorage()
    const messages = [
      {
        id: 'cookie-1',
        speaker: 'Cookie' as const,
        text: 'sandwich = sándwich.',
        vocabulary: [{ term: 'sándwich', translation: 'sandwich' }],
      },
    ]

    saveSessionMessages(messages, storage)

    expect(loadSessionMessages(storage)).toEqual(messages)
  })

  it('clears saved session history', () => {
    const storage = createStorage()

    saveSessionMessages(
      [
        {
          id: 'user-1',
          speaker: 'User' as const,
          text: 'Hola',
        },
      ],
      storage,
    )
    clearSessionMessages(storage)

    expect(loadSessionMessages(storage)).toEqual([])
  })
})

function createStorage(): Storage {
  const backingStore = new Map<string, string>()

  return {
    clear() {
      backingStore.clear()
    },
    getItem(key) {
      return backingStore.get(key) ?? null
    },
    key(index) {
      return [...backingStore.keys()][index] ?? null
    },
    get length() {
      return backingStore.size
    },
    removeItem(key) {
      backingStore.delete(key)
    },
    setItem(key, value) {
      backingStore.set(key, value)
    },
  }
}
