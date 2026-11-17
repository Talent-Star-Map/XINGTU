import './BrandLogo.css'

export default function BrandLogo({ variant = 'lockup', className = '' }: {
  variant?: 'lockup' | 'mark'
  className?: string
}) {
  return (
    <span className={`xingtu-brand xingtu-brand--${variant} ${className}`} role="img" aria-label="星图 XINGTU">
      <img className="xingtu-brand__light" src={`/brand/xingtu-${variant}-light.svg`} alt="" aria-hidden="true" />
      <img className="xingtu-brand__dark" src={`/brand/xingtu-${variant}-dark.svg`} alt="" aria-hidden="true" />
    </span>
  )
}
