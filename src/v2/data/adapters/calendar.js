// adapters/calendar.js — MOSV2-C Google Calendar adapter (PLAN §4 Domain 2).
// Serves the Z1 Today agenda, Z4 personal calendar, and Z2 countdown date
// inputs. Range responses carry {summary, title, description, start, end,
// source_calendar_id} — no id / is_all_day (verified at the §3.4 gate).
// Titles are sanitized server-side; the mapper passes them through verbatim.

import { apiFetch } from '../apiFetch.js'

export function fetchCalendarEvents(signal, { daysAhead = 1, maxResults = 20 } = {}) {
  return apiFetch(`/api/mya/calendar/events?days_ahead=${daysAhead}&max_results=${maxResults}`, { signal })
}

const toArray = (value) => (Array.isArray(value) ? value : [])

export function mapCalendarEvents(payload) {
  const events = toArray(payload && payload.events).map((event) => {
    const e = event && typeof event === 'object' ? event : {}
    return {
      title: e.title ?? e.summary ?? '',
      summary: e.summary ?? '',
      description: e.description ?? '',
      start: e.start ?? null,
      end: e.end ?? null,
      sourceCalendarId: e.source_calendar_id ?? null,
    }
  })
  return {
    events,
    count: events.length,
    empty: events.length === 0,
    fetchedAt: (payload && payload.fetched_at) ?? null,
  }
}
