import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts'
import { chartTooltip, VisualCard } from './VisualPrimitives'
export default function MatchRadar({ dims }: { dims: any }) {
  const data = [['skill', '技能匹配'], ['experience', '经验匹配'], ['education', '学历匹配'], ['salary', '薪资匹配']]
    .filter(([key]) => typeof dims?.[key]?.score === 'number')
    .map(([key, label]) => ({ label, score: dims[key].score }))
  if (!data.length) return null
  return <VisualCard title="匹配轮廓" description="沿用本次诊断的四维得分，不是个人综合能力或录用概率。">
    <ResponsiveContainer width="100%" height={250}><RadarChart data={data} outerRadius="70%"><PolarGrid stroke="var(--color-outline-variant)" /><PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} /><PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} /><Radar isAnimationActive={false} dataKey="score" name="匹配得分" stroke="#4f6ef7" fill="#4f6ef7" fillOpacity={.2} /><Tooltip contentStyle={chartTooltip} /></RadarChart></ResponsiveContainer>
  </VisualCard>
}
