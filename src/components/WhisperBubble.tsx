import type { WhisperHint } from '../live/liveTypes'
import { formatWhisperBubbleText } from '../live/liveHelpers'
import type { PointerEvent as ReactPointerEvent } from 'react'

type WhisperBubbleProps = {
  avatarSrc: string
  hint: WhisperHint
  isCollapsed?: boolean
  isRecoverable?: boolean
  isSpeaking?: boolean
  onActionPointerUp?: (event: ReactPointerEvent<HTMLButtonElement>) => void
  onSpeak: () => void
  onToggleVisibility?: () => void
}

type WhisperBubbleLoadingProps = {
  avatarSrc: string
}

export function WhisperBubbleLoading({ avatarSrc }: WhisperBubbleLoadingProps) {
  return (
    <article className="dock-whisper" aria-live="polite">
      <div className="dock-whisper-avatar" aria-hidden="true">
        <img src={avatarSrc} alt="" />
      </div>
      <div className="dock-whisper-bubble-wrap">
        <div className="dock-whisper-bubble dock-whisper-bubble--loading" role="status" aria-label="Cookie is typing">
          <div className="dock-whisper-loading">
            <span className="dock-whisper-loading-dot" />
            <span className="dock-whisper-loading-dot" />
            <span className="dock-whisper-loading-dot" />
          </div>
        </div>
      </div>
    </article>
  )
}

export function WhisperBubble({
  avatarSrc,
  hint,
  isCollapsed = false,
  isRecoverable = false,
  isSpeaking = false,
  onActionPointerUp,
  onSpeak,
  onToggleVisibility,
}: WhisperBubbleProps) {
  const visibilityLabel = isCollapsed ? 'Show Cookie hint' : 'Hide Cookie hint'
  const visibilityTitle = isCollapsed ? 'Show hint' : 'Hide hint'

  return (
    <article className="dock-whisper" aria-live="polite">
      <div className={`dock-whisper-avatar${isSpeaking ? ' dock-whisper-avatar--speaking' : ''}`} aria-hidden="true">
        <img src={avatarSrc} alt="" />
      </div>
      <div
        className={`dock-whisper-bubble-wrap${isSpeaking ? ' dock-whisper-bubble-wrap--speaking' : ''}${
          isCollapsed ? ' dock-whisper-bubble-wrap--collapsed' : ''
        }${isRecoverable ? ' dock-whisper-bubble-wrap--recoverable' : ''}`}
      >
        <div className={`dock-whisper-bubble${isCollapsed ? ' dock-whisper-bubble--hidden' : ''}`}>
          <p>{isCollapsed ? 'Cookie hint hidden' : formatWhisperBubbleText(hint)}</p>
        </div>
        {isRecoverable && onToggleVisibility ? (
          <button
            aria-label={visibilityLabel}
            className={`message-action-button dock-whisper-visibility-button${
              isCollapsed ? ' dock-whisper-visibility-button--collapsed' : ''
            }`}
            title={visibilityTitle}
            type="button"
            onPointerUp={onActionPointerUp}
            onClick={onToggleVisibility}
          >
            <svg aria-hidden="true" className="message-action-icon" viewBox="0 0 16 16">
              {isCollapsed ? (
                <>
                  <path d="M2 2l12 12" />
                  <path d="M6.2 6.2A2.5 2.5 0 0 0 9.8 9.8" />
                  <path d="M4.25 4.25C2.73 5.33 1.75 8 1.75 8S4 12.5 8 12.5c1.11 0 2.12-.25 3.01-.68" />
                  <path d="M11.55 11.55C13.19 10.49 14.25 8 14.25 8S12 3.5 8 3.5c-.61 0-1.19.1-1.73.27" />
                </>
              ) : (
                <>
                  <path d="M1.75 8S4 3.5 8 3.5 14.25 8 14.25 8 12 12.5 8 12.5 1.75 8 1.75 8Z" />
                  <circle cx="8" cy="8" r="1.75" />
                </>
              )}
            </svg>
          </button>
        ) : null}
        {!isCollapsed ? (
          <div className="dock-whisper-actions" aria-label="Cookie whisper actions">
            <button
              aria-label="Speak Cookie whisper"
              className={`message-action-button${isSpeaking ? ' message-action-button--active message-action-button--speaking' : ''}`}
              title="Speak"
              type="button"
              onPointerUp={onActionPointerUp}
              onClick={onSpeak}
            >
              <svg
                aria-hidden="true"
                className={`message-action-icon${isSpeaking ? ' message-action-icon--speaking' : ''}`}
                viewBox="0 0 16 16"
              >
                <path d="M3.25 9.75H1.75V6.25h1.5L6.5 3.5v9L3.25 9.75Z" />
                <path d="M9.25 5.25a3.5 3.5 0 0 1 0 5.5" />
                <path d="M10.75 3.75a5.5 5.5 0 0 1 0 8.5" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>
    </article>
  )
}
