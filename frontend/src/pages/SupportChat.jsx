import { Button, Card, CardBody, Chip, Input, Textarea } from '@heroui/react'
import { Mic, MessageCircle, Paperclip, Pause, Play, Search, Smile, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import Loading from '../components/Loading'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import ProfileAvatar from '../components/ProfileAvatar'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'
import { formatDate, formatTime } from '../utils/format'

function isSameCalendarDay(first, second) {
  if (!first || !second) return false

  return localDateKey(first) === localDateKey(second)
}

function localDateKey(value) {
  return formatDate(value, 'en-CA')
}

function getMessageDateLabel(value) {
  const now = new Date()
  const messageDay = localDateKey(value)

  if (messageDay === localDateKey(now)) return 'Today'
  if (messageDay === localDateKey(now.getTime() - 86400000)) return 'Yesterday'

  return formatDate(value, 'en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatMessageTime(value) {
  return formatTime(value, 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).toLowerCase()
}

function Avatar({ user, isAdmin = false }) {
  return (
    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 font-bold text-primary">
      {isAdmin ? (
        <img
          src="/profile.png"
          alt="Revnivo Support"
          className="h-full w-full bg-white object-cover p-1.5"
        />
      ) : (
        <ProfileAvatar user={user} className="h-full w-full" alt="Profile" />
      )}
    </div>
  )
}


function formatVoiceDuration(value) {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

function VoiceMessage({ src, own }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0
  const bars = [6, 10, 15, 8, 18, 12, 21, 9, 16, 23, 12, 19, 14, 24, 9, 17, 21, 12, 19, 8, 15, 23, 12, 18, 10, 20, 13, 18]

  const togglePlayback = async () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      await audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }

  const seek = (event) => {
    const audio = audioRef.current
    if (!audio || !duration) return

    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1)
    audio.currentTime = ratio * duration
    setCurrentTime(audio.currentTime)
  }

  return (
    <div
      className={`
        mt-1 flex min-w-[250px] max-w-[320px] items-center gap-3 rounded-2xl px-2.5 py-2
        ${own ? 'bg-black/10 text-white' : 'bg-black/[0.045] text-foreground dark:bg-white/[0.06]'}
      `}
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setCurrentTime(0)
        }}
      />

      <button
        type="button"
        onClick={togglePlayback}
        className={`
          grid h-10 w-10 shrink-0 place-items-center rounded-full transition
          ${own ? 'bg-white/18 text-white hover:bg-white/25' : 'bg-primary/12 text-primary hover:bg-primary/18'}
        `}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {playing ? (
          <Pause size={18} fill="currentColor" />
        ) : (
          <Play size={18} fill="currentColor" className="translate-x-px" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={seek}
          className="flex h-8 w-full items-center gap-[2px]"
          aria-label="Seek voice message"
        >
          {bars.map((height, index) => {
            const filled = (index + 1) / bars.length <= progress

            return (
              <span
                key={`${height}-${index}`}
                className={`w-[3px] shrink-0 rounded-full transition-colors ${
                  own
                    ? filled
                      ? 'bg-white'
                      : 'bg-white/40'
                    : filled
                      ? 'bg-primary'
                      : 'bg-default-400/65'
                }`}
                style={{ height: `${height}px` }}
              />
            )
          })}
        </button>

        <div className={`mt-0.5 flex items-center justify-between text-[10px] ${own ? 'text-white/75' : 'text-default-500'}`}>
          <span>{formatVoiceDuration(currentTime > 0 ? currentTime : duration)}</span>
          <Volume2 size={13} />
        </div>
      </div>
    </div>
  )
}

function AttachmentPreview({ url, file, own }) {
  const imageUrl = file ? URL.createObjectURL(file) : url

  if (!imageUrl) return null

  const isImage =
    file?.type?.startsWith('image/') ||
    Boolean(url?.match(/\.(jpe?g|png|gif|webp)(\?|$)/i))

  const isAudio =
    file?.type?.startsWith('audio/') ||
    Boolean(url?.match(/\.(webm|mp3|ogg|wav|m4a)(\?|$)/i))

  if (isAudio) {
    return <VoiceMessage src={imageUrl} own={own} />
  }

  if (isImage) {
    return (
      <img
        src={imageUrl}
        alt="Attachment"
        className="mt-2 max-h-64 max-w-full rounded-xl object-contain"
      />
    )
  }

  return (
    <a
      className={`
        mt-2
        block
        rounded-xl
        px-3
        py-2
        text-xs
        underline
        ${
          own
            ? 'bg-black/10 text-white'
            : 'bg-black/5 text-black dark:bg-white/5 dark:text-white'
        }
      `}
      href={imageUrl}
      target="_blank"
      rel="noreferrer"
    >
      Open attachment
    </a>
  )
}

export default function SupportChat() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const notifiedUserId = searchParams.get('user') || ''

  const [contacts, setContacts] = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [messages, setMessages] = useState([])
  const [content, setContent] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [recording, setRecording] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const typingTimer = useRef(null)
  const recordingPresenceTimer = useRef(null)
  const recorderRef = useRef(null)
  const audioChunksRef = useRef([])

  /*
   * Chat scrolling refs.
   *
   * scrollToLatestRef:
   *   Forces the next rendered message list to jump to the latest message.
   *
   * lastMessageIdRef:
   *   Lets polling detect whether a new message arrived without forcing the
   *   user back to the bottom while they are reading older messages.
   */
  const messageListRef = useRef(null)
  const messagesEndRef = useRef(null)
  const scrollToLatestRef = useRef(false)
  const lastMessageIdRef = useRef(null)

  const isNearBottom = () => {
    const element = messageListRef.current

    if (!element) return true

    const remaining =
      element.scrollHeight -
      element.scrollTop -
      element.clientHeight

    return remaining < 180
  }

  const scrollToBottom = (behavior = 'auto') => {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior,
        block: 'end',
      })
    })
  }

  const loadContacts = async () => {
    if (user?.role !== 'admin') return

    const { data } = await api.get('/support-chat/', {
      params: { summary: 1 },
    })

    setContacts(
      [...data].sort(
        (a, b) =>
          new Date(b.last_message_at || 0) -
          new Date(a.last_message_at || 0)
      )
    )
  }

  const loadPresence = async () => {
    const { data } = await api.get('/chat-presence/')

    if (user?.role !== 'admin') {
      const admin = data.find(
        (person) => person.id !== user?.id
      )

      setContacts((items) => [
        {
          ...(items[0] || {
            id: 'support',
            name: 'Revnivo Support',
            email: 'Technical support',
          }),
          online: admin?.online,
          typing: admin?.typing,
          recording: admin?.recording,
        },
      ])
    }
  }

  const loadMessages = async (
    userId = selectedUser
  ) => {
    /*
     * Check the scroll position before replacing the messages.
     * If the user is already near the bottom, incoming messages can keep
     * following the conversation. If they scrolled up, polling will not
     * keep pulling them back down.
     */
    const wasNearBottom = isNearBottom()

    try {
      const { data } = await api.get(
        '/support-chat/',
        {
          params:
            user?.role === 'admin' && userId
              ? { user_id: userId }
              : {},
        }
      )

      const incomingLastMessageId =
        data.at(-1)?.id ?? null

      const hasNewLastMessage =
        incomingLastMessageId !==
        lastMessageIdRef.current

      if (
        hasNewLastMessage &&
        wasNearBottom
      ) {
        scrollToLatestRef.current = true
      }

      setMessages(data)

      if (user?.role !== 'admin') {
        setContacts((items) =>
          items.map((item) => ({
            ...item,
            last_message:
              data.at(-1)?.content || '',
          }))
        )
      }

      if (
        user?.role === 'admin'
          ? userId
          : user
      ) {
        api
          .patch('/support-chat/', {
            user_id:
              user?.role === 'admin'
                ? userId
                : 'support',
          })
          .catch(() => {})

        if (
          user?.role === 'admin' &&
          userId
        ) {
          setContacts((items) =>
            items.map((item) =>
              item.id === userId
                ? {
                    ...item,
                    unread_count: 0,
                  }
                : item
            )
          )
        }
      }
    } finally {
      setLoading(false)
    }
  }

  /*
   * Scroll only after the messages have actually rendered.
   *
   * This is what makes a newly opened conversation start at the latest
   * messages instead of showing the beginning of the history.
   */
  useEffect(() => {
    const currentLastMessageId =
      messages.at(-1)?.id ?? null

    if (
      scrollToLatestRef.current &&
      messagesEndRef.current
    ) {
      scrollToBottom('auto')
      scrollToLatestRef.current = false
    }

    lastMessageIdRef.current =
      currentLastMessageId
  }, [messages, contacts, selectedUser])

  useEffect(() => {
    if (user?.role === 'admin' && notifiedUserId) {
      scrollToLatestRef.current = true
      lastMessageIdRef.current = null
      setSelectedUser(notifiedUserId)
    }
  }, [notifiedUserId, user?.role])

  useEffect(() => {
    if (user?.role === 'admin') {
      loadContacts().catch(() =>
        setLoading(false)
      )
    } else {
      scrollToLatestRef.current = true

      window.dispatchEvent(
        new CustomEvent('chat-read', {
          detail: {
            chatUserId: String(user?.id),
          },
        })
      )

      api
        .patch('/support-chat/', {
          user_id: 'support',
        })
        .catch(() => {})
        .finally(() => loadMessages())
    }

    loadPresence().catch(() => {})
  }, [user?.role])

  useEffect(() => {
    if (
      selectedUser &&
      user?.role === 'admin'
    ) {
      /*
       * Every newly selected conversation opens at its latest message.
       */
      scrollToLatestRef.current = true
      lastMessageIdRef.current = null
      loadMessages(selectedUser)
    }
  }, [selectedUser])

  useEffect(() => {
    return () => {
      if (typingTimer.current) {
        window.clearTimeout(typingTimer.current)
      }

      if (recordingPresenceTimer.current) {
        window.clearInterval(recordingPresenceTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (
        user?.role !== 'admin' ||
        selectedUser
      ) {
        loadMessages()
      }

      loadContacts().catch(() => {})
      loadPresence().catch(() => {})
    }, 3000)

    return () =>
      window.clearInterval(timer)
  }, [selectedUser, user?.role])

  const clearTyping = () => {
    if (typingTimer.current) {
      window.clearTimeout(
        typingTimer.current
      )
    }

    api
      .post('/chat-presence/', {
        typing: false,
      })
      .catch(() => {})
  }

  const updateTyping = (value) => {
    setContent(value)

    if (typingTimer.current) {
      window.clearTimeout(
        typingTimer.current
      )
    }

    if (
      !value.trim() ||
      (user?.role === 'admin' &&
        !selectedUser)
    ) {
      return clearTyping()
    }

    api
      .post('/chat-presence/', {
        typing: true,
        user_id:
          user?.role === 'admin'
            ? selectedUser
            : undefined,
      })
      .catch(() => {})

    typingTimer.current =
      window.setTimeout(
        clearTyping,
        3500
      )
  }

  const send = async (
    event,
    overrideContent = content,
    messageType = 'text',
    overrideAttachment = attachment
  ) => {
    event?.preventDefault()

    if (
      !overrideContent.trim() &&
      !overrideAttachment
    ) {
      return
    }

    const form = new FormData()

    form.append(
      'content',
      overrideContent
    )

    form.append(
      'message_type',
      messageType
    )

    if (user?.role === 'admin') {
      form.append(
        'user_id',
        selectedUser
      )
    }

    if (overrideAttachment) {
      form.append(
        'attachment',
        overrideAttachment
      )
    }

    /*
     * Messages sent by the current user should always leave the viewport
     * at the new message.
     */
    scrollToLatestRef.current = true

    await api.post(
      '/support-chat/',
      form,
      {
        headers: {
          'Content-Type':
            'multipart/form-data',
        },
      }
    )

    clearTyping()
    setContent('')
    setAttachment(null)

    await loadMessages()
    await loadContacts().catch(() => {})
  }

  const clearRecordingPresence = () => {
    if (recordingPresenceTimer.current) {
      window.clearInterval(recordingPresenceTimer.current)
      recordingPresenceTimer.current = null
    }

    api
      .post('/chat-presence/', {
        recording: false,
        user_id:
          user?.role === 'admin'
            ? selectedUser
            : undefined,
      })
      .catch(() => {})
  }

  const startRecording = async () => {
    if (recording) {
      recorderRef.current?.stop()
      return
    }

    if (user?.role === 'admin' && !selectedUser) {
      return
    }

    clearTyping()

    const stream =
      await navigator.mediaDevices.getUserMedia(
        { audio: true }
      )

    const recorder =
      new MediaRecorder(stream)

    audioChunksRef.current = []

    recorder.ondataavailable = (
      event
    ) => {
      if (event.data?.size) {
        audioChunksRef.current.push(
          event.data
        )
      }
    }

    recorder.onstop = async () => {
      stream
        .getTracks()
        .forEach((track) =>
          track.stop()
        )

      clearRecordingPresence()
      setRecording(false)

      if (!audioChunksRef.current.length) {
        return
      }

      const audio = new File(
        [
          new Blob(
            audioChunksRef.current,
            {
              type:
                recorder.mimeType ||
                'audio/webm',
            }
          ),
        ],
        `voice-${Date.now()}.webm`,
        {
          type:
            recorder.mimeType ||
            'audio/webm',
        }
      )

      await send(
        null,
        '',
        'audio',
        audio
      )
    }

    recorderRef.current = recorder
    recorder.start()
    setRecording(true)

    const sendRecordingPresence = () =>
      api
        .post('/chat-presence/', {
          recording: true,
          user_id:
            user?.role === 'admin'
              ? selectedUser
              : undefined,
        })
        .catch(() => {})

    sendRecordingPresence()
    recordingPresenceTimer.current =
      window.setInterval(
        sendRecordingPresence,
        3000
      )
  }

  const selectContact = async (
    contact
  ) => {
    /*
     * Set this before changing selectedUser so the first render for the
     * new conversation is anchored at the bottom.
     */
    scrollToLatestRef.current = true
    lastMessageIdRef.current = null

    setSelectedUser(contact.id)
    setMessages([])

    setContacts((items) =>
      items.map((item) =>
        item.id === contact.id
          ? {
              ...item,
              unread_count: 0,
            }
          : item
      )
    )

    try {
      await api.patch(
        '/support-chat/',
        {
          user_id: contact.id,
        }
      )
    } finally {
      window.dispatchEvent(
        new CustomEvent('chat-read', {
          detail: {
            chatUserId:
              user?.role === 'admin'
                ? String(contact.id)
                : String(user?.id),
          },
        })
      )
    }
  }

  const deleteMessage = async (
    messageId,
    mode
  ) => {
    setDeleting(true)
    try {
      await api.delete(
        '/support-chat/',
        {
          data: {
            id: messageId,
            mode,
          },
        }
      )
      setDeleteTarget(null)
      await loadMessages()
    } finally {
      setDeleting(false)
    }
  }

  const active = selectedUser
    ? contacts.find(
        (contact) =>
          contact.id === selectedUser
      )
    : null

  const visibleContacts =
    contacts.filter((contact) =>
      `${contact.name} ${contact.email} ${
        contact.last_message || ''
      }`
        .toLowerCase()
        .includes(search.toLowerCase())
    )

  const ownSender =
    user?.role === 'admin'
      ? 'admin'
      : 'user'

  if (
    loading &&
    !contacts.length
  ) {
    return (
      <Loading label="Loading support chat..." />
    )
  }

  return (
    <div
      className="-mx-4 -my-4 flex h-[calc(100vh-4rem)] min-h-0 w-[calc(100%+2rem)] flex-col md:-mx-6 md:-my-6 md:w-[calc(100%+3rem)] lg:-mx-8 lg:-my-8 lg:w-[calc(100%+4rem)]"
      onClick={() =>
        contextMenu &&
        setContextMenu(null)
      }
    >
      {/* Message context menu */}
      {contextMenu && (
        <div
          className="fixed z-70 w-44 rounded-xl border border-divider bg-content1 p-1 text-foreground shadow-2xl"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(event) =>
            event.stopPropagation()
          }
        >
          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-default-100"
            onClick={() => {
              setDeleteTarget({ id: contextMenu.id, mode: 'me' })
              setContextMenu(null)
            }}
          >
            Delete for me
          </button>

          <button
            className="block w-full rounded-lg px-3 py-2 text-left text-xs text-danger transition-colors hover:bg-danger/10"
            onClick={() => {
              setDeleteTarget({ id: contextMenu.id, mode: 'everyone' })
              setContextMenu(null)
            }}
          >
            Delete for everyone
          </button>
        </div>
      )}

      <Card
        radius="none"
        className="grid h-full min-h-0 w-full flex-1 overflow-hidden rounded-none border-divider bg-content1 text-foreground shadow-none md:grid-cols-[280px_1fr]"
      >
        {/* Contacts sidebar */}
        <aside className="min-h-0 overflow-y-auto border-b border-divider bg-content1 md:border-b-0 md:border-r">
          <div className="border-b border-divider p-4">
            <Input
              aria-label="Search people"
              placeholder="Search people..."
              value={search}
              onValueChange={setSearch}
              startContent={
                <Search
                  size={16}
                  className="text-default-400"
                />
              }
              classNames={{
                inputWrapper:
                  'bg-default-100/70 border border-divider',
                input:
                  'text-foreground placeholder:text-default-400',
              }}
            />
          </div>

          <div className="divide-y divide-divider">
            {visibleContacts.map(
              (contact) => (
                <button
                  key={contact.id}
                  onClick={() =>
                    selectContact(
                      contact
                    )
                  }
                  className={`
                    flex
                    w-full
                    items-center
                    gap-3
                    p-3
                    text-left
                    transition-colors
                    ${
                      contact.unread_count >
                      0
                        ? 'chat-contact-new'
                        : ''
                    }
                    ${
                      active?.id ===
                      contact.id
                        ? 'bg-primary/10'
                        : 'hover:bg-default-100/70'
                    }
                  `}
                >
                  <div className="relative">
                    <Avatar
                      user={contact}
                      isAdmin={
                        contact.id === 'support'
                      }
                    />

                    <span
                      className={`
                        absolute
                        bottom-0
                        right-0
                        h-3
                        w-3
                        rounded-full
                        border-2
                        border-content1
                        ${
                          contact.online
                            ? 'bg-success'
                            : 'bg-default-400'
                        }
                      `}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {contact.name}
                      </div>

                      {contact.last_message_at && (
                        <time className="shrink-0 text-[10px] text-default-400">
                          {formatTime(contact.last_message_at, 'en-EG', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </time>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`
                          flex
                          items-center
                          gap-1
                          truncate
                          text-xs
                          ${
                            contact.recording || contact.typing
                              ? 'text-primary'
                              : 'text-default-500'
                          }
                        `}
                      >
                        {contact.recording ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Mic size={13} />
                            Recording voice...
                          </span>
                        ) : contact.typing ? (
                          <>
                            <span>
                              typing
                            </span>

                            <span className="typing-dots">
                              <i />
                              <i />
                              <i />
                            </span>
                          </>
                        ) : (
                          contact.last_message ||
                          'No messages yet'
                        )}
                      </div>                      </div>

                      {contact.unread_count >
                        0 && (
                        <Chip
                          size="sm"
                          color="primary"
                          variant="solid"
                          className="h-5 min-w-5 px-1 text-[10px]"
                        >
                          {
                            contact.unread_count
                          }
                        </Chip>
                      )}
                    </div>
                  </div>
                </button>
              )
            )}
          </div>
        </aside>

        {/* Active chat */}
        <section className="flex min-h-0 flex-col bg-background">
          {active ? (
            <>
              {/* Chat header */}
              <div className="flex shrink-0 items-center gap-3 border-b border-divider bg-content1 p-4">
                <div className="relative">
                  <Avatar
                    user={active}
                    isAdmin={
                      active.id === 'support'
                    }
                  />

                  <span
                    className={`
                      absolute
                      bottom-0
                      right-0
                      h-3
                      w-3
                      rounded-full
                      border-2
                      border-content1
                      ${
                        active.online
                          ? 'bg-success'
                          : 'bg-default-400'
                      }
                    `}
                  />
                </div>

                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {active.name}
                  </div>

                  <div className={`text-xs ${active.recording || active.typing ? 'text-primary' : 'text-default-500'}`}>
                    {active.recording
                      ? 'Recording voice...'
                      : active.typing
                        ? 'Typing...'
                        : active.online
                          ? 'Online now'
                          : 'Offline'}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div
                ref={messageListRef}
                className="min-h-0 flex-1 overflow-y-auto p-5"
              >
                {messages.length ? (
                  <div className="flex min-h-full flex-col justify-end">
                    {messages.map(
                      (
                        message,
                        index
                      ) => {
                        const own =
                          message.sender ===
                          ownSender

                        const previous =
                          messages[
                            index - 1
                          ]

                        const next =
                          messages[
                            index + 1
                          ]

                        const sameDayAsPrevious =
                          previous &&
                          isSameCalendarDay(
                            previous.created_at,
                            message.created_at
                          )

                        const sameDayAsNext =
                          next &&
                          isSameCalendarDay(
                            next.created_at,
                            message.created_at
                          )

                        const previousSameSender =
                          previous?.sender ===
                            message.sender &&
                          sameDayAsPrevious

                        const nextSameSender =
                          next?.sender ===
                            message.sender &&
                          sameDayAsNext

                        const showDateLabel =
                          !sameDayAsPrevious

                        /*
                         * Only the last message in a consecutive sender group
                         * displays the avatar. A new date starts a new group.
                         */
                        const showAvatar =
                          !nextSameSender

                        return (
                          <div key={message.id}>
                            {showDateLabel && (
                              <div className="my-5 flex items-center justify-center">
                                <span className="rounded-full bg-default-100 px-3 py-1 text-[11px] font-medium text-default-500 ring-1 ring-inset ring-divider">
                                  {getMessageDateLabel(
                                    message.created_at
                                  )}
                                </span>
                              </div>
                            )}

                            <div
                              onContextMenu={(
                                event
                              ) => {
                                event.preventDefault()

                                setContextMenu(
                                  {
                                    id: message.id,
                                    x: event.clientX,
                                    y: event.clientY,
                                  }
                                )
                              }}
                              className={`
                                flex
                                items-end
                                gap-3
                                ${
                                  own
                                    ? 'flex-row-reverse'
                                    : ''
                                }
                                ${
                                  previousSameSender
                                    ? 'mt-1.5'
                                    : showDateLabel
                                      ? 'mt-0'
                                      : 'mt-4'
                                }
                              `}
                            >
                            {showAvatar ? (
                              <Avatar
                                user={
                                  own
                                    ? user
                                    : active
                                }
                                isAdmin={
                                  message.sender ===
                                  'admin'
                                }
                              />
                            ) : (
                              <div
                                aria-hidden="true"
                                className="h-10 w-10 shrink-0"
                              />
                            )}

                            <div
                              className={`
                                flex
                                max-w-[80%]
                                flex-col
                                ${
                                  own
                                    ? 'items-end'
                                    : 'items-start'
                                }
                              `}
                            >
                              <div
                                className={`
                                  rounded-2xl
                                  px-4
                                  py-3
                                  text-sm
                                  shadow-sm
                                  ${
                                    own
                                      ? `
                                        bg-[#60B8FF]
                                        text-white
                                        dark:bg-[#1688ff]
                                        dark:text-white
                                        ${
                                          showAvatar
                                            ? 'rounded-br-sm'
                                            : ''
                                        }
                                      `
                                      : `
                                        bg-[#E7E9ED]
                                        text-[#111318]
                                        dark:bg-[#1b1c21]
                                        dark:text-[#e1e2e5]
                                        ${
                                          showAvatar
                                            ? 'rounded-bl-sm'
                                            : ''
                                        }
                                      `
                                  }
                                `}
                              >
                                {message.deleted ? (
                                  <p className="italic opacity-60">
                                    This message was deleted
                                  </p>
                                ) : (
                                  <>
                                    {message.content && (
                                      <p
                                        className={`
                                          whitespace-pre-wrap
                                          wrap-break-word
                                          ${
                                            message.message_type ===
                                            'sticker'
                                              ? 'text-5xl'
                                              : ''
                                          }
                                        `}
                                      >
                                        {message.content}
                                      </p>
                                    )}

                                    <AttachmentPreview
                                      url={
                                        message.attachment_url
                                      }
                                      own={own}
                                    />
                                  </>
                                )}

                                <div
                                  className={`
                                    mt-1.5
                                    flex
                                    justify-end
                                    text-[10px]
                                    leading-none
                                    ${
                                      own
                                        ? 'text-white/75'
                                        : 'text-black/55 dark:text-white/55'
                                    }
                                  `}
                                >
                                  <time>
                                    {formatMessageTime(
                                      message.created_at
                                    )}
                                  </time>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        )
                      }
                    )}

                    {active.recording ? (
                      <div className="mt-3 flex items-center gap-2 text-xs font-medium text-primary">
                        <Mic size={14} />
                        Recording voice...
                      </div>
                    ) : active.typing ? (
                      <div className="mt-3 flex items-center gap-2 text-xs text-primary">
                        typing

                        <span className="typing-dots">
                          <i />
                          <i />
                          <i />
                        </span>
                      </div>
                    ) : null}

                    <div
                      ref={messagesEndRef}
                      className="h-px"
                    />
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-default-500">
                    No messages yet.
                  </div>
                )}
              </div>

              {/* Composer */}
              <form
                onSubmit={send}
                className="shrink-0 border-t border-divider bg-content1 p-3"
              >
                <div className="relative flex items-end">
                  <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1">
                    <label className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-default-500 transition-colors hover:bg-default-100 hover:text-foreground">
                      <Paperclip
                        size={18}
                      />

                      <input
                        type="file"
                        className="hidden"
                        onChange={(
                          event
                        ) =>
                          setAttachment(
                            event
                              .target
                              .files?.[0] ||
                              null
                          )
                        }
                      />
                    </label>

                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      className="h-8 w-8 min-w-8 text-default-500"
                      onPress={() =>
                        setEmojiOpen(
                          !emojiOpen
                        )
                      }
                      aria-label="Emoji"
                    >
                      <Smile
                        size={18}
                      />
                    </Button>
                  </div>

                  <Textarea
                    aria-label="Message"
                    value={content}
                    onValueChange={
                      updateTyping
                    }
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                          'Enter' &&
                        !event.shiftKey
                      ) {
                        event.preventDefault()
                        send(event)
                      }
                    }}
                    placeholder={
                      recording
                        ? 'Recording voice message...'
                        : 'Type a message'
                    }
                    minRows={1}
                    maxRows={4}
                    className="w-full"
                    classNames={{
                      inputWrapper:
                        'bg-default-100 border border-divider min-h-12',
                      input:
                        'text-foreground placeholder:text-default-400',
                    }}
                  />

                  <Button
                    isIconOnly
                    type="button"
                    onPress={
                      startRecording
                    }
                    color={
                      recording
                        ? 'danger'
                        : 'default'
                    }
                    variant="light"
                    className="absolute bottom-2 right-2 z-10 h-8 w-8 min-w-8 text-default-600"
                    aria-label="Record voice"
                  >
                    <Mic size={18} />
                  </Button>
                </div>

                {emojiOpen && (
                  <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-divider bg-default-100 p-2">
                    {[
                      '😀',
                      '😂',
                      '😍',
                      '👍',
                      '🙏',
                      '🔥',
                      '🎉',
                      '❤️',
                    ].map(
                      (item) => (
                        <button
                          type="button"
                          key={item}
                          className="text-2xl transition hover:scale-125"
                          onClick={() =>
                            updateTyping(
                              `${content}${item}`
                            )
                          }
                        >
                          {item}
                        </button>
                      )
                    )}
                  </div>
                )}

                {attachment && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-default-500">
                    <AttachmentPreview
                      file={
                        attachment
                      }
                      own
                    />

                    <button
                      type="button"
                      className="text-default-500 transition-colors hover:text-foreground"
                      onClick={() =>
                        setAttachment(
                          null
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                )}
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary/10 text-primary">
                <MessageCircle
                  size={30}
                />
              </div>

              <h2 className="mt-5 text-xl font-semibold text-foreground">
                Welcome to chat
              </h2>

              <p className="mt-2 max-w-sm text-default-500">
                Stay connected with
                your clients. Select a
                conversation from the
                list when you are
                ready.
              </p>
            </div>
          )}
        </section>
      </Card>
      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMessage(deleteTarget.id, deleteTarget.mode)}
        loading={deleting}
        title={deleteTarget?.mode === 'everyone' ? 'Delete for everyone?' : 'Delete message?'}
        message={deleteTarget?.mode === 'everyone' ? 'This message will be removed for everyone in the conversation.' : 'This message will be hidden from your view.'}
      />
    </div>
  )
}
