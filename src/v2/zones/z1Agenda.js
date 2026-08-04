// z1Agenda.js — Z1 Today agenda + greeting derivation (PLAN §8 Z1).
// Pure and dependency-free: no fetch, no timers, no React. Input is the mapped
// event shape from adapters/calendar.js (mapCalendarEvents). Titles arrive
// server-sanitized and pass through verbatim; components render them as plain
// text only.

// Client-clock daypart (local hour): morning before 12, afternoon before 18,
// evening otherwise. Used by Z1Greeting with the fixed name "Denarius".
export function greetingForHour(hour) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// Events on today (local timezone), sorted by start ascending. Events with a
// missing or unparseable start are dropped — the agenda never renders a lie.
export function agendaForToday(events, now = new Date()) {
  const list = Array.isArray(events) ? events : []
  return list
    .filter((event) => {
      if (!event || !event.start) return false
      const start = new Date(event.start)
      if (Number.isNaN(start.getTime())) return false
      return (
        start.getFullYear() === now.getFullYear() &&
        start.getMonth() === now.getMonth() &&
        start.getDate() === now.getDate()
      )
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
}

// Local HH:MM display for one event start ("9:05 AM"). Unparseable → em-dash.
export function formatEventTime(start) {
  const date = new Date(start)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}
