import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { APPROVALS as FALLBACK_APPROVALS } from '../config/approvals'

export default function useApprovals() {
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [source, setSource] = useState('config')

  const fetchApprovals = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.listApprovals()
      if (data && Array.isArray(data.approvals)) {
        setApprovals(data.approvals)
        setSource('backend')
        setError(null)
      } else {
        throw new Error('Unexpected response shape from /api/approvals')
      }
    } catch (err) {
      setApprovals(
        FALLBACK_APPROVALS.map(a => ({
          ...a,
          content_id: a.content_id || String(a.id),
          approval_status: a.approval_status || 'pending',
        }))
      )
      setSource('config')
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchApprovals() }, [fetchApprovals])

  const _optimisticPatch = useCallback(async (contentId, newStatus, extras = {}) => {
    setApprovals(prev =>
      prev.map(a => {
        const key = a.content_id || String(a.id)
        if (key !== contentId) return a
        return {
          ...a,
          approval_status: newStatus,
          approved_at: newStatus === 'approved' ? new Date().toISOString() : null,
          reviewed_by: newStatus === 'pending' ? null : a.reviewed_by,
          revision_reason: Object.prototype.hasOwnProperty.call(extras, 'revision_reason')
            ? extras.revision_reason
            : a.revision_reason,
        }
      })
    )
    try {
      await api.patchApprovalStatus(contentId, newStatus, extras.revision_reason ?? null)
    } catch {
      await fetchApprovals()
    }
  }, [fetchApprovals])

  const approve = useCallback(contentId => _optimisticPatch(contentId, 'approved', { revision_reason: null }), [_optimisticPatch])
  const revise  = useCallback((contentId, reason) => _optimisticPatch(contentId, 'revision_requested', { revision_reason: reason }), [_optimisticPatch])
  const undo    = useCallback(contentId => _optimisticPatch(contentId, 'pending', { revision_reason: null }), [_optimisticPatch])

  return { approvals, loading, error, source, approve, revise, undo, refetch: fetchApprovals }
}
