import { createContext, useContext } from 'react'

export type JSPage =
  | 'dashboard' | 'skill-graph' | 'resume' | 'resume-center' | 'match' | 'job-detail' | 'diagnosis' | 'learning'
  | 'trend' | 'profile-home' | 'my-skill-graph' | 'quality'

const NavContext = createContext<{
  setPage: (p: JSPage) => void
  page: JSPage
}>({ setPage: () => {}, page: 'dashboard' })

export const JSNav = {
  Provider: NavContext.Provider,
  use() { return useContext(NavContext) },
}

// 企业端导航
export type EPPage = 'dashboard' | 'jobs' | 'talent' | 'market' | 'industry' | 'company' | 'messages'

// 导航参数 — 用于页面间传递上下文
export interface EPNavParams {
  selectedJobId?: number    // 跳转到岗位管理时锚定某个岗位
  filterJobId?: number      // 跳转到人才星时按岗位筛选
  activeTab?: string        // 激活的子 tab
  autoCompare?: boolean     // 跳转到人才星时自动对比该岗位候选人
}

const EPNavContext = createContext<{
  setPage: (p: EPPage, params?: EPNavParams) => void
  page: EPPage
  params: EPNavParams
}>({ setPage: () => {}, page: 'dashboard', params: {} })

export const EPNav = {
  Provider: EPNavContext.Provider,
  use() { return useContext(EPNavContext) },
}