import { Button, Textarea } from 'flowbite-react'
import { MessageCircle, Paperclip, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import Loading from '../components/Loading'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

function Avatar({ user }) {
  return <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[#23C55E] font-bold text-white">{user?.profile_image_url ? <img src={user.profile_image_url} alt="" className="h-full w-full object-cover"/> : user?.name?.slice(0, 1).toUpperCase() || '?'}</div>
}

export default function SupportChat() {
  const { user } = useAuth()
  const [contacts, setContacts] = useState([])
  const [selectedUser, setSelectedUser] = useState('')
  const [messages, setMessages] = useState([])
  const [content, setContent] = useState('')
  const [attachment, setAttachment] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadMessages = async (userId = selectedUser) => {
    try {
      const { data } = await api.get('/support-chat/', { params: user?.role === 'admin' && userId ? { user_id: userId } : {} })
      setMessages(data)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (user?.role === 'admin') {
      api.get('/admin/users/').then(({ data }) => {
        const users = (data.users || data).filter((item) => item.role !== 'admin')
        setContacts(users)
        if (users[0]) setSelectedUser(users[0].id)
        else setLoading(false)
      }).catch(() => setLoading(false))
    } else {
      setContacts([{ id: 'support', name: 'Revnivo Support', email: 'Technical support' }])
      loadMessages()
    }
  }, [user?.role])

  useEffect(() => { if (selectedUser && user?.role === 'admin') loadMessages(selectedUser) }, [selectedUser])
  useEffect(() => { if (user?.role === 'admin' && !selectedUser) return undefined; const timer = window.setInterval(() => loadMessages(), 3000); return () => window.clearInterval(timer) }, [selectedUser, user?.role])

  const send = async (event) => {
    event.preventDefault()
    if (!content.trim() && !attachment) return
    const form = new FormData()
    form.append('content', content)
    if (user?.role === 'admin') form.append('user_id', selectedUser)
    if (attachment) form.append('attachment', attachment)
    await api.post('/support-chat/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    setContent(''); setAttachment(null); await loadMessages()
  }

  if (loading && !contacts.length) return <Loading label="Loading support chat..." />
  const active = contacts.find((contact) => contact.id === selectedUser) || contacts[0]
  const ownSender = user?.role === 'admin' ? 'admin' : 'user'

  return <div className="space-y-6"><div className="card grid min-h-155 overflow-hidden md:grid-cols-[260px_1fr]"><aside className="border-b border-slate-200 dark:border-[#45484d] md:border-b-0 md:border-r"><div className="flex items-center gap-2 border-b border-slate-200 p-4 font-bold dark:border-[#45484d]"><MessageCircle size={19} className="text-[#23C55E]"/>Contacts</div><div className="divide-y divide-slate-100 dark:divide-[#45484d]">{contacts.map((contact) => <button key={contact.id} onClick={() => setSelectedUser(contact.id)} className={`flex w-full items-center gap-3 p-4 text-left hover:bg-[#e8f8ed] ${active?.id === contact.id ? 'bg-[#e8f8ed] dark:bg-[#23462e]' : ''}`}><Avatar user={contact}/><div className="min-w-0"><div className="truncate text-sm font-semibold">{contact.name}</div><div className="truncate text-xs text-slate-500">{contact.email}</div></div></button>)}</div></aside><section className="flex min-h-155 flex-col"><div className="flex items-center gap-3 border-b border-slate-200 p-4 dark:border-[#45484d]"><Avatar user={active}/><div><div className="font-bold">{active?.name || 'Support'}</div><div className="text-xs text-slate-500">{active?.email}</div></div></div><div className="flex-1 space-y-3 overflow-y-auto bg-[#fffdf5] p-5 dark:bg-[#292b2e]">{messages.length ? messages.map((message) => { const own = message.sender === ownSender; return <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] rounded-2xl p-3 text-sm ${own ? 'bg-[#e8f8ed] text-[#14532d]' : 'bg-[#14532d] text-white'}`}><p>{message.content}</p>{message.attachment_url && <a className="mt-2 block underline" href={message.attachment_url} target="_blank" rel="noreferrer">Open attachment</a>}<time className="mt-1 block text-[11px] opacity-60">{new Date(message.created_at).toLocaleString('en-EG', { timeZone: 'Africa/Cairo' })}</time></div></div>}) : <div className="m-auto text-sm text-slate-500">No messages yet.</div>}</div><form onSubmit={send} className="border-t border-slate-200 p-4 dark:border-[#45484d]"><div className="flex items-end gap-2"><label className="cursor-pointer rounded-xl p-3 text-slate-500 hover:bg-slate-100" title="Attach file"><Paperclip size={19}/><input type="file" className="hidden" onChange={(event) => setAttachment(event.target.files?.[0] || null)}/></label><Textarea rows={2} value={content} onChange={(event) => setContent(event.target.value)} placeholder="Write a message..."/><Button color="success" type="submit" className="shrink-0"><Send size={17}/></Button></div>{attachment && <div className="mt-2 text-xs text-slate-500">Attached: {attachment.name}</div>}</form></section></div></div>
}
