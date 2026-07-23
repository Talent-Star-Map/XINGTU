import { createContext, useContext } from 'react'

export type JSPage =
  | 'dashboard' | 'skill-graph' | 'resume' | 'match' | 'job-detail' | 'diagnosis' | 'learning'
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
export type EPPage = 'dashboard' | 'jobs' | 'talent' | 'market' | 'industry' | 'company'

const EPNavContext = createContext<{
  setPage: (p: EPPage) => void
  page: EPPage
}>({ setPage: () => {}, page: 'dashboard' })

export const EPNav = {
  Provider: EPNavContext.Provider,
  use() { return useContext(EPNavContext) },
}
