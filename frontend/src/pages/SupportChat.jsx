import { Button, Card, CardBody, Chip, Input, Textarea } from '@heroui/react'
import { Mic, MessageCircle, Paperclip, Search, Smile } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Loading from '../components/Loading'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

function Avatar({ user }) {
  return <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#1688ff]/15 font-bold text-[#4aa3ff]">{user?.profile_image_url ? <img src={user.profile_image_url} alt="" className="h-full w-full object-cover"/> : user?.name?.slice(0, 1).toUpperCase() || '?'}</div>
}

function AttachmentPreview({ url, file, own }) {
  const imageUrl = file ? URL.createObjectURL(file) : url
  if (!imageUrl) return null
  const isImage = file?.type?.startsWith('image/') || Boolean(url?.match(/\.(jpe?g|png|gif|webp)(\?|$)/i))
  const isAudio = file?.type?.startsWith('audio/') || Boolean(url?.match(/\.(webm|mp3|ogg|wav|m4a)(\?|$)/i))
  if (isAudio) return <audio className="mt-2 max-w-full" controls src={imageUrl}/>
  return isImage ? <img src={imageUrl} alt="Attachment" className="mt-2 max-h-64 max-w-full rounded-xl object-contain"/> : <a className={`mt-2 block rounded-xl px-3 py-2 text-xs underline ${own ? 'bg-black/10' : 'bg-default-100'}`} href={imageUrl} target="_blank" rel="noreferrer">Open attachment</a>
}

export default function SupportChat() {
  const { user } = useAuth()
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
  const typingTimer = useRef(null)
  const recorderRef = useRef(null)
  const audioChunksRef = useRef([])

  const loadContacts = async () => {
    if (user?.role !== 'admin') return
    const { data } = await api.get('/support-chat/', { params: { summary: 1 } })
    setContacts([...data].sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)))
  }

  const loadPresence = async () => {
    const { data } = await api.get('/chat-presence/')
    if (user?.role !== 'admin') {
      const admin = data.find((person) => person.id !== user?.id)
      setContacts((items) => [{ ...(items[0] || { id: 'support', name: 'Revnivo Support', email: 'Technical support' }), online: admin?.online, typing: admin?.typing }])
    }
  }

  const loadMessages = async (userId = selectedUser) => {
    try {
      const { data } = await api.get('/support-chat/', { params: user?.role === 'admin' && userId ? { user_id: userId } : {} })
      setMessages(data)
      if (user?.role !== 'admin') setContacts((items) => items.map((item) => ({ ...item, last_message: data.at(-1)?.content || '' })))
      if (user?.role === 'admin' ? userId : user) {
        api.patch('/support-chat/', { user_id: user?.role === 'admin' ? userId : 'support' }).catch(() => {})
        if (user?.role === 'admin' && userId) setContacts((items) => items.map((item) => item.id === userId ? { ...item, unread_count: 0 } : item))
      }
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (user?.role === 'admin') loadContacts().catch(() => setLoading(false))
    else {
      window.dispatchEvent(new CustomEvent('chat-read', { detail: { chatUserId: String(user?.id) } }))
      api.patch('/support-chat/', { user_id: 'support' }).catch(() => {}).finally(() => loadMessages())
    }
    loadPresence().catch(() => {})
  }, [user?.role])
  useEffect(() => { if (selectedUser && user?.role === 'admin') loadMessages(selectedUser) }, [selectedUser])
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (user?.role !== 'admin' || selectedUser) loadMessages()
      loadContacts().catch(() => {})
      loadPresence().catch(() => {})
    }, 3000)
    return () => window.clearInterval(timer)
  }, [selectedUser, user?.role])

  const clearTyping = () => {
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
    api.post('/chat-presence/', { typing: false }).catch(() => {})
  }

  const updateTyping = (value) => {
    setContent(value)
    if (typingTimer.current) window.clearTimeout(typingTimer.current)
    if (!value.trim() || (user?.role === 'admin' && !selectedUser)) return clearTyping()
    api.post('/chat-presence/', { typing: true, user_id: user?.role === 'admin' ? selectedUser : undefined }).catch(() => {})
    typingTimer.current = window.setTimeout(clearTyping, 3500)
  }

  const send = async (event, overrideContent = content, messageType = 'text', overrideAttachment = attachment) => {
    event?.preventDefault()
    if (!overrideContent.trim() && !overrideAttachment) return
    const form = new FormData()
    form.append('content', overrideContent)
    form.append('message_type', messageType)
    if (user?.role === 'admin') form.append('user_id', selectedUser)
    if (overrideAttachment) form.append('attachment', overrideAttachment)
    await api.post('/support-chat/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    clearTyping(); setContent(''); setAttachment(null); await loadMessages(); await loadContacts().catch(() => {})
  }

  const startRecording = async () => {
    if (recording) { recorderRef.current?.stop(); return }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream)
    audioChunksRef.current = []
    recorder.ondataavailable = (event) => audioChunksRef.current.push(event.data)
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop())
      const audio = new File([new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' })], `voice-${Date.now()}.webm`, { type: recorder.mimeType || 'audio/webm' })
      setRecording(false)
      await send(null, '', 'audio', audio)
    }
    recorderRef.current = recorder
    recorder.start()
    setRecording(true)
  }

  const selectContact = async (contact) => {
    setSelectedUser(contact.id)
    setMessages([])
    setContacts((items) => items.map((item) => item.id === contact.id ? { ...item, unread_count: 0 } : item))
    try {
      await api.patch('/support-chat/', { user_id: contact.id })
    } finally {
      window.dispatchEvent(new CustomEvent('chat-read', { detail: { chatUserId: user?.role === 'admin' ? String(contact.id) : String(user?.id) } }))
      await loadMessages(contact.id)
    }
  }

  const deleteMessage = async (messageId, mode) => {
    await api.delete('/support-chat/', { data: { id: messageId, mode } })
    setContextMenu(null)
    await loadMessages()
  }

  const active = selectedUser ? contacts.find((contact) => contact.id === selectedUser) : null
  const visibleContacts = contacts.filter((contact) => `${contact.name} ${contact.email} ${contact.last_message || ''}`.toLowerCase().includes(search.toLowerCase()))
  const ownSender = user?.role === 'admin' ? 'admin' : 'user'
  if (loading && !contacts.length) return <Loading label="Loading support chat..." />

  return <div className="-mx-4 -my-4 flex h-[calc(100vh-4rem)] min-h-0 w-[calc(100%+2rem)] flex-col md:-mx-6 md:-my-6 md:w-[calc(100%+3rem)] lg:-mx-8 lg:-my-8 lg:w-[calc(100%+4rem)]" onClick={() => contextMenu && setContextMenu(null)}>
    {contextMenu && <div className="fixed z-70 w-44 rounded-xl border border-white/10 bg-[#1b1c21] p-1 shadow-2xl" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}><button className="block w-full rounded-lg px-3 py-2 text-left text-xs text-[#d8d9dd] hover:bg-white/8" onClick={() => deleteMessage(contextMenu.id, 'me')}>Delete for me</button><button className="block w-full rounded-lg px-3 py-2 text-left text-xs text-danger-300 hover:bg-danger-500/10" onClick={() => deleteMessage(contextMenu.id, 'everyone')}>Delete for everyone</button></div>}
    <Card className="grid h-full min-h-0 w-full flex-1 overflow-hidden rounded-none border-white/8 bg-[#101114] text-white shadow-none md:grid-cols-[280px_1fr]" radius="none">
      <aside className="min-h-0 overflow-y-auto border-b border-white/8 md:border-b-0 md:border-r"><div className="border-b border-white/8 p-4"><Input aria-label="Search people" placeholder="Search people..." value={search} onValueChange={setSearch} startContent={<Search size={16}/>} classNames={{ inputWrapper: 'bg-[#0b0c0f] border-white/8', input: 'text-white placeholder:text-[#62656e]' }}/></div><div className="divide-y divide-white/6">{visibleContacts.map((contact) => <button key={contact.id} onClick={() => selectContact(contact)} className={`flex w-full items-center gap-3 p-3 text-left transition ${contact.unread_count > 0 ? 'chat-contact-new' : ''} ${active?.id === contact.id ? 'bg-[#1688ff]/12' : 'hover:bg-white/5'}`}><div className="relative"><Avatar user={contact}/><span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-1 border-[#101114] ${contact.online ? 'bg-[#25d17f]' : 'bg-[#62656e]'}`}/></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><div className="truncate text-sm font-semibold">{contact.name}</div>{contact.last_message_at && <time className="shrink-0 text-[10px] text-[#777a84]">{new Date(contact.last_message_at).toLocaleTimeString('en-EG', { hour: 'numeric', minute: '2-digit' })}</time>}</div><div className="flex items-center justify-between gap-2"><div className={`flex items-center gap-1 truncate text-xs ${contact.typing ? 'text-[#4aa3ff]' : 'text-[#858891]'}`}>{contact.typing ? <><span>typing</span><span className="typing-dots"><i/><i/><i/></span></> : contact.last_message || 'No messages yet'}</div>{contact.unread_count > 0 && <Chip size="sm" color="primary" variant="solid" className="h-5 min-w-5 px-1 text-[10px]">{contact.unread_count}</Chip>}</div></div></button>)}</div></aside>
      <section className="flex min-h-0 flex-col bg-[#0b0c0f]">{active ? <><div className="flex shrink-0 items-center gap-3 border-b border-white/8 p-4"><div className="relative"><Avatar user={active}/><span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#0b0c0f] ${active.online ? 'bg-[#25d17f]' : 'bg-[#62656e]'}`}/></div><div className="min-w-0"><div className="truncate text-sm font-semibold">{active.name}</div><div className="text-xs text-[#777a84]">{active.online ? 'Online now' : 'Offline'}</div></div></div><div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">{messages.length ? messages.map((message) => { const own = message.sender === ownSender; return <div key={message.id} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ id: message.id, x: event.clientX, y: event.clientY }) }} className={`flex gap-3 ${own ? 'flex-row-reverse' : ''}`}><Avatar user={own ? user : active}/><div className={`max-w-[80%] ${own ? 'items-end' : 'items-start'} flex flex-col`}><div className={`rounded-2xl px-4 py-3 text-sm ${own ? 'rounded-tr-sm bg-[#1688ff] text-white' : 'rounded-tl-sm bg-[#1b1c21] text-[#e1e2e5]'}`}>{message.deleted ? <p className="italic opacity-60">This message was deleted</p> : <>{message.content && <p className={`whitespace-pre-wrap wrap-break-word ${message.message_type === 'sticker' ? 'text-5xl' : ''}`}>{message.content}</p>}<AttachmentPreview url={message.attachment_url} own={own}/></>}</div><time className="mt-1 px-1 text-[10px] text-[#62656e]">{new Date(message.created_at).toLocaleString('en-EG')}</time></div></div>}) : <div className="m-auto text-sm text-[#777a84]">No messages yet.</div>}{active.typing && <div className="flex items-center gap-2 text-xs text-[#4aa3ff]">typing <span className="typing-dots"><i/><i/><i/></span></div>}</div><form onSubmit={send} className="shrink-0 border-t border-white/8 bg-[#15161a] p-3"><div className="relative flex items-end"><div className="absolute bottom-2 left-2 z-10 flex items-center gap-1"><label className="grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[#9da0a8] hover:bg-white/8 hover:text-white"><Paperclip size={18}/><input type="file" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] || null)}/></label><Button isIconOnly size="sm" variant="light" className="h-8 w-8 min-w-8 text-[#9da0a8]" onPress={() => setEmojiOpen(!emojiOpen)} aria-label="Emoji"><Smile size={18}/></Button></div><Textarea aria-label="Message" value={content} onValueChange={updateTyping} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event) } }} placeholder={recording ? 'Recording voice message...' : 'Type a message'} minRows={1} maxRows={4} className="w-full" classNames={{ inputWrapper: 'bg-[#242527] border-transparent min-h-12', input: 'text-white placeholder:text-[#858891]' }}/><Button isIconOnly type="button" onPress={startRecording} color={recording ? 'danger' : 'default'} variant="light" className="absolute bottom-2 right-2 z-10 h-8 w-8 min-w-8 text-[#d8d9dd]" aria-label="Record voice"><Mic size={18}/></Button></div>{emojiOpen && <div className="mt-2 flex flex-wrap gap-2 rounded-xl bg-[#0b0c0f] p-2">{['😀', '😂', '😍', '👍', '🙏', '🔥', '🎉', '❤️'].map((item) => <button type="button" key={item} className="text-2xl transition hover:scale-125" onClick={() => updateTyping(`${content}${item}`)}>{item}</button>)}</div>}{attachment && <div className="mt-2 flex items-center gap-2 text-xs text-[#858891]"><AttachmentPreview file={attachment} own/><button type="button" className="text-[#9da0a8] hover:text-white" onClick={() => setAttachment(null)}>Remove</button></div>}</form></> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center"><div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#1688ff]/12 text-[#4aa3ff]"><MessageCircle size={30}/></div><h2 className="mt-5 text-xl font-semibold">Welcome to chat</h2><p className="mt-2 max-w-sm text-[#777a84]">Stay connected with your clients. Select a conversation from the list when you are ready.</p></div>}</section>
    </Card>
  </div>
}
