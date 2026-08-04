// adapters/book.js — MOSV2-C Book task lane (PLAN §4 Domain 4, G1).
// Task-lane fallback ONLY: task-based Book information via MASTER_TASKS. No
// BK_Project / BK_Blockers claims and no dedicated Book read model exists —
// the tile renders lawful quiet-empty when no Book tasks exist (G1).

import { fetchTasks, mapTasks } from './tasks.js'

export function fetchBookTasks(signal) {
  return fetchTasks(signal, { business: 'Book' })
}

export function mapBookTasks(payload) {
  const { tasks } = mapTasks(payload)
  const lane = tasks.filter((task) => task.business === 'Book')
  return { tasks: lane, count: lane.length, empty: lane.length === 0 }
}
