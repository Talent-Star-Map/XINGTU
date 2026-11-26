import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PetSprite } from '../components/companion/XiaoguiPet'
import { PET_LABELS, type PetAction } from '../lib/companion'

const ACTIONS: PetAction[] = ['idle', 'wave', 'walk', 'eat', 'sleep']

export default function CompanionRoom() {
  const [action, setAction] = useState<PetAction>('idle')
  return <main className="companion-room">
    <nav className="companion-room-nav"><strong>星图 XINGTU</strong><Link to="/">回到星图</Link></nav>
    <section className="companion-room-hero">
      <div>
        <span className="companion-room-eyebrow">XINGTU · YOUR LITTLE COMPANION</span>
        <h1>让探索的每一步，<br />都有星图陪你。</h1>
        <p className="companion-room-copy">银紫色卷发，装满星星的小口袋。会打招呼、会认真吃饭，也会在你身边偷偷打个盹。</p>
        <div className="companion-room-actions">{ACTIONS.map(item => <button key={item} aria-pressed={action === item} onClick={() => setAction(item)}>{PET_LABELS[item]}</button>)}</div>
        <span className="companion-room-tag">试着点击或拖动小星</span>
      </div>
      <div className="companion-stage"><PetSprite action={action} /><span className="companion-stage-label">小星 · {PET_LABELS[action]}</span></div>
    </section>
    <section className="companion-room-gallery">
      <h2>小小日常，都有回应。</h2>
      <p>点击小星打开聊天或互动面板；拖动换位置，选择大小，或收起让她安静待着。打招呼、吃饭、睡觉和散步都会自然衔接。</p>
      <div className="companion-gallery-grid">{ACTIONS.map(item => <button key={item} onClick={() => setAction(item)} aria-pressed={action === item}><PetSprite action={item} animated={false} /><span>{PET_LABELS[item]}</span></button>)}</div>
    </section>
  </main>
}
