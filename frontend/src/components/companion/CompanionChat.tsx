import CareerChat from './CareerChat'
import CompanionGeneralChat from './CompanionGeneralChat'
export default function CompanionChat({ active }: { active: boolean }) {
  if (localStorage.getItem('xingtu_role')!=='jobseeker') return <CompanionGeneralChat active={active}/>
  return <div className="h-[420px] max-h-[65vh]"><CareerChat compact active={active}/></div>
}
