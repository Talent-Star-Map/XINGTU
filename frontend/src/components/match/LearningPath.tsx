import LearningTimeline from './LearningTimeline'

interface Props {
  phases: any[]
  totalWeeks: string
  targetJobTitle: string
  storageKey?: string
}

export default function LearningPath({ phases, totalWeeks, targetJobTitle, storageKey }: Props) {
  return (
    <LearningTimeline
      phases={phases}
      totalWeeks={totalWeeks}
      targetJobTitle={targetJobTitle}
      storageKey={storageKey}
    />
  )
}
