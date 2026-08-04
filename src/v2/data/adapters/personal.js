// adapters/personal.js — MOSV2-C Personal task lane (PLAN §4 Domain 7, G3).
// Z4 restricted set: Personal business-lane tasks from MASTER_TASKS only.
// The lane is filtered client-side as well as server-side — the adapter never
// trusts the ?business= filter alone (documented MASTER_TASKS filter defects).
// Absence is quiet-empty, never an error (G3).

import { fetchTasks, mapTasks } from './tasks.js'

export function fetchPersonalTasks(signal) {
  return fetchTasks(signal, { business: 'Personal' })
}

export function mapPersonalTasks(payload) {
  const { tasks } = mapTasks(payload)
  const lane = tasks.filter((task) => task.business === 'Personal')
  return { tasks: lane, count: lane.length, empty: lane.length === 0 }
}
