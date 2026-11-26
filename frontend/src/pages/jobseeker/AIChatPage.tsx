import CareerChat from '../../components/companion/CareerChat'
import { JSNav } from '../../lib/NavContext'
export default function AIChatPage() {
  const {page}=JSNav.use()
  return <div className="flex h-full min-h-0 flex-col" style={{background:'var(--color-background)'}}>
    <CareerChat active={page==='ai-chat'}/>
  </div>
}
