import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import CookieAvatar from './assets/Cookie.png'
import CreamAvatar from './assets/Cream.png'
import CafeMenuScene from './assets/CafeMenuScene.svg'
import { getBubbleTextSegments, getInlineQuoteTextSegments } from './messageText'
import { initialConversation, type ConversationState, type Message, type Speaker } from './prototype'
import {
  createSpeechRecognition,
  extractSpeechTranscript,
  getSpeechRecognitionErrorMessage,
  isSpeechRecognitionSupported,
  type BrowserSpeechRecognition,
} from './speechRecognition'
import { fetchSessionRecapWithFallback } from './recapClient'
import type { SessionRecap } from './recapApi'
import { buildSessionRecapPresentation } from './recapPresentation'
import { submitTurnWithFallback } from './turnClient'
import type { TurnMeta } from './turnApi'
import { translateMessageWithFallback } from './translationClient'
import { selectPreferredVoice } from './voiceSelection'

type PartnerSpeaker = Exclude<Speaker, 'User'>
type ScenarioStarter = {
  id: string
  label: string
  openingPrompt: string
}
type MessageTranslationState = {
  isLoading: boolean
  isVisible: boolean
  text?: string
}
type DropdownOption = {
  value: string
  label: string
  description?: string
  badge?: string
  disabled?: boolean
}
type LanguageDropdownProps = {
  label: string
  onChange: (value: string) => void
  options: DropdownOption[]
  value: string
}
type FloatingPanelStyle = {
  bottom?: number
  left: number
  maxHeight: number
  top?: number
  width: number
}

const avatarBySpeaker: Record<PartnerSpeaker, string> = {
  Cream: CreamAvatar,
  Cookie: CookieAvatar,
}

const scenarioStarters: ScenarioStarter[] = [
  {
    id: 'introduce-yourself',
    label: 'Introduce yourself',
    openingPrompt: 'Hola. ¿Cómo te llamas y qué hiciste hoy?',
  },
  {
    id: 'cafe-order',
    label: 'Cafe order',
    openingPrompt: 'Hola. ¿Qué quieres pedir?',
  },
  {
    id: 'finding-restaurant',
    label: 'Finding restaurant',
    openingPrompt: 'Hola. ¿Buscas un restaurante?',
  },
]

const rotatingQuotes = [
  '今日はveryあついですね',
  '我们要 discuss 那个新的 project',
  'Ayer I missed el autobús otra vez',
  'Ich brauche eine small pause.',
  'मुझे tomorrow तक यह finish करना है',
]

const amazonNovaUrl = 'https://aws.amazon.com/nova/'
const amazonBedrockUrl = 'https://aws.amazon.com/bedrock/'
const practiceLanguageOptions: DropdownOption[] = [
  {
    value: 'Spanish',
    label: 'Spanish',
  },
  {
    value: 'practice-other',
    label: 'More languages',
    description: 'French, Japanese, and more are on the way.',
    badge: 'Soon',
    disabled: true,
  },
]
const nativeLanguageOptions: DropdownOption[] = [
  {
    value: 'English',
    label: 'English',
  },
  {
    value: 'native-other',
    label: 'More native languages',
    description: 'Additional coaching languages are coming soon.',
    badge: 'Soon',
    disabled: true,
  },
]

function LanguageDropdown({ label, onChange, options, value }: LanguageDropdownProps) {
  const interactiveOptions = options.filter((option) => !option.disabled)
  const staticOptions = options.filter((option) => option.disabled)
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    getSelectedEnabledOptionIndex(interactiveOptions, value),
  )
  const [panelPlacement, setPanelPlacement] = useState<'bottom' | 'top'>('bottom')
  const [panelStyle, setPanelStyle] = useState<FloatingPanelStyle | null>(null)
  const fieldLabelId = useId()
  const triggerId = useId()
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const selectedOption =
    options.find((option) => option.value === value) ??
    interactiveOptions[0] ??
    options[0]
  const hasSelectedOptionMeta = Boolean(selectedOption.description || selectedOption.badge)
  const selectedBadgeClassName = selectedOption.badge?.toLowerCase()

  const closeDropdown = (restoreFocus: boolean) => {
    setIsOpen(false)
    setPanelStyle(null)

    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus()
      })
    }
  }

  const updatePanelPosition = () => {
    const trigger = triggerRef.current

    if (!trigger) {
      return
    }

    const rect = trigger.getBoundingClientRect()
    const viewportPadding = 16
    const panelGap = 12
    const availableBelow = window.innerHeight - rect.bottom - panelGap - viewportPadding
    const availableAbove = rect.top - panelGap - viewportPadding
    const shouldOpenAbove = availableBelow < 180 && availableAbove > availableBelow
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2)
    const left = Math.min(Math.max(rect.left, viewportPadding), window.innerWidth - width - viewportPadding)
    const maxHeight = Math.max(120, Math.min(360, shouldOpenAbove ? availableAbove : availableBelow))

    setPanelPlacement(shouldOpenAbove ? 'top' : 'bottom')
    setPanelStyle(
      shouldOpenAbove
        ? {
            bottom: window.innerHeight - rect.top + panelGap,
            left,
            maxHeight,
            width,
          }
        : {
            left,
            maxHeight,
            top: rect.bottom + panelGap,
            width,
          },
    )
  }

  const openDropdown = (index = getSelectedEnabledOptionIndex(interactiveOptions, value)) => {
    setHighlightedIndex(index)
    updatePanelPosition()
    setIsOpen(true)
  }

  const handleSelect = (nextValue: string) => {
    if (nextValue === value) {
      closeDropdown(true)
      return
    }

    onChange(nextValue)
    closeDropdown(true)
  }

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()

      if (!isOpen) {
        openDropdown(getSelectedEnabledOptionIndex(interactiveOptions, value))
        return
      }

      setHighlightedIndex((currentIndex) => getNextEnabledOptionIndex(interactiveOptions, currentIndex, 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()

      if (!isOpen) {
        openDropdown(getLastEnabledOptionIndex(interactiveOptions))
        return
      }

      setHighlightedIndex((currentIndex) => getNextEnabledOptionIndex(interactiveOptions, currentIndex, -1))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      openDropdown(getFirstEnabledOptionIndex(interactiveOptions))
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      openDropdown(getLastEnabledOptionIndex(interactiveOptions))
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()

      if (!isOpen) {
        openDropdown()
        return
      }

      const highlightedOption = interactiveOptions[highlightedIndex]

      if (highlightedOption && !highlightedOption.disabled) {
        handleSelect(highlightedOption.value)
      }

      return
    }

    if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      closeDropdown(true)
    }
  }

  const handleOptionKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlightedIndex(getNextEnabledOptionIndex(interactiveOptions, index, 1))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlightedIndex(getNextEnabledOptionIndex(interactiveOptions, index, -1))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setHighlightedIndex(getFirstEnabledOptionIndex(interactiveOptions))
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setHighlightedIndex(getLastEnabledOptionIndex(interactiveOptions))
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeDropdown(true)
      return
    }

    if (event.key === 'Tab') {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    updatePanelPosition()

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node

      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return
      }

      closeDropdown(false)
    }

    const handleWindowChange = () => {
      updatePanelPosition()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('resize', handleWindowChange)
    window.addEventListener('scroll', handleWindowChange, true)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('resize', handleWindowChange)
      window.removeEventListener('scroll', handleWindowChange, true)
    }
  }, [isOpen])

  useEffect(() => {
    setHighlightedIndex(getSelectedEnabledOptionIndex(interactiveOptions, value))
  }, [options, value])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const optionToFocus = optionRefs.current[highlightedIndex]

    if (!optionToFocus) {
      return
    }

    const frameId = window.requestAnimationFrame(() => {
      optionToFocus.focus()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [highlightedIndex, isOpen])

  return (
    <div className="home-field">
      <span className="home-field-label" id={fieldLabelId}>
        {label}
      </span>
      <div className={`home-dropdown${isOpen ? ' home-dropdown--open' : ''}`} ref={rootRef}>
        <button
          aria-controls={listboxId}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-labelledby={`${fieldLabelId} ${triggerId}`}
          className={`home-dropdown-trigger${hasSelectedOptionMeta ? '' : ' home-dropdown-trigger--compact'}`}
          id={triggerId}
          type="button"
          onClick={() => (isOpen ? closeDropdown(false) : openDropdown())}
          onKeyDown={handleTriggerKeyDown}
          ref={triggerRef}
        >
          <span className="home-dropdown-trigger-copy">
            <span className="home-dropdown-trigger-label">{selectedOption.label}</span>
            {selectedOption.description ? (
              <span className="home-dropdown-trigger-description">{selectedOption.description}</span>
            ) : null}
          </span>
          {selectedOption.badge && selectedBadgeClassName ? (
            <span className={`home-dropdown-trigger-badge home-dropdown-trigger-badge--${selectedBadgeClassName}`}>
              {selectedOption.badge}
            </span>
          ) : null}
          <svg aria-hidden="true" className="home-dropdown-icon" viewBox="0 0 16 16">
            <path d="M4 6.5 8 10.5l4-4" />
          </svg>
        </button>

        {isOpen && panelStyle && typeof document !== 'undefined'
          ? createPortal(
              <div
                className={`home-dropdown-panel home-dropdown-panel--${panelPlacement}`}
                ref={panelRef}
                style={panelStyle}
              >
                <div aria-labelledby={fieldLabelId} className="home-dropdown-list" id={listboxId} role="listbox">
                  {interactiveOptions.map((option, index) => {
                    const isSelected = option.value === value
                    const isHighlighted = index === highlightedIndex
                    const optionBadgeClassName = option.badge?.toLowerCase()

                    return (
                      <button
                        key={option.value}
                        aria-disabled={option.disabled || undefined}
                        aria-selected={isSelected}
                        className={`home-dropdown-option${isSelected ? ' home-dropdown-option--selected' : ''}${
                          isHighlighted ? ' home-dropdown-option--highlighted' : ''
                        }${option.disabled ? ' home-dropdown-option--disabled' : ''}`}
                        disabled={option.disabled}
                        id={`${listboxId}-option-${index}`}
                        role="option"
                        type="button"
                        onClick={() => handleSelect(option.value)}
                        onKeyDown={(event) => handleOptionKeyDown(event, index)}
                        onMouseEnter={() => {
                          if (!option.disabled) {
                            setHighlightedIndex(index)
                          }
                        }}
                        ref={(node) => {
                          optionRefs.current[index] = node
                        }}
                      >
                        <span className="home-dropdown-option-copy">
                          <span className="home-dropdown-option-label">{option.label}</span>
                          {option.description ? (
                            <span className="home-dropdown-option-description">{option.description}</span>
                          ) : null}
                        </span>
                        <span className="home-dropdown-option-meta">
                          {option.badge && optionBadgeClassName ? (
                            <span
                              className={`home-dropdown-option-badge home-dropdown-option-badge--${optionBadgeClassName}`}
                            >
                              {option.badge}
                            </span>
                          ) : null}
                          {!option.disabled && isSelected ? (
                            <svg aria-hidden="true" className="home-dropdown-option-check" viewBox="0 0 16 16">
                              <path d="M3.5 8.5 6.5 11.5 12.5 5.5" />
                            </svg>
                          ) : null}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {staticOptions.length > 0 ? (
                  <div className="home-dropdown-static-list">
                    {staticOptions.map((option) => {
                      const optionBadgeClassName = option.badge?.toLowerCase()

                      return (
                        <div className="home-dropdown-static-item" key={option.value}>
                          <span className="home-dropdown-option-copy">
                            <span className="home-dropdown-option-label">{option.label}</span>
                            {option.description ? (
                              <span className="home-dropdown-option-description">{option.description}</span>
                            ) : null}
                          </span>
                          {option.badge && optionBadgeClassName ? (
                            <span
                              className={`home-dropdown-option-badge home-dropdown-option-badge--${optionBadgeClassName}`}
                            >
                              {option.badge}
                            </span>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ) : null}
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>
  )
}

function App() {
  const [hasStarted, setHasStarted] = useState(false)
  const [learningLanguage, setLearningLanguage] = useState('Spanish')
  const [fluentLanguage, setFluentLanguage] = useState('English')
  const [conversation, setConversation] = useState<ConversationState>(initialConversation)
  const [draft, setDraft] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [selectedStarterId, setSelectedStarterId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [speechStatusMessage, setSpeechStatusMessage] = useState<string | null>(null)
  const [turnMeta, setTurnMeta] = useState<TurnMeta | null>(null)
  const [sessionRecap, setSessionRecap] = useState<SessionRecap | null>(null)
  const [isRecapLoading, setIsRecapLoading] = useState(false)
  const [isRecapModalOpen, setIsRecapModalOpen] = useState(false)
  const [messageTranslations, setMessageTranslations] = useState<Record<string, MessageTranslationState>>({})
  const [speakingSpeaker, setSpeakingSpeaker] = useState<PartnerSpeaker | null>(null)
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const draftInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const speechBaseDraftRef = useRef('')
  const finalizedSpeechRef = useRef('')
  const availableVoicesRef = useRef<SpeechSynthesisVoice[]>([])
  const lastAutoSpokenMessageIdRef = useRef<string | null>(null)
  const messages = conversation.messages
  const speechSupported = isSpeechRecognitionSupported()
  const hasDraft = draft.trim().length > 0
  const userTurnCount = messages.filter((message) => message.speaker === 'User').length
  const canRequestRecap = userTurnCount >= 1
  const shouldShowStarters = userTurnCount === 0 && selectedStarterId === null
  const visibleMessages = shouldShowStarters ? [] : messages
  const latestAssistantMessage = findLatestAssistantMessage(visibleMessages)
  const currentQuote = rotatingQuotes[currentQuoteIndex]
  const isCafeOrderScenario = selectedStarterId === 'cafe-order'
  const activeCallSpeaker: PartnerSpeaker =
    speakingSpeaker ?? (latestAssistantMessage?.speaker === 'Cookie' ? 'Cookie' : 'Cream')
  const callPanelSpeaker: PartnerSpeaker = isCafeOrderScenario ? 'Cream' : activeCallSpeaker
  const callPanelRole =
    callPanelSpeaker === 'Cookie' ? 'I jump in to teach you' : "I'm your chatty partner"
  const isCallPanelSpeaking = speakingSpeaker === callPanelSpeaker
  const modelAttributionModelId = turnMeta?.modelId
  const recapPresentation = sessionRecap
    ? buildSessionRecapPresentation(sessionRecap, conversation.messages)
    : null

  const scrollTranscriptToBottom = () => {
    const transcript = transcriptRef.current

    if (!transcript) {
      return
    }

    transcript.scrollTop = transcript.scrollHeight
  }

  const playMessageSpeech = (message: Message, options: { announceUnsupported?: boolean } = {}) => {
    const { announceUnsupported = true } = options

    if (message.speaker === 'User') {
      return false
    }

    if (
      typeof window === 'undefined' ||
      typeof SpeechSynthesisUtterance === 'undefined' ||
      typeof window.speechSynthesis === 'undefined'
    ) {
      if (announceUnsupported) {
        setSpeechStatusMessage('Speech playback is not supported in this browser.')
      }

      return false
    }

    window.speechSynthesis.cancel()
    setSpeakingSpeaker(null)

    const utterance = new SpeechSynthesisUtterance(message.text)
    const preferredVoice = selectPreferredVoice(
      availableVoicesRef.current.length > 0 ? availableVoicesRef.current : window.speechSynthesis.getVoices(),
      message.speaker === 'Cookie' ? 'Cookie' : 'Cream',
    )
    utterance.lang = preferredVoice?.lang ?? (message.speaker === 'Cream' ? 'es-ES' : 'en-US')
    utterance.voice = preferredVoice
    utterance.rate = 0.95
    utterance.onstart = () => {
      setSpeakingSpeaker(message.speaker === 'Cookie' ? 'Cookie' : 'Cream')
      setSpeechStatusMessage(null)
    }
    utterance.onend = () => {
      setSpeakingSpeaker(null)
    }
    utterance.onerror = () => {
      setSpeakingSpeaker(null)
      setSpeechStatusMessage('Speech playback failed. Try again.')
    }

    window.speechSynthesis.speak(utterance)

    return true
  }

  useEffect(() => {
    scrollTranscriptToBottom()
  }, [messages])

  useEffect(() => {
    if (!sessionRecap) {
      return
    }

    scrollTranscriptToBottom()
  }, [sessionRecap])

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      window.speechSynthesis?.cancel()
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') {
      return
    }

    const handleVoicesChanged = () => {
      availableVoicesRef.current = window.speechSynthesis.getVoices()
    }

    handleVoicesChanged()
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged)
    }
  }, [])

  useEffect(() => {
    if (!isRecapModalOpen) {
      return
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsRecapModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isRecapModalOpen])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentQuoteIndex((index) => (index + 1) % rotatingQuotes.length)
    }, 3200)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    if (!hasStarted) {
      return
    }

    draftInputRef.current?.focus()
  }, [hasStarted])

  useEffect(() => {
    if (!hasStarted) {
      return
    }

    if (!latestAssistantMessage) {
      lastAutoSpokenMessageIdRef.current = null
      return
    }

    if (latestAssistantMessage.id === lastAutoSpokenMessageIdRef.current) {
      return
    }

    // Only auto-play once per assistant turn; the speak button remains a manual replay.
    lastAutoSpokenMessageIdRef.current = latestAssistantMessage.id
    playMessageSpeech(latestAssistantMessage, { announceUnsupported: false })
  }, [hasStarted, latestAssistantMessage])

  const submitText = async (rawText: string) => {
    const text = rawText.trim()

    if (!text || isSubmitting) {
      return
    }

    recognitionRef.current?.abort()
    window.speechSynthesis?.cancel()
    setSpeakingSpeaker(null)
    setIsListening(false)
    setLiveTranscript('')
    setSpeechStatusMessage(null)
    setIsSubmitting(true)
    setSessionRecap(null)
    setIsRecapModalOpen(false)

    try {
      const result = await submitTurnWithFallback(conversation, text)

      console.info('Turn response meta:', { ...result.meta, delivery: result.delivery })
      setConversation(result.conversation)
      setTurnMeta(result.meta)
      setDraft('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRecapRequest = async () => {
    if (isRecapLoading || isSubmitting || !canRequestRecap) {
      return
    }

    setIsRecapModalOpen(true)

    if (sessionRecap) {
      return
    }

    setIsRecapLoading(true)

    try {
      const result = await fetchSessionRecapWithFallback(conversation)

      console.info('Session recap meta:', { ...result.meta, delivery: result.delivery })
      setSessionRecap(result.recap)
    } finally {
      setIsRecapLoading(false)
    }
  }

  const handleStarterClick = (starter: ScenarioStarter) => {
    if (isSubmitting || isListening) {
      return
    }

    setConversation({
      phase: 'normal',
      messages: [
        {
          id: 'cream-1',
          speaker: 'Cream',
          text: starter.openingPrompt,
        },
      ],
    })
    window.speechSynthesis?.cancel()
    setSpeakingSpeaker(null)
    setSelectedStarterId(starter.id)
    setDraft('')
    setMessageTranslations({})
    setSessionRecap(null)
    setIsRecapModalOpen(false)
    setSpeechStatusMessage(null)
    setLiveTranscript('')
    scrollTranscriptToBottom()
  }

  const handleRecapModalClose = () => {
    setIsRecapModalOpen(false)
  }

  const handlePracticeFromScratch = () => {
    recognitionRef.current?.abort()
    window.speechSynthesis?.cancel()
    lastAutoSpokenMessageIdRef.current = null
    setConversation(initialConversation)
    setSelectedStarterId(null)
    setDraft('')
    setIsListening(false)
    setLiveTranscript('')
    setSpeechStatusMessage(null)
    setTurnMeta(null)
    setSessionRecap(null)
    setIsRecapModalOpen(false)
    setMessageTranslations({})
    setSpeakingSpeaker(null)
  }

  const handleReturnHome = () => {
    window.speechSynthesis?.cancel()
    setSpeakingSpeaker(null)
    setHasStarted(false)
    setMessageTranslations({})
    setIsRecapModalOpen(false)
  }

  const handleSpeechStart = () => {
    if (isSubmitting) {
      return
    }

    if (!speechSupported) {
      setSpeechStatusMessage('Speech input is not supported in this browser.')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = createSpeechRecognition()

    if (!recognition) {
      setSpeechStatusMessage('Speech input is not supported in this browser.')
      return
    }

    recognitionRef.current?.abort()
    recognitionRef.current = recognition
    speechBaseDraftRef.current = draft.trim()
    finalizedSpeechRef.current = ''
    setLiveTranscript('')
    setSpeechStatusMessage(null)

    recognition.onstart = () => {
      setIsListening(true)
      scrollTranscriptToBottom()
    }

    recognition.onresult = (event) => {
      const transcriptSnapshot = extractSpeechTranscript(event, finalizedSpeechRef.current)
      finalizedSpeechRef.current = transcriptSnapshot.finalizedText

      if (!transcriptSnapshot.transcriptText) {
        return
      }

      setLiveTranscript(transcriptSnapshot.transcriptText)
      setDraft(mergeDraftWithSpeech(speechBaseDraftRef.current, transcriptSnapshot.transcriptText))
      scrollTranscriptToBottom()
    }

    recognition.onerror = (event) => {
      setLiveTranscript('')
      setSpeechStatusMessage(getSpeechRecognitionErrorMessage(event.error))
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
      setLiveTranscript('')

      if (finalizedSpeechRef.current) {
        setDraft(mergeDraftWithSpeech(speechBaseDraftRef.current, finalizedSpeechRef.current))
      }
    }

    recognition.start()
  }

  const handleMessageSpeak = (message: Message) => {
    playMessageSpeech(message)
  }

  const handleMessageActionPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.currentTarget.blur()
  }

  const handleMessageTranslate = async (message: Message) => {
    if (message.speaker !== 'Cream') {
      return
    }

    const currentTranslation = messageTranslations[message.id]

    if (currentTranslation?.isLoading) {
      return
    }

    if (currentTranslation?.text) {
      setMessageTranslations((currentTranslations) => ({
        ...currentTranslations,
        [message.id]: {
          ...currentTranslation,
          isVisible: !currentTranslation.isVisible,
        },
      }))
      return
    }

    setMessageTranslations((currentTranslations) => ({
      ...currentTranslations,
      [message.id]: {
        isLoading: true,
        isVisible: true,
      },
    }))

    try {
      const result = await translateMessageWithFallback(message)

      console.info('Translation meta:', { ...result.meta, delivery: result.delivery, messageId: message.id })
      setMessageTranslations((currentTranslations) => ({
        ...currentTranslations,
        [message.id]: {
          isLoading: false,
          isVisible: true,
          text: result.translation,
        },
      }))
    } catch (error) {
      console.warn('Translation request failed.', error)
      setMessageTranslations((currentTranslations) => ({
        ...currentTranslations,
        [message.id]: {
          isLoading: false,
          isVisible: true,
          text: 'Translation unavailable right now.',
        },
      }))
    }
  }

  const inputPlaceholder = isListening
    ? liveTranscript
      ? ''
      : 'Listening...'
    : 'Use microphone or start typing'

  const handleDraftChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value)
    setLiveTranscript('')

    if (speechSupported) {
      setSpeechStatusMessage(null)
    }

    scrollTranscriptToBottom()
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isListening || isSubmitting || !hasDraft) {
      return
    }

    void submitText(draft)
  }

  if (!hasStarted) {
    return (
      <main className="home-screen">
        <header className="home-header">
          <div className="home-header-inner">
            <button className="home-header-brand" type="button" onClick={handleReturnHome}>
              Cookie &amp; Cream
            </button>
            <span className="home-header-pill">Demo Only</span>
          </div>
        </header>

        <section className="home-hero" aria-label="Cookie and Cream start screen">
          <div className="home-hero-main">
            <div className="home-hero-copy">
              <h1 aria-label="Cookie and Cream" className="home-title home-title--icons">
                <span
                  className="home-agent-badge-anchor home-agent-badge-anchor--cookie"
                  aria-label="I'm Cookie. I jump in to teach you."
                  tabIndex={0}
                >
                  <span className="home-agent-badge">
                    <img className="home-agent-badge-image" src={CookieAvatar} alt="" />
                  </span>
                  <span className="home-agent-tooltip">I&apos;m Cookie. I jump in to teach you.</span>
                </span>
                <span
                  className="home-agent-badge-anchor home-agent-badge-anchor--cream"
                  aria-label="I'm Cream. I'm your chatty partner."
                  tabIndex={0}
                >
                  <span className="home-agent-badge">
                    <img className="home-agent-badge-image" src={CreamAvatar} alt="" />
                  </span>
                  <span className="home-agent-tooltip">I&apos;m Cream. I&apos;m your chatty partner.</span>
                </span>
              </h1>
              <p className="home-subtitle">
                For <em>intermediate</em> speakers that say{' '}
                <span className="home-inline-quote" key={currentQuote}>
                  &quot;{renderInlineQuoteText(currentQuote)}&quot;
                </span>
              </p>
            </div>

            <div className="home-setup-stack">
              <div className="home-language-card" aria-label="Language setup">
                <LanguageDropdown
                  label="Practice"
                  options={practiceLanguageOptions}
                  value={learningLanguage}
                  onChange={setLearningLanguage}
                />

                <LanguageDropdown
                  label="Native language"
                  options={nativeLanguageOptions}
                  value={fluentLanguage}
                  onChange={setFluentLanguage}
                />
              </div>

              <button className="home-start-button" type="button" onClick={() => setHasStarted(true)}>
                Start Practice
              </button>
            </div>
          </div>
        </section>

        <footer className="home-disclaimer" aria-label="Project disclaimer">
          <p className="home-disclaimer-text">
            Built for the{' '}
            <a
              className="home-disclaimer-link"
              href="https://amazon-nova.devpost.com"
              target="_blank"
              rel="noreferrer"
            >
              Amazon Nova Hackathon
            </a>
            . Cookie &amp; Cream uses Amazon Nova on Amazon Bedrock for reviewed transcript turns,
            session recaps, and on-demand translation.
          </p>
        </footer>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="home-header">
        <div className="home-header-inner">
          <button className="home-header-brand" type="button" onClick={handleReturnHome}>
            Cookie &amp; Cream
          </button>
          <button
            className="recap-button home-header-recap"
            disabled={!canRequestRecap || isSubmitting || isRecapLoading}
            type="button"
            onClick={handleRecapRequest}
          >
            {isRecapLoading ? 'Preparing recap...' : 'Session recap'}
          </button>
        </div>
      </header>

      <section className="app-body" aria-label="Cookie and Cream prototype">
        <div className="chat-layout">
          <aside
            className={`call-panel${isCafeOrderScenario ? ' call-panel--stacked' : ''}`}
            aria-label={`${callPanelSpeaker} call panel`}
          >
            <div
              className={`call-panel-card call-panel-card--${callPanelSpeaker.toLowerCase()}${
                isCallPanelSpeaking ? ' call-panel-card--speaking' : ''
              }${isCafeOrderScenario ? ' call-panel-card--scenario' : ''}`}
            >
              <img
                className="call-panel-image"
                src={avatarBySpeaker[callPanelSpeaker]}
                alt={`${callPanelSpeaker} profile`}
              />
              <div className="call-panel-meta">
                <p className="call-panel-name">{callPanelSpeaker} agent</p>
                <p className="call-panel-role">{callPanelRole}</p>
              </div>
            </div>

            {isCafeOrderScenario ? (
              <figure className="call-panel-menu-card" aria-label="Coffee shop menu reference">
                <img
                  className="call-panel-menu-image"
                  src={CafeMenuScene}
                  alt="Coffee shop chalkboard menu with drinks, churros, sandwiches, tapas, and an espresso bar."
                />
                <figcaption className="call-panel-menu-caption">
                  <span className="call-panel-menu-label">Cafe menu</span>
                  <span className="call-panel-menu-note">Use it as visual context while ordering.</span>
                </figcaption>
              </figure>
            ) : null}
          </aside>

          <section className="chat-pane" aria-label="Chat panel">
            <div className="chat-pane-card">
              <section
                className={`transcript${shouldShowStarters ? ' transcript--starter-state' : ''}`}
                ref={transcriptRef}
                aria-label="Transcript"
              >
                {shouldShowStarters ? (
                  <section className="starter-panel" aria-label="Conversation starters">
                    <p className="starter-panel-title">Quick start</p>
                    <p className="starter-panel-text">Pick a scenario or just start chatting</p>
                    <div className="starter-chip-row">
                      {scenarioStarters.map((starter) => (
                        <button
                          key={starter.label}
                          className="starter-chip"
                          type="button"
                          onClick={() => handleStarterClick(starter)}
                        >
                          {starter.label}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {visibleMessages.map((message) => {
                  if (message.speaker === 'User') {
                    return (
                      <article key={message.id} className="message-row message-row--user">
                        <div className="message-bubble message-bubble--user">
                          <p>{renderBubbleText(message)}</p>
                        </div>
                      </article>
                    )
                  }

                  const vocabularyEntries =
                    message.speaker === 'Cookie' && message.id === latestAssistantMessage?.id ? message.vocabulary ?? [] : []
                  const supportsTranslation = message.speaker === 'Cream'
                  const translationState = messageTranslations[message.id]
                  const isTranslationVisible = supportsTranslation && Boolean(translationState?.isVisible)

                  return (
                    <article key={message.id} className="message-row message-row--partner">
                      <div className="message-avatar" aria-hidden="true">
                        <img src={avatarBySpeaker[message.speaker]} alt="" />
                      </div>
                      <div className="message-partner-stack">
                        <div className="message-bubble-wrap">
                          <div className={`message-bubble message-bubble--${message.speaker.toLowerCase()}`}>
                            <p>{renderBubbleText(message)}</p>
                          </div>
                          <div className="message-actions" aria-label="Message actions">
                            <button
                              aria-label={`Speak ${message.speaker} message`}
                              className="message-action-button"
                              title="Speak"
                              type="button"
                              onPointerUp={handleMessageActionPointerUp}
                              onClick={() => handleMessageSpeak(message)}
                            >
                              <svg aria-hidden="true" className="message-action-icon" viewBox="0 0 16 16">
                                <path d="M3.25 9.75H1.75V6.25h1.5L6.5 3.5v9L3.25 9.75Z" />
                                <path d="M9.25 5.25a3.5 3.5 0 0 1 0 5.5" />
                                <path d="M10.75 3.75a5.5 5.5 0 0 1 0 8.5" />
                              </svg>
                            </button>
                            {supportsTranslation ? (
                              <button
                                aria-label={
                                  isTranslationVisible
                                    ? `Hide ${message.speaker} translation`
                                    : `Translate ${message.speaker} message`
                                }
                                className={`message-action-button${isTranslationVisible ? ' message-action-button--active' : ''}`}
                                title={isTranslationVisible ? 'Hide translation' : 'Translate'}
                                type="button"
                                onPointerUp={handleMessageActionPointerUp}
                                onClick={() => void handleMessageTranslate(message)}
                              >
                                <svg aria-hidden="true" className="message-action-icon" viewBox="0 0 16 16">
                                  <circle cx="8" cy="8" r="5.75" />
                                  <path d="M2.25 8h11.5" />
                                  <path d="M8 2.25c1.7 1.55 2.75 3.62 2.75 5.75S9.7 12.2 8 13.75C6.3 12.2 5.25 10.13 5.25 8S6.3 3.8 8 2.25Z" />
                                </svg>
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {supportsTranslation && isTranslationVisible ? (
                          <div
                            aria-live={translationState?.isLoading ? 'polite' : undefined}
                            className={`message-translation-bubble message-translation-bubble--${message.speaker.toLowerCase()}${
                              translationState?.isLoading ? ' message-translation-bubble--loading' : ''
                            }`}
                          >
                            <p>{translationState?.isLoading ? 'Translating...' : translationState?.text}</p>
                          </div>
                        ) : null}

                        {vocabularyEntries.length > 0 ? (
                          <div className="slip-helper" aria-label="New vocabulary">
                            <p className="slip-helper-eyebrow">New vocabulary</p>
                            <ul className="slip-helper-list">
                              {vocabularyEntries.map((entry) => (
                                <li className="slip-helper-item" key={entry.term}>
                                  <span className="slip-helper-term">"{entry.term}"</span>: {entry.translation}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  )
                })}

              </section>

              <div className="input-dock">
                <form
                  className={`action-composer${isListening ? ' action-composer--listening' : ''}`}
                  onSubmit={handleSubmit}
                >
                  <button
                    aria-label={isListening ? 'Stop speech input' : 'Start speech input'}
                    className="action-composer-mic"
                    disabled={isSubmitting}
                    type="button"
                    onClick={handleSpeechStart}
                  >
                    {isListening ? (
                      <span aria-hidden="true" className="action-button-stop-mark" />
                    ) : (
                      <svg
                        aria-hidden="true"
                        className="action-button-icon action-button-icon--mic"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 15.75a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6.75a3 3 0 0 0 3 3Z" />
                        <path d="M18 11.25v1.5a6 6 0 0 1-12 0v-1.5" />
                        <path d="M12 18.75v3.75" />
                        <path d="M8.25 22.5h7.5" />
                      </svg>
                    )}
                  </button>

                  <input
                    ref={draftInputRef}
                    aria-label="Transcript input"
                    className="action-composer-input"
                    placeholder={isSubmitting ? 'Sending...' : inputPlaceholder}
                    readOnly={isListening || isSubmitting}
                    type="text"
                    value={draft}
                    onChange={handleDraftChange}
                  />

                  <button
                    aria-label="Send transcript"
                    className="action-composer-send"
                    disabled={!hasDraft || isListening || isSubmitting}
                    type="submit"
                  >
                    <svg
                      aria-hidden="true"
                      className="action-button-icon action-button-icon--send"
                      viewBox="0 0 16 16"
                    >
                      <path d="M3.5 8h8" />
                      <path d="M8.5 3.5 13 8l-4.5 4.5" />
                    </svg>
                  </button>
                </form>

                <p
                  aria-live={speechStatusMessage ? 'polite' : undefined}
                  className="action-meta"
                  role="status"
                >
                  {speechStatusMessage
                    ? renderActionMetaText(speechStatusMessage)
                    : renderModelAttribution(modelAttributionModelId)}
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>

      {isRecapModalOpen ? (
        <div className="recap-modal-backdrop" aria-label="Session recap dialog" onClick={handleRecapModalClose}>
          <div
            className="recap-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-recap-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="recap-modal-header">
              <p className="recap-card-eyebrow" id="session-recap-title">
                Session recap
              </p>
              <button
                aria-label="Close session recap"
                className="recap-modal-close"
                type="button"
                onClick={handleRecapModalClose}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            {sessionRecap && recapPresentation ? (
              <article className="recap-card recap-card--modal">
                <div className="recap-card-section">
                  <p className="recap-card-label">📝 Session summary</p>
                  <p className="recap-card-summary-text">{recapPresentation.summary}</p>
                </div>
                <div className="recap-card-section">
                  <p className="recap-card-label">👍 What went well</p>
                  <ul className="recap-card-list">
                    {sessionRecap.didWell.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="recap-card-section">
                  <p className="recap-card-label">📚 New vocabularies</p>
                  {recapPresentation.vocabulary.length > 0 ? (
                    <ul className="recap-vocabulary-list">
                      {recapPresentation.vocabulary.map((entry) => (
                        <li className="recap-vocabulary-item" key={entry.term}>
                          <span className="recap-vocabulary-term">"{entry.term}"</span>: {entry.translation}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="recap-card-text">No new vocabulary from this session yet.</p>
                  )}
                </div>
                <div className="recap-card-section">
                  <p className="recap-card-label">🎯 Try this next</p>
                  {recapPresentation.nextStep.note ? (
                    <p className="recap-card-text">
                      {formatRecapPromptLead(recapPresentation.nextStep.note)} {recapPresentation.nextStep.prompt}
                    </p>
                  ) : (
                    <p className="recap-card-phrase recap-card-phrase--practice">{recapPresentation.nextStep.prompt}</p>
                  )}
                </div>
                <div className="recap-cta-row">
                  <button
                    className="recap-cta-button recap-cta-button--secondary"
                    type="button"
                    onClick={handlePracticeFromScratch}
                  >
                    Start from scratch
                  </button>
                  <button className="recap-cta-button recap-cta-button--primary" type="button" onClick={handleRecapModalClose}>
                    Continue practice
                  </button>
                </div>
              </article>
            ) : (
              <div className="recap-modal-loading">
                <p className="recap-card-text">Preparing recap...</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  )
}

function mergeDraftWithSpeech(baseText: string, spokenText: string): string {
  return [baseText.trim(), spokenText.trim()].filter(Boolean).join(' ').trim()
}

function formatRecapPromptLead(note: string): string {
  return note.replace(/\s*[.:!?]\s*$/, ':')
}

function getFirstEnabledOptionIndex(options: DropdownOption[]): number {
  return options.findIndex((option) => !option.disabled)
}

function getLastEnabledOptionIndex(options: DropdownOption[]): number {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index].disabled) {
      return index
    }
  }

  return 0
}

function getSelectedEnabledOptionIndex(options: DropdownOption[], value: string): number {
  const selectedIndex = options.findIndex((option) => option.value === value && !option.disabled)

  if (selectedIndex >= 0) {
    return selectedIndex
  }

  const firstEnabledIndex = getFirstEnabledOptionIndex(options)

  return firstEnabledIndex >= 0 ? firstEnabledIndex : 0
}

function getNextEnabledOptionIndex(options: DropdownOption[], currentIndex: number, direction: 1 | -1): number {
  const hasEnabledOptions = options.some((option) => !option.disabled)

  if (!hasEnabledOptions) {
    return currentIndex
  }

  let nextIndex = currentIndex

  for (let step = 0; step < options.length; step += 1) {
    nextIndex = (nextIndex + direction + options.length) % options.length

    if (!options[nextIndex].disabled) {
      return nextIndex
    }
  }

  return currentIndex
}

function renderBubbleText(message: Pick<Message, 'speaker' | 'text'>): ReactNode[] {
  return getBubbleTextSegments(message).map((part, index) => {
    if (!part.isEnglish) {
      return part.text
    }

    return (
      <span className="message-text-english" key={`${part.text}-${index}`}>
        {part.text}
      </span>
    )
  })
}

function renderInlineQuoteText(text: string): ReactNode[] {
  return getInlineQuoteTextSegments(text).map((part, index) => {
    if (!part.isEnglish) {
      return part.text
    }

    return (
      <span className="home-inline-quote-english" key={`${part.text}-${index}`}>
        {part.text}
      </span>
    )
  })
}

function findLatestAssistantMessage(messages: ConversationState['messages']) {
  return [...messages].reverse().find((message) => message.speaker !== 'User')
}

function renderActionMetaText(text: string): ReactNode[] {
  return text.split(/(\bunavailable\b)/i).map((part, index) => {
    if (!/^unavailable$/i.test(part)) {
      return part
    }

    return <strong key={`${part}-${index}`}>{part}</strong>
  })
}

function renderModelAttribution(modelId?: string): ReactNode {
  return (
    <>
      Cookie &amp; Cream uses{' '}
      <a href={amazonNovaUrl} rel="noreferrer" target="_blank">
        Amazon Nova
      </a>{' '}
      on{' '}
      <a href={amazonBedrockUrl} rel="noreferrer" target="_blank">
        Amazon Bedrock
      </a>
      {modelId ? ` · ${modelId}` : ''}
    </>
  )
}

export default App
