import { useEffect, useMemo, useState } from 'react'
import { Check, Circle, Cloud, ListTodo, LogOut, Plus, Trash2 } from 'lucide-react'
import { isSupabaseConfigured, supabase } from './supabase.js'

function AuthScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password })

    if (result.error) setMessage(result.error.message)
    else if (mode === 'signup' && !result.data.session) {
      setMessage('Account created. Check your email to confirm it, then sign in.')
    }
    setBusy(false)
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <a className="brand auth-brand" href="#top">
          <span className="brand-mark"><Check size={18} strokeWidth={3} /></span>
          Daymark
        </a>
        <p className="eyebrow">YOUR DAILY FOCUS</p>
        <h1>{mode === 'login' ? 'Welcome back.' : 'Begin with clarity.'}</h1>
        <p className="subtitle">Your tasks, safely available wherever you sign in.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required /></label>
          <button type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        {message && <p className="form-message" role="status">{message}</p>}
        <button className="mode-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>
          {mode === 'login' ? 'New to Daymark? Create an account' : 'Already have an account? Sign in'}
        </button>
      </section>
    </main>
  )
}

function TaskManager({ user }) {
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadTasks() {
      const { data, error: loadError } = await supabase
        .from('tasks').select('*').order('created_at', { ascending: false })
      if (loadError) setError(loadError.message)
      else setTasks(data)
      setLoading(false)
    }
    loadTasks()
  }, [])

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    if (filter === 'active') return !task.completed
    if (filter === 'done') return task.completed
    return true
  }), [tasks, filter])

  const completed = tasks.filter((task) => task.completed).length
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0

  async function addTask(event) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    setError('')
    const { data, error: addError } = await supabase
      .from('tasks').insert({ title: cleanTitle, user_id: user.id }).select().single()
    if (addError) setError(addError.message)
    else { setTasks((current) => [data, ...current]); setTitle('') }
  }

  async function toggleTask(task) {
    const { data, error: updateError } = await supabase
      .from('tasks').update({ completed: !task.completed }).eq('id', task.id).select().single()
    if (updateError) setError(updateError.message)
    else setTasks((current) => current.map((item) => item.id === task.id ? data : item))
  }

  async function deleteTask(id) {
    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else setTasks((current) => current.filter((task) => task.id !== id))
  }

  return (
    <main className="page-shell">
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark"><Check size={18} strokeWidth={3} /></span>Daymark</a>
        <div className="account-area"><span>{user.email}</span><button onClick={() => supabase.auth.signOut()}><LogOut size={16} /> Sign out</button></div>
      </header>
      <section className="workspace" id="top">
        <div className="intro"><p className="eyebrow">YOUR DAILY FOCUS</p><h1>Make today count.</h1><p className="subtitle"><Cloud size={16} /> Your tasks are synced with Supabase.</p></div>
        <section className="task-card" aria-label="Task manager">
          <form className="add-form" onSubmit={addTask}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" aria-label="New task" maxLength={120} />
            <button type="submit"><Plus size={19} /> Add task</button>
          </form>
          {error && <p className="error-banner">{error}</p>}
          <div className="summary"><div><strong>{tasks.length - completed}</strong><span> left today</span></div><div className="progress-wrap"><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><span>{progress}% complete</span></div></div>
          <div className="filters" role="group" aria-label="Filter tasks">
            {['all', 'active', 'done'].map((option) => <button className={filter === option ? 'active' : ''} key={option} onClick={() => setFilter(option)} type="button">{option[0].toUpperCase() + option.slice(1)}</button>)}
          </div>
          <div className="task-list">
            {loading ? <div className="empty-state"><p>Loading your tasks…</p></div> : filteredTasks.length === 0 ? <div className="empty-state"><ListTodo size={30} /><p>No tasks here. Enjoy the breathing room.</p></div> : filteredTasks.map((task) => (
              <article className={`task-row ${task.completed ? 'completed' : ''}`} key={task.id}>
                <button className="check-button" onClick={() => toggleTask(task)} aria-label={`Toggle ${task.title}`}>{task.completed ? <Check size={17} strokeWidth={3} /> : <Circle size={19} />}</button>
                <span>{task.title}</span>
                <button className="delete-button" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`}><Trash2 size={17} /></button>
              </article>
            ))}
          </div>
        </section>
      </section>
      <footer>Built for clear minds and good days.</footer>
    </main>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) return <main className="setup-page"><div className="setup-card"><Cloud size={36} /><h2>Connect Supabase</h2><p>Create a <code>.env</code> file from <code>.env.example</code>, then add your Project URL and publishable key.</p></div></main>
  if (checking) return <main className="setup-page"><p>Starting Daymark…</p></main>
  return session ? <TaskManager user={session.user} /> : <AuthScreen />
}
