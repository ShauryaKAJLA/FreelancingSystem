import { useEffect, useMemo, useRef, useState } from 'react'
import { FiArrowLeft, FiArrowUpRight, FiMessageCircle, FiPaperclip, FiSearch, FiSend, FiSmile } from 'react-icons/fi'
import { useSelector } from 'react-redux'
import { useGetConversationQuery, useGetConversationsQuery, useSendMessageMutation } from '../messagesApi'
import { useNotify } from '../../shared/notifications/NotificationProvider'
import { formatDate } from '../../shared/utils/format'

// Live mode polls so replies show up without a reload.
const POLL_MS = 15000
const NO_ITEMS = []

export default function MessagesPage() {
  const user = useSelector((s) => s.auth.currentUser)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(null)
  const [draft, setDraft] = useState('')
  // Mobile (<lg) shows one pane at a time: the thread list or the open conversation.
  // At lg+ both panes render side by side regardless of this and it's unused.
  const [mobileView, setMobileView] = useState('list')
  const bottomRef = useRef(null)

  const notify = useNotify()
  const pollingInterval = POLL_MS
  const { data: conversations = NO_ITEMS } = useGetConversationsQuery(user?.userId, { skip: !user?.userId, pollingInterval })
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation()

  const threads = useMemo(() => {
    const q = query.toLowerCase()
    return conversations
      .map((c) => ({ id: c.userId, other: { name: c.name, role: c.role }, last: c.lastMessage, unread: c.unreadCount }))
      .filter((t) => t.other.name.toLowerCase().includes(q) || t.last?.messageText.toLowerCase().includes(q))
  }, [conversations, query])

  const selected = threads.find((t) => t.id === active) || threads[0]
  const { data: items = NO_ITEMS } = useGetConversationQuery({ me: user?.userId, otherUserId: selected?.id }, { skip: !selected, pollingInterval })

  // Keep the newest message in view when switching threads or sending.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [selected?.id, items.length])

  function openThread(id) {
    setActive(id)
    setMobileView('conversation')
  }

  async function send() {
    const text = draft.trim()
    if (!text || !selected || sending) return
    const result = await sendMessage({ senderId: user.userId, receiverId: selected.id, messageText: text })
    if (result.error) {
      notify.error(result.error.data ?? 'Could not send the message.')
      return
    }
    setDraft('')
  }

  return (
    <div className="stagger">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">Communication</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900">Messages</h1>
          <p className="mt-1 text-sm text-slate-500">Keep client and freelancer conversations close to the work.</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">{threads.length} conversations</span>
      </div>

      <div className="mt-6 grid h-[calc(100vh-17rem)] min-h-[480px] grid-cols-1 grid-rows-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[320px_1fr]">
        <aside className={`min-h-0 flex-col border-slate-100 lg:flex lg:border-r ${mobileView === 'conversation' ? 'hidden' : 'flex'}`}>
          <div className="shrink-0 border-b border-slate-100 p-4">
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <FiSearch className="text-slate-400" />
              <input className="w-full bg-transparent text-sm outline-none" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chats" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {threads.length === 0 && (
              <p className="p-6 text-center text-sm text-slate-400">{query ? 'No conversations match your search.' : 'No conversations yet.'}</p>
            )}
            {threads.map((t) => (
              <button key={t.id} onClick={() => openThread(t.id)} className={`w-full border-b border-slate-50 p-4 text-left hover:bg-violet-500/40 ${selected?.id === t.id ? '' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-xs font-black text-white">
                    {t.other?.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-black text-slate-800">{t.other?.name}</p>
                      <span className="text-[10px] text-slate-400">{formatDate(t.last?.sentAt)}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{t.last?.messageText}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className={`min-h-0 min-w-0 flex-col lg:flex ${mobileView === 'list' ? 'hidden' : 'flex'}`}>
          <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileView('list')} aria-label="Back to conversations" className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:text-violet-600 lg:hidden">
                <FiArrowLeft />
              </button>
              {selected ? (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-xs font-black text-white">
                    {selected.other?.name.split(' ').map((x) => x[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-black text-slate-900">{selected.other?.name}</p>
                    <p className="text-xs text-slate-400">{selected.other?.role}</p>
                  </div>
                </>
              ) : (
                <p className="font-black">Select a conversation</p>
              )}
            </div>
            <button className="rounded-xl border border-slate-200 p-2 text-slate-500">
              <FiArrowUpRight />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-y-auto bg-slate-50 p-5">
            {items.map((m) => (
              <div key={m.messageId} className={`flex ${m.senderId === user?.userId ? 'justify-end' : ''}`}>
                <div className={`max-w-[78%] break-words rounded-2xl px-4 py-3 text-sm ${m.senderId === user?.userId ? 'rounded-br-md bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-100' : 'rounded-bl-md border border-slate-200 bg-white text-slate-700'}`}>
                  <p className="leading-6">{m.messageText}</p>
                  <p className={`mt-2 text-[10px] ${m.senderId === user?.userId ? 'text-white/60' : 'text-slate-400'}`}>{formatDate(m.sentAt)}</p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
            {!selected && (
              <div className="m-auto text-center">
                <FiMessageCircle className="mx-auto text-4xl text-slate-200" />
                <p className="mt-3 text-sm font-bold text-slate-500">Your conversations appear here.</p>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-100 p-4">
            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-violet-300 focus-within:bg-white">
              <button className="rounded-xl p-2 text-slate-400 hover:text-violet-600">
                <FiPaperclip />
              </button>
              <textarea
                rows="1"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
                className="max-h-28 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none"
                placeholder={selected ? 'Write a message…' : 'Select a conversation first'}
              />
              <button className="rounded-xl p-2 text-slate-400 hover:text-violet-600">
                <FiSmile />
              </button>
              <button onClick={send} disabled={!selected || !draft.trim() || sending} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white disabled:opacity-40">
                <FiSend size={15} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
