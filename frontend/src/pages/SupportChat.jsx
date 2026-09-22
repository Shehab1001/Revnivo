import { MessageCircle, Paperclip, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import Loading from '../components/Loading'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

function Avatar({ user }) {
  return <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#23C55E] font-bold text-white">{user?.profile_image_url ? <img src={user.profile_image_url} alt="" className="h-full w-full object-cover"/> : user?.name?.slice(0, 1).toUpperCase() || '?'}</div>
}

function AttachmentPreview({ url, file, own }) {
  const imageUrl = file ? URL.createObjectURL(file) : url
  if (!imageUrl) return null
  const isImage = file?.type?.startsWith('image/') || Boolean(url?.match(/\.(jpe?g|png|gif|webp)(\?|$)/i))
  return isImage ? <img src={imageUrl} alt="Attachment" className="mt-2 max-h-64 max-w-full rounded-lg object-contain"/> : <a className={`mt-2 block rounded-lg px-3 py-2 underline ${own ? 'bg-black/10' : 'bg-white/10'}`} href={imageUrl} target="_blank" rel="noreferrer">Open attachment</a>
}

export default function SupportChat() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [messages, setMessages] = useState([])
  const [content, setContent] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadContacts = async () => {
    if (user?.role !== 'admin') return
    const { data } = await api.get('/support-chat/', { params: { summary: 1 } })
    setContacts(data)
    if (!selectedUser && data[0]) setSelectedUser(data[0].id)
  }

  const loadMessages = async (userId = selectedUser) => {
    try {
      const { data } = await api.get('/support-chat/', { params: user?.role === 'admin' && userId ? { user_id: userId } : {} })
      setMessages(data)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (user?.role === 'admin') loadContacts().catch(() => setLoading(false))
    else {
      setContacts([{ id: 'support', name: 'Revnivo Support', email: 'Technical support' }])
      loadMessages()
    }
  }, [user?.role])

  useEffect(() => { if (selectedUser && user?.role === 'admin') loadMessages(selectedUser) }, [selectedUser])
  useEffect(() => {
    if (user?.role === 'admin' && !selectedUser) return undefined
    const timer = window.setInterval(() => { loadMessages(); loadContacts().catch(() => {}) }, 3000)
    return () => window.clearInterval(timer)
  }, [selectedUser, user?.role])

  const send = async (event) => {
    event.preventDefault()
    if (!content.trim() && !attachment) return
    const form = new FormData()
    form.append('content', content)
    if (user?.role === 'admin') form.append('user_id', selectedUser)
    if (attachment) form.append('attachment', attachment)
    await api.post('/support-chat/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    setContent(''); setAttachment(null); await loadMessages(); await loadContacts().catch(() => {})
  }

  const active = contacts.find((contact) => contact.id === selectedUser) || contacts[0]
  const ownSender = user?.role === 'admin' ? 'admin' : 'user'
  if (loading && !contacts.length) return <Loading label="Loading support chat..." />

  return <div className="space-y-6"><div className="card grid min-h-155 overflow-hidden md:grid-cols-[280px_1fr]"><aside className="border-b border-slate-200 dark:border-[#45484d] md:border-b-0 md:border-r"><div className="flex items-center gap-2 border-b border-slate-200 p-4 font-bold dark:border-[#45484d]"><MessageCircle size={19} className="text-[#23C55E]"/>Chats</div><div className="divide-y divide-slate-100 dark:divide-[#45484d]">{contacts.map((contact) => <button key={contact.id} onClick={() => setSelectedUser(contact.id)} className={`flex w-full items-center gap-3 p-3 text-left hover:bg-[#e8f8ed] ${active?.id === contact.id ? 'bg-[#e8f8ed] dark:bg-[#23462e]' : ''}`}><Avatar user={contact}/><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><div className="truncate text-sm font-semibold">{contact.name}</div>{contact.last_message_at && <time className="shrink-0 text-[10px] text-slate-500">{new Date(contact.last_message_at).toLocaleTimeString('en-EG', { hour: 'numeric', minute: '2-digit' })}</time>}</div><div className="flex items-center justify-between gap-2"><div className="truncate text-xs text-slate-500">{contact.last_message || contact.email}</div>{contact.unread_count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#23C55E] px-1 text-[10px] font-bold text-white">{contact.unread_count}</span>}</div></div></button>)}</div></aside><section className="flex min-h-155 flex-col"><div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-[#45484d]"><Avatar user={active}/><div><div className="font-bold">{active?.name || 'Support'}</div><div className="text-xs text-slate-500">{active?.email}</div></div></div><div className="flex-1 space-y-3 overflow-y-auto bg-[#17191a] p-5">{messages.length ? messages.map((message) => { const own = message.sender === ownSender; return <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${own ? 'bg-[#23C55E] text-white' : 'bg-[#292b2e] text-slate-100'}`}>{message.content && <p className="whitespace-pre-wrap">{message.content}</p>}<AttachmentPreview url={message.attachment_url} own={own}/><time className="mt-1 block text-[11px] opacity-60">{new Date(message.created_at).toLocaleTimeString('en-EG', { hour: 'numeric', minute: '2-digit' })}</time></div></div>}) : <div className="m-auto text-sm text-slate-400">No messages yet.</div>}</div><form onSubmit={send} className="border-t border-slate-200 bg-white p-3 dark:border-[#45484d] dark:bg-[#333538]"><div className="flex items-end gap-2"><label className="cursor-pointer rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#45484d]" title="Attach a file"><Paperclip size={19}/><input type="file" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] || null)}/></label><textarea value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(event) } }} rows="1" placeholder="Type a message" className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border-slate-200 bg-slate-50 text-sm dark:border-[#555960] dark:bg-[#292b2e]"/><button type="submit" className="rounded-xl bg-[#23C55E] p-2.5 text-white hover:bg-[#1eaa50]" title="Send"><Send size={18}/></button></div>{attachment && <div className="mt-2 flex items-center gap-2 text-xs text-slate-500"><AttachmentPreview file={attachment} own/><span className="truncate">{attachment.name}</span></div>}</form></section></div></div>
}
