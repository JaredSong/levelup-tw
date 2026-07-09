import { ChevronDown, Database, HardDrive } from 'lucide-react'
import { useActiveExam } from './useActiveExam'

export function ActiveExamHeader() {
  const { activeExam, installedExams } = useActiveExam()
  const canSwitch = installedExams.length > 1

  return (
    <div className="active-exam-bar" aria-label="Active exam">
      <button className="active-exam-chip" disabled={!canSwitch} title={canSwitch ? 'Switch exam' : 'Only installed exam'} type="button">
        <Database size={16} />
        <span>
          <strong>{activeExam.titleZh}</strong>
          <small>{activeExam.category} · {activeExam.level} · {activeExam.version}</small>
        </span>
        <ChevronDown size={16} />
      </button>
      <span className="active-exam-status"><HardDrive size={14} /> Offline</span>
    </div>
  )
}
