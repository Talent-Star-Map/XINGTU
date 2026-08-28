/**
 * JobGraphPage — 单页一体化「岗位图谱」
 * 三栏布局:
 *   左(260): 节点列表 + 来源过滤
 *   中(主):  2D 力导向图 + 顶部工具条 + 右下角演化时间轴
 *   右(380): KGChat(智能问答 / 决策建议 / 变化归因)
 *
 * 所有功能集中在这一页,不做多页跳转。
 */
import { useEffect, useMemo, useState } from 'react'
import { Activity } from 'lucide-react'
import JobGraphCanvas from '../../components/kg/JobGraphCanvas'
import KGChat from '../../components/kg/KGChat'
import SemanticSearchBox from '../../components/kg/SemanticSearchBox'
import SourceFilter from '../../components/kg/SourceFilter'
import NodeListPanel from '../../components/kg/NodeListPanel'
import JobEvolutionTimeline from '../../components/kg/JobEvolutionTimeline'
import { kgApi } from '../../components/kg/api'
import { JSNav } from '../../lib/NavContext'

export default function JobGraphPage() {
  const { setPage } = JSNav.use()
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] })
  const [overview, setOverview] = useState<any>({})
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [sources, setSources] = useState<{ source: string; cnt: number }[]>([])
  const [activeSources, setActiveSources] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  // 加载总览 + 全图
  useEffect(() => {
    setLoading(true)
    Promise.all([kgApi.overview(), kgApi.graph(200, 80)])
      .then(([ov, g]) => {
        setOverview(ov || {})
        setSources(ov?.sources || [])
        setGraphData(g || { nodes: [], links: [] })
      })
      .catch((e) => console.error('[JobGraphPage] 数据加载失败:', e))
      .finally(() => setLoading(false))
  }, [])

  // 悬浮窗"查看详情"点击 — 抓详情 → 存 localStorage → 跳 JobDetail
  const onJobDetail = async (jobId: number) => {
    try {
      const d = await kgApi.jobDetail(jobId)
      // 转换为 JobDetail 期望的格式
      const salaryStr = d.salary_min && d.salary_max
        ? `${Math.round(d.salary_min / 1000)}K-${Math.round(d.salary_max / 1000)}K`
        : '面议'
      const detailObj = {
        id: d.id,
        title: d.title,
        company: d.company_name || '未知',
        salary: salaryStr,
        location: d.city || '',
        experience: d.experience,
        education: d.education,
        skills: d.skill_tags || [],
        description: d.job_description,
      }
      localStorage.setItem('jt_job_detail', JSON.stringify(detailObj))
      setPage('job-detail')
    } catch (e) {
      console.error('[JobGraphPage] 加载岗位详情失败:', e)
    }
  }

  // 来源筛选影响图数据
  const filteredData = useMemo(() => {
    if (activeSources.size === 0) return graphData
    const allowed = new Set<string>()
    const allowedJobs = new Set<string>()
    graphData.nodes.forEach((n) => {
      if (n.type !== 'Job' || (n.source && activeSources.has(n.source))) {
        allowed.add(n.id)
        if (n.type === 'Job') allowedJobs.add(n.id)
      }
    })
    // Skill 通过 Job-requires 间接决定
    graphData.links.forEach((l) => {
      if (allowedJobs.has(l.source)) {
        allowed.add(l.target)
      }
    })
    return {
      nodes: graphData.nodes.filter((n) => allowed.has(n.id)),
      links: graphData.links.filter((l) => allowed.has(l.source) && allowed.has(l.target)),
    }
  }, [graphData, activeSources])

  const onPick = (jobId: number) => {
    // 与 API 返回的节点 id 格式一致(小写 "job:123")
    setSelectedId(`job:${jobId}`)
  }

  const selectedJobId = selectedId?.toLowerCase().startsWith('job:')
    ? Number(selectedId.split(':')[1])
    : undefined

  return (
    <div className="flex flex-col h-full w-full" style={{ background: 'var(--color-background)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0"
           style={{ borderColor: 'var(--color-outline-variant)', background: 'var(--color-surface)' }}>
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <span className="font-bold">岗位图谱</span>
          <div className="flex items-center gap-2 text-xs ml-3"
               style={{ color: 'var(--color-on-surface-variant)' }}>
            <span>岗位 {overview.jobs || 0}</span>
            <span>·</span>
            <span>快照 {overview.snapshots || 0}</span>
            <span>·</span>
            <span>变化 {overview.changes || 0}</span>
            <span>·</span>
            <span>技能 {overview.skills || 0}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SemanticSearchBox onPick={onPick} />
          <SourceFilter sources={sources} active={activeSources} onChange={setActiveSources} />
        </div>
      </div>

      {/* 三栏 */}
      <div className="flex flex-1 min-h-0">
        {/* 左 */}
        <aside className="w-[260px] shrink-0 border-r overflow-hidden flex flex-col"
               style={{ borderColor: 'var(--color-outline-variant)' }}>
          <NodeListPanel
            nodes={filteredData.nodes}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>

        {/* 中 */}
        <main className="flex-1 flex flex-col min-w-0 relative">
          <div className="flex-1 relative min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full text-sm">加载图谱...</div>
            ) : (
              <JobGraphCanvas
                data={filteredData}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onJobDetail={onJobDetail}
              />
            )}
          </div>

          {/* 右下角:演化时间轴(收紧,完整展示不滚动) */}
          <div className="h-[210px] border-t shrink-0" style={{ borderColor: 'var(--color-outline-variant)' }}>
            <JobEvolutionTimeline
              jobId={selectedJobId}
              height={170}
              onChangePointClick={(cid) => {
                // 变化点已通过 JobGraphCanvas 悬浮窗和"查看详情"承载,这里不再展开
                console.log('[JobGraphPage] 点击变化点:', cid)
              }}
            />
          </div>
        </main>

        {/* 右 */}
        <aside className="w-[380px] shrink-0 border-l" style={{ borderColor: 'var(--color-outline-variant)' }}>
          <KGChat selectedJobId={selectedJobId} onJobPick={onPick} />
        </aside>
      </div>

      {/* StatusBar */}
      <div className="h-6 px-4 flex items-center justify-between text-[10px] border-t shrink-0"
           style={{ borderColor: 'var(--color-outline-variant)', color: 'var(--color-on-surface-variant)' }}>
        <div>
          {selectedId
            ? `当前选中: ${selectedId}`
            : '悬浮看详情 · 点击节点聚焦 · 点击空白退出'}
        </div>
        <div>
          {overview.attributed || 0} / {overview.changes || 0} 变化已归因 ·
          {overview.pending_changes || 0} 待归因
        </div>
      </div>
    </div>
  )
}