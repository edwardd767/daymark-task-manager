import { useEffect, useMemo, useState } from 'react'
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Circle, Cloud, Download, FileText, ListTodo, LogOut, Plus, Trash2 } from 'lucide-react'
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
  const today = new Date().toLocaleDateString('en-CA')
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(today)
  const [selectedDate, setSelectedDate] = useState(today)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reportFrom, setReportFrom] = useState(`${today.slice(0, 8)}01`)
  const [reportTo, setReportTo] = useState(today)

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

  const selectedTasks = useMemo(() => tasks.filter((task) => task.due_date === selectedDate), [tasks, selectedDate])

  const filteredTasks = useMemo(() => selectedTasks.filter((task) => {
    if (filter === 'active') return !task.completed
    if (filter === 'done') return task.completed
    return true
  }), [selectedTasks, filter])

  const completed = selectedTasks.filter((task) => task.completed).length
  const progress = selectedTasks.length ? Math.round((completed / selectedTasks.length) * 100) : 0
  const alertTasks = useMemo(() => tasks.filter((task) => !task.completed && task.due_date <= today), [tasks, today])
  const reportTasks = useMemo(() => tasks
    .filter((task) => task.due_date >= reportFrom && task.due_date <= reportTo)
    .sort((a, b) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title)), [tasks, reportFrom, reportTo])
  const reportCompleted = reportTasks.filter((task) => task.completed).length
  const reportPending = reportTasks.length - reportCompleted
  const reportOverdue = reportTasks.filter((task) => !task.completed && task.due_date < today).length
  const completionRate = reportTasks.length ? Math.round((reportCompleted / reportTasks.length) * 100) : 0
  const reportByDate = useMemo(() => {
    const grouped = reportTasks.reduce((result, task) => {
      if (!result[task.due_date]) result[task.due_date] = { date: task.due_date, total: 0, completed: 0 }
      result[task.due_date].total += 1
      if (task.completed) result[task.due_date].completed += 1
      return result
    }, {})
    return Object.values(grouped)
  }, [reportTasks])
  const highestDailyTotal = Math.max(...reportByDate.map((item) => item.total), 1)

  function downloadReport() {
    const escapeCsv = (value) => `"${String(value).replaceAll('"', '""')}"`
    const rows = [
      ['Date', 'Task', 'Status'],
      ...reportTasks.map((task) => [task.due_date, task.title, task.completed ? 'Completed' : task.due_date < today ? 'Overdue' : 'Pending']),
    ]
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `daymark-report-${reportFrom}-to-${reportTo}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function showAlertTasks() {
    if (!alertTasks.length) return
    const earliestDate = [...alertTasks].sort((a, b) => a.due_date.localeCompare(b.due_date))[0].due_date
    setSelectedDate(earliestDate)
    setFilter('active')
  }

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${selectedDate}T00:00:00`)
    date.setDate(date.getDate() + index)
    const iso = date.toLocaleDateString('en-CA')
    const dayTasks = tasks.filter((task) => task.due_date === iso)
    return {
      iso,
      day: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date),
      date: date.getDate(),
      total: dayTasks.length,
      done: dayTasks.filter((task) => task.completed).length,
    }
  }), [selectedDate, tasks])

  function moveWeek(days) {
    const date = new Date(`${selectedDate}T00:00:00`)
    date.setDate(date.getDate() + days)
    setSelectedDate(date.toLocaleDateString('en-CA'))
  }

  async function addTask(event) {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) return
    setError('')
    const { data, error: addError } = await supabase
      .from('tasks').insert({ title: cleanTitle, due_date: dueDate, user_id: user.id }).select().single()
    if (addError) setError(addError.message)
    else { setTasks((current) => [data, ...current]); setTitle(''); setSelectedDate(dueDate) }
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
        <div className="intro"><p className="eyebrow">YOUR DAILY FOCUS</p><h1>Make today count.</h1><p className="subtitle"><Cloud size={16} /> Update your daily tasks here.</p></div>
        {alertTasks.length > 0 && (
          <button className="overdue-alert" type="button" onClick={showAlertTasks}>
            <span className="overdue-icon"><Bell size={19} fill="currentColor" /></span>
            <span><strong>{alertTasks.length} {alertTasks.length === 1 ? 'task needs' : 'tasks need'} attention</strong><small>Tap to review incomplete tasks due today or earlier.</small></span>
            <ChevronRight size={19} />
          </button>
        )}
        <section className="daily-overview" aria-label="Tasks by day">
          <div className="overview-heading">
            <div><p className="eyebrow">DAILY OVERVIEW</p><h2>Plan the week ahead.</h2></div>
            <div className="week-controls">
              <button type="button" onClick={() => moveWeek(-7)} aria-label="Previous week"><ChevronLeft size={18} /></button>
              <button type="button" className="today-button" onClick={() => setSelectedDate(today)}>Today</button>
              <button type="button" onClick={() => moveWeek(7)} aria-label="Next week"><ChevronRight size={18} /></button>
            </div>
          </div>
          <div className="day-grid">
            {weekDays.map((item) => (
              <button type="button" key={item.iso} className={`day-card ${selectedDate === item.iso ? 'selected' : ''}`} onClick={() => setSelectedDate(item.iso)}>
                <span>{item.day}</span><strong>{item.date}</strong><small>{item.total} {item.total === 1 ? 'task' : 'tasks'}</small><em>{item.done} done</em>
              </button>
            ))}
          </div>
        </section>
        <section className="task-card" aria-label="Task manager">
          <form className="add-form" onSubmit={addTask}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" aria-label="New task" maxLength={120} />
            <label className="date-field"><CalendarDays size={17} /><input type="date" value={dueDate} min={today} onChange={(e) => setDueDate(e.target.value)} aria-label="Task due date" required /></label>
            <button type="submit"><Plus size={19} /> Add task</button>
          </form>
          {error && <p className="error-banner">{error}</p>}
          <div className="summary"><div><strong>{selectedTasks.length - completed}</strong><span> left on {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${selectedDate}T00:00:00`))}</span></div><div className="progress-wrap"><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><span>{progress}% complete</span></div></div>
          <div className="filters" role="group" aria-label="Filter tasks">
            {['all', 'active', 'done'].map((option) => <button className={filter === option ? 'active' : ''} key={option} onClick={() => setFilter(option)} type="button">{option[0].toUpperCase() + option.slice(1)}</button>)}
          </div>
          <div className="task-list">
            {loading ? <div className="empty-state"><p>Loading your tasks…</p></div> : filteredTasks.length === 0 ? <div className="empty-state"><ListTodo size={30} /><p>No tasks for this day. Enjoy the breathing room.</p></div> : filteredTasks.map((task) => (
              <article className={`task-row ${task.completed ? 'completed' : ''}`} key={task.id}>
                <button className="check-button" onClick={() => toggleTask(task)} aria-label={`Toggle ${task.title}`}>{task.completed ? <Check size={17} strokeWidth={3} /> : <Circle size={19} />}</button>
                <span className="task-content"><span>{task.title}</span>{!task.completed && task.due_date <= today && <small className={`overdue-label ${task.due_date === today ? 'due-today' : ''}`}><Bell size={12} fill="currentColor" /> {task.due_date === today ? 'Due today' : 'Overdue'}</small>}</span>
                <button className="delete-button" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`}><Trash2 size={17} /></button>
              </article>
            ))}
          </div>
        </section>
        <section className="report-card" aria-label="Task report">
          <div className="report-heading">
            <div><p className="eyebrow">TASK REPORT</p><h2><FileText size={23} /> Records by date and status.</h2></div>
            <button type="button" onClick={downloadReport} disabled={!reportTasks.length}><Download size={17} /> Download CSV</button>
          </div>
          <div className="report-filters">
            <label>From<input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)} /></label>
            <label>To<input type="date" value={reportTo} min={reportFrom} onChange={(e) => setReportTo(e.target.value)} /></label>
          </div>
          <div className="report-summary">
            <div><strong>{reportTasks.length}</strong><span>Total tasks</span></div>
            <div><strong>{reportCompleted}</strong><span>Completed</span></div>
            <div><strong>{reportPending}</strong><span>Pending</span></div>
          </div>
          <section className="bi-dashboard" aria-label="Business intelligence dashboard">
            <div className="bi-title"><p className="eyebrow">BI OVERVIEW</p><h3>Performance insights</h3></div>
            <div className="bi-grid">
              <div className="bi-panel completion-panel">
                <span className="panel-label">Completion rate</span>
                <div className="donut-chart" style={{ '--completion': `${completionRate * 3.6}deg` }}><div><strong>{completionRate}%</strong><small>complete</small></div></div>
                <div className="chart-legend"><span><i className="legend-completed" /> {reportCompleted} completed</span><span><i className="legend-pending" /> {reportPending} pending</span></div>
              </div>
              <div className="bi-panel insight-panel">
                <span className="panel-label">Key indicators</span>
                <div className="indicator"><span>Overdue tasks</span><strong className={reportOverdue ? 'danger-text' : ''}>{reportOverdue}</strong></div>
                <div className="indicator"><span>Active days</span><strong>{reportByDate.length}</strong></div>
                <div className="indicator"><span>Average tasks/day</span><strong>{reportByDate.length ? (reportTasks.length / reportByDate.length).toFixed(1) : '0.0'}</strong></div>
              </div>
              <div className="bi-panel trend-panel">
                <span className="panel-label">Tasks by day</span>
                {reportByDate.length === 0 ? <p className="chart-empty">No data for this period.</p> : <div className="bar-chart">
                  {reportByDate.map((item) => <div className="bar-column" key={item.date} title={`${item.date}: ${item.total} tasks, ${item.completed} completed`}>
                    <div className="bar-value">{item.total}</div>
                    <div className="bar-track"><span style={{ height: `${Math.max((item.total / highestDailyTotal) * 100, 8)}%` }}><i style={{ height: `${item.total ? (item.completed / item.total) * 100 : 0}%` }} /></span></div>
                    <small>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${item.date}T00:00:00`))}</small>
                  </div>)}
                </div>}
              </div>
            </div>
          </section>
          <div className="report-table-wrap">
            <table className="report-table">
              <thead><tr><th>Date</th><th>Task</th><th>Status</th></tr></thead>
              <tbody>
                {reportTasks.length === 0 ? <tr><td colSpan="3" className="report-empty">No tasks found for this date range.</td></tr> : reportTasks.map((task) => {
                  const status = task.completed ? 'Completed' : task.due_date < today ? 'Overdue' : 'Pending'
                  return <tr key={task.id}><td>{new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(`${task.due_date}T00:00:00`))}</td><td>{task.title}</td><td><span className={`status-badge ${status.toLowerCase()}`}>{status}</span></td></tr>
                })}
              </tbody>
            </table>
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
