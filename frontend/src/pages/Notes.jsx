import {
  Button,
  Chip,
  Input,
  Tooltip,
} from '@heroui/react'
import {
  Bold,
  Code2,
  File,
  FileText,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  Paperclip,
  Plus,
  Quote,
  Search,
  Trash2,
  Underline,
  Upload,
} from 'lucide-react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import Loading from '../components/Loading'
import api from '../services/api'
import { formatDateTime } from '../utils/format'

const localDateTime = (value) =>
  value ? formatDateTime(value, 'en-EG') : ''

const escapeHtml = (value = '') =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

const legacyHtml = (note) => {
  if (note?.content_html) return note.content_html
  if (!note?.content) return ''
  return `<p>${escapeHtml(note.content).replaceAll('\n', '<br>')}</p>`
}

const attachmentIcon = (attachment) => {
  if (attachment.kind === 'image') return ImageIcon
  return File
}

const formatBytes = (value = 0) => {
  if (!value) return '0 KB'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  )
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

export default function Notes() {
  const [items, setItems] = useState([])
  const [activeId, setActiveId] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saveState, setSaveState] = useState('saved')
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [draggingFiles, setDraggingFiles] = useState(false)

  const [draftTitle, setDraftTitle] = useState('')
  const [draftHtml, setDraftHtml] = useState('')

  const editorRef = useRef(null)
  const fileInputRef = useRef(null)
  const saveTimerRef = useRef(null)
  const activeIdRef = useRef('')
  const draftTitleRef = useRef('')
  const draftHtmlRef = useRef('')

  const activeNote = useMemo(
    () => items.find((item) => item.id === activeId) || null,
    [items, activeId]
  )

  const load = async (query = search, preferredId = activeIdRef.current) => {
    setLoading(true)
    setError('')

    try {
      const { data } = await api.get('/notes/', {
        params: {
          page: 1,
          search: query,
        },
      })

      const notes = data.results || []
      setItems(notes)

      const nextId =
        notes.find((note) => note.id === preferredId)?.id ||
        notes[0]?.id ||
        ''

      setActiveId(nextId)
      activeIdRef.current = nextId
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not load notes.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(
      () => load(search),
      search ? 250 : 0
    )

    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    activeIdRef.current = activeId

    if (!activeNote) {
      setDraftTitle('')
      setDraftHtml('')
      draftTitleRef.current = ''
      draftHtmlRef.current = ''
      if (editorRef.current) {
        editorRef.current.innerHTML = ''
      }
      return
    }

    const html = legacyHtml(activeNote)
    const title = activeNote.title || ''

    setDraftTitle(title)
    setDraftHtml(html)
    draftTitleRef.current = title
    draftHtmlRef.current = html
    setSaveState('saved')

    if (editorRef.current) {
      editorRef.current.innerHTML = html
    }
  }, [activeId])

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
    },
    []
  )

  const updateLocalNote = (id, updates) => {
    setItems((current) =>
      current.map((note) =>
        note.id === id
          ? { ...note, ...updates }
          : note
      )
    )
  }

  const saveDraft = async (
    noteId,
    title,
    html
  ) => {
    if (!noteId) return

    setSaveState('saving')

    try {
      const { data } = await api.patch(
        `/notes/${noteId}/`,
        {
          title,
          content_html: html,
        }
      )

      updateLocalNote(noteId, data)
      setSaveState('saved')
    } catch (err) {
      setSaveState('error')
      setError(
        err.response?.data?.detail ||
          'Could not save this note.'
      )
    }
  }

  const scheduleSave = (
    title = draftTitleRef.current,
    html = draftHtmlRef.current
  ) => {
    const noteId = activeIdRef.current
    if (!noteId) return

    setSaveState('unsaved')

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(
      () => saveDraft(noteId, title, html),
      650
    )
  }

  const createNote = async () => {
    setCreating(true)
    setError('')

    try {
      const { data } = await api.post('/notes/', {
        title: '',
        content_html: '',
      })

      setItems((current) => [data, ...current])
      setActiveId(data.id)
      activeIdRef.current = data.id
      setSearch('')
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not create a note.'
      )
    } finally {
      setCreating(false)
    }
  }

  const handleTitleChange = (value) => {
    setDraftTitle(value)
    draftTitleRef.current = value
    updateLocalNote(activeIdRef.current, {
      title: value,
    })
    scheduleSave(value, draftHtmlRef.current)
  }

  const handleEditorInput = () => {
    const html = editorRef.current?.innerHTML || ''
    setDraftHtml(html)
    draftHtmlRef.current = html
    scheduleSave(draftTitleRef.current, html)
  }

  const runCommand = (command, value = null) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    handleEditorInput()
  }

  const formatBlock = (tag) => {
    runCommand('formatBlock', tag)
  }

  const uploadFiles = async (files) => {
    if (!activeIdRef.current || !files?.length) return

    setUploading(true)
    setError('')

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)

        const { data } = await api.post(
          `/notes/${activeIdRef.current}/attachments/`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          }
        )

        setItems((current) =>
          current.map((note) =>
            note.id === activeIdRef.current
              ? {
                  ...note,
                  attachments: [
                    ...(note.attachments || []),
                    data,
                  ],
                  updated_at: new Date().toISOString(),
                }
              : note
          )
        )
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not upload attachment.'
      )
    } finally {
      setUploading(false)
      setDraggingFiles(false)
    }
  }

  const deleteAttachment = async (attachment) => {
    if (!activeIdRef.current) return

    try {
      await api.delete(
        `/notes/${activeIdRef.current}/attachments/${attachment.id}/`
      )

      setItems((current) =>
        current.map((note) =>
          note.id === activeIdRef.current
            ? {
                ...note,
                attachments: (
                  note.attachments || []
                ).filter(
                  (item) =>
                    item.id !== attachment.id
                ),
              }
            : note
        )
      )
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not remove attachment.'
      )
    }
  }

  const removeNote = async () => {
    if (!deleteTarget) return

    setDeleting(true)
    setError('')

    try {
      await api.delete(
        `/notes/${deleteTarget.id}/`
      )

      const remaining = items.filter(
        (note) => note.id !== deleteTarget.id
      )

      setItems(remaining)

      if (activeId === deleteTarget.id) {
        const nextId = remaining[0]?.id || ''
        setActiveId(nextId)
        activeIdRef.current = nextId
      }

      setDeleteTarget(null)
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Could not delete this note.'
      )
    } finally {
      setDeleting(false)
    }
  }

  const saveLabel = {
    saved: 'Saved',
    saving: 'Saving...',
    unsaved: 'Unsaved changes',
    error: 'Save failed',
  }[saveState]

  if (loading && !items.length && !search) {
    return <Loading label="Loading notes..." />
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">
            Notes
          </h1>
          <p className="mt-1 text-sm text-default-500">
            A flexible workspace for ideas, files,
            images, and working notes.
          </p>
        </div>

        <Button
          color="primary"
          radius="lg"
          isLoading={creating}
          onPress={createNote}
          startContent={
            !creating ? <Plus size={17} /> : null
          }
        >
          New note
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="grid min-h-[70vh] overflow-hidden rounded-2xl border border-default-200/70 bg-content1 shadow-sm dark:border-white/8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-b border-divider bg-default-50/55 dark:bg-white/[0.015] lg:border-b-0 lg:border-r">
          <div className="p-3">
            <Input
              aria-label="Search notes"
              size="sm"
              radius="lg"
              value={search}
              onValueChange={setSearch}
              placeholder="Search notes..."
              startContent={
                <Search
                  size={15}
                  className="text-default-400"
                />
              }
            />
          </div>

          <div className="max-h-[280px] flex-1 overflow-y-auto border-t border-divider lg:max-h-none">
            {items.length ? (
              items.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setActiveId(note.id)}
                  className={`group flex w-full items-start gap-3 border-b border-divider/70 px-3 py-3 text-left transition ${
                    activeId === note.id
                      ? 'bg-primary/8'
                      : 'hover:bg-default-100/70 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      activeId === note.id
                        ? 'bg-primary/12 text-primary'
                        : 'bg-default-100 text-default-500'
                    }`}
                  >
                    <FileText size={15} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {note.title || 'Untitled'}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-default-400">
                      {note.content ||
                        (note.attachments?.length
                          ? `${note.attachments.length} attachment${note.attachments.length === 1 ? '' : 's'}`
                          : 'Empty note')}
                    </span>
                  </span>

                  <button
                    type="button"
                    className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-default-400 opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation()
                      setDeleteTarget(note)
                    }}
                    aria-label="Delete note"
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              ))
            ) : (
              <div className="px-4 py-10 text-center text-sm text-default-400">
                {search
                  ? 'No notes match your search.'
                  : 'No notes yet.'}
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 bg-content1">
          {activeNote ? (
            <div
              className={`relative flex min-h-[70vh] flex-col transition ${
                draggingFiles
                  ? 'ring-2 ring-inset ring-primary'
                  : ''
              }`}
              onDragEnter={(event) => {
                event.preventDefault()
                setDraggingFiles(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setDraggingFiles(true)
              }}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget
                  )
                ) {
                  setDraggingFiles(false)
                }
              }}
              onDrop={(event) => {
                event.preventDefault()
                uploadFiles(event.dataTransfer.files)
              }}
            >
              {draggingFiles && (
                <div className="pointer-events-none absolute inset-3 z-40 grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-sm">
                  <div className="text-center text-primary">
                    <Upload
                      size={28}
                      className="mx-auto"
                    />
                    <p className="mt-2 text-sm font-semibold">
                      Drop files into this note
                    </p>
                  </div>
                </div>
              )}

              <div className="border-b border-divider px-4 py-3 sm:px-7">
                <div className="flex flex-wrap items-center gap-1">
                  <ToolbarButton
                    label="Heading 1"
                    icon={Heading1}
                    onPress={() =>
                      formatBlock('h1')
                    }
                  />
                  <ToolbarButton
                    label="Heading 2"
                    icon={Heading2}
                    onPress={() =>
                      formatBlock('h2')
                    }
                  />
                  <span className="mx-1 h-5 w-px bg-divider" />
                  <ToolbarButton
                    label="Bold"
                    icon={Bold}
                    onPress={() =>
                      runCommand('bold')
                    }
                  />
                  <ToolbarButton
                    label="Italic"
                    icon={Italic}
                    onPress={() =>
                      runCommand('italic')
                    }
                  />
                  <ToolbarButton
                    label="Underline"
                    icon={Underline}
                    onPress={() =>
                      runCommand('underline')
                    }
                  />
                  <span className="mx-1 h-5 w-px bg-divider" />
                  <ToolbarButton
                    label="Bulleted list"
                    icon={List}
                    onPress={() =>
                      runCommand(
                        'insertUnorderedList'
                      )
                    }
                  />
                  <ToolbarButton
                    label="Numbered list"
                    icon={ListOrdered}
                    onPress={() =>
                      runCommand(
                        'insertOrderedList'
                      )
                    }
                  />
                  <ToolbarButton
                    label="Quote"
                    icon={Quote}
                    onPress={() =>
                      formatBlock('blockquote')
                    }
                  />
                  <ToolbarButton
                    label="Code block"
                    icon={Code2}
                    onPress={() =>
                      formatBlock('pre')
                    }
                  />

                  <span className="mx-1 h-5 w-px bg-divider" />

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,application/pdf,.docx,.xlsx,.pptx,video/mp4,video/webm,audio/webm,audio/ogg,audio/mpeg,audio/mp4,text/plain,text/csv"
                    onChange={(event) => {
                      uploadFiles(event.target.files)
                      event.target.value = ''
                    }}
                  />

                  <Button
                    size="sm"
                    variant="light"
                    radius="lg"
                    isLoading={uploading}
                    startContent={
                      !uploading ? (
                        <Paperclip size={15} />
                      ) : null
                    }
                    onPress={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    Attach
                  </Button>

                  <div className="ml-auto">
                    <Chip
                      size="sm"
                      variant="flat"
                      color={
                        saveState === 'error'
                          ? 'danger'
                          : saveState === 'saved'
                            ? 'success'
                            : 'default'
                      }
                    >
                      {saveLabel}
                    </Chip>
                  </div>
                </div>
              </div>

              <div className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-10 sm:py-10">
                <input
                  value={draftTitle}
                  onChange={(event) =>
                    handleTitleChange(
                      event.target.value
                    )
                  }
                  placeholder="Untitled"
                  className="w-full border-0 bg-transparent text-3xl font-bold tracking-tight text-foreground outline-none placeholder:text-default-300 sm:text-4xl"
                />

                <div className="mt-2 flex items-center gap-2 text-[11px] text-default-400">
                  <span>
                    Updated{' '}
                    {localDateTime(
                      activeNote.updated_at
                    )}
                  </span>
                  {(activeNote.attachments?.length ||
                    0) > 0 && (
                    <>
                      <span>•</span>
                      <span>
                        {
                          activeNote.attachments
                            .length
                        }{' '}
                        attachment
                        {activeNote.attachments
                          .length === 1
                          ? ''
                          : 's'}
                      </span>
                    </>
                  )}
                </div>

                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleEditorInput}
                  data-placeholder="Start writing…"
                  className="note-editor mt-7 min-h-[300px] w-full text-[15px] leading-7 text-foreground outline-none"
                />

                {(activeNote.attachments || [])
                  .length > 0 && (
                  <section className="mt-10 border-t border-divider pt-6">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">
                          Attachments
                        </h3>
                        <p className="mt-0.5 text-xs text-default-400">
                          Images, documents, video,
                          audio, and working files.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {activeNote.attachments.map(
                        (attachment) => (
                          <AttachmentCard
                            key={attachment.id}
                            attachment={attachment}
                            onDelete={() =>
                              deleteAttachment(
                                attachment
                              )
                            }
                          />
                        )
                      )}
                    </div>
                  </section>
                )}
              </div>
            </div>
          ) : (
            <div className="grid min-h-[70vh] place-items-center px-6 text-center">
              <div>
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <FileText size={24} />
                </span>
                <h2 className="mt-4 text-lg font-semibold">
                  {search
                    ? 'No note selected'
                    : 'Create your first note'}
                </h2>
                <p className="mt-1 max-w-sm text-sm leading-6 text-default-500">
                  Write freely, format your ideas,
                  and keep images and files beside
                  your work.
                </p>
                {!search && (
                  <Button
                    className="mt-5"
                    color="primary"
                    onPress={createNote}
                    startContent={<Plus size={16} />}
                  >
                    New note
                  </Button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={removeNote}
        loading={deleting}
        title="Delete note?"
        message={`Delete ${deleteTarget?.title || 'this note'} and all of its attachments? This action cannot be undone.`}
      />
    </div>
  )
}

function ToolbarButton({
  label,
  icon: Icon,
  onPress,
}) {
  return (
    <Tooltip content={label} delay={400}>
      <Button
        isIconOnly
        size="sm"
        variant="light"
        radius="lg"
        aria-label={label}
        onMouseDown={(event) =>
          event.preventDefault()
        }
        onPress={onPress}
      >
        <Icon size={15} />
      </Button>
    </Tooltip>
  )
}

function AttachmentCard({
  attachment,
  onDelete,
}) {
  const Icon = attachmentIcon(attachment)

  if (attachment.kind === 'image') {
    return (
      <div className="group relative overflow-hidden rounded-2xl border border-default-200/70 bg-default-50/50 dark:border-white/8 dark:bg-white/[0.02]">
        <a
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          <img
            src={attachment.url}
            alt={attachment.name}
            className="h-44 w-full object-cover transition duration-200 group-hover:scale-[1.015]"
          />
        </a>

        <div className="flex items-center gap-2 p-3">
          <ImageIcon
            size={15}
            className="shrink-0 text-primary"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">
              {attachment.name}
            </p>
            <p className="text-[10px] text-default-400">
              {formatBytes(attachment.size)}
            </p>
          </div>

          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="danger"
            onPress={onDelete}
            aria-label="Remove attachment"
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-default-200/70 bg-default-50/50 p-3 dark:border-white/8 dark:bg-white/[0.02]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon size={18} />
      </span>

      <a
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
        className="min-w-0 flex-1"
      >
        <p className="truncate text-xs font-semibold text-foreground hover:text-primary">
          {attachment.name}
        </p>
        <p className="mt-0.5 text-[10px] text-default-400">
          {formatBytes(attachment.size)}
        </p>
      </a>

      <Button
        isIconOnly
        size="sm"
        variant="light"
        color="danger"
        onPress={onDelete}
        aria-label="Remove attachment"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  )
}
