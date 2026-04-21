import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const VALID_BIZ = new Set(['som', 'fm', 'e7a', 'book', 'os'])

export default function useDispatchTasks(biz) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchTasks = useCallback(async () => {
    if (!biz || !VALID_BIZ.has(biz)) { setTasks([]); return }
    setLoading(true)
    try {
      const data = await api.listDispatchTasks(biz, 20)
      setTasks(data.tasks || [])
      setError(null)
    } catch (err) {
      setTasks([])
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [biz])

  useEffect(() => { fetchTasks() }, [fetchTasks])
  return { tasks, loading, error, refetch: fetchTasks }
}
