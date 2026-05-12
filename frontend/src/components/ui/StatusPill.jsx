import { Badge } from './Badge'
import { STATUS_META } from '../../utils/status'

export function StatusPill({ status, className = '' }) {
  const meta = STATUS_META[status] || STATUS_META.new
  return (
    <Badge tone={meta.tone} dot className={className}>
      {meta.label}
    </Badge>
  )
}
