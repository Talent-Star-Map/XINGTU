/**
 * SkillCard — 已掌握技能卡片
 *
 * 视觉(图示):
 *  - 圆角白卡 + 灰色描边
 *  - 顶部:devicon 灰色剪影图标
 *  - 中部:技能名
 *  - 底部:品牌色进度条(根据技能名 hash 得到稳定 mastery 百分比)
 *
 * 数据:
 *  - 通过 normalizeSkill 把 "Java" / "java" / "JAVA" 等归一化成小写无空格键
 *  - 命中 SKILL_META → 用对应 devicon + 品牌色
 *  - 未命中 → 用 lucide Code 图标 + 类别色
 */
import { Code } from 'lucide-react'
import type { CSSProperties } from 'react'

// devicon slug + 品牌色;支持常见别名
const SKILL_META: Record<string, { slug: string; color: string }> = {
  python:       { slug: 'python',       color: '#3776ab' },
  java:         { slug: 'java',         color: '#f89820' },
  javascript:   { slug: 'javascript',   color: '#f7df1e' },
  js:           { slug: 'javascript',   color: '#f7df1e' },
  typescript:   { slug: 'typescript',   color: '#3178c6' },
  ts:           { slug: 'typescript',   color: '#3178c6' },
  csharp:       { slug: 'csharp',       color: '#239120' },
  c:            { slug: 'c',            color: '#a8b9cc' },
  cpp:          { slug: 'cplusplus',    color: '#00599c' },
  cplusplus:    { slug: 'cplusplus',    color: '#00599c' },
  go:           { slug: 'go',           color: '#00add8' },
  golang:       { slug: 'go',           color: '#00add8' },
  rust:         { slug: 'rust',         color: '#dea584' },
  ruby:         { slug: 'ruby',         color: '#cc342d' },
  php:          { slug: 'php',          color: '#777bb4' },
  scala:        { slug: 'scala',        color: '#dc322f' },
  kotlin:       { slug: 'kotlin',       color: '#7f52ff' },
  swift:        { slug: 'swift',        color: '#fa7343' },
  dart:         { slug: 'dart',         color: '#0175c2' },
  elixir:       { slug: 'elixir',       color: '#4b275f' },
  erlang:       { slug: 'erlang',       color: '#a90533' },

  react:        { slug: 'react',        color: '#61dafb' },
  reactjs:      { slug: 'react',        color: '#61dafb' },
  vue:          { slug: 'vuejs',        color: '#4fc08d' },
  vuejs:        { slug: 'vuejs',        color: '#4fc08d' },
  angular:      { slug: 'angularjs',    color: '#dd0031' },
  angularjs:    { slug: 'angularjs',    color: '#dd0031' },
  svelte:       { slug: 'svelte',       color: '#ff3e00' },
  nextjs:       { slug: 'nextjs',       color: '#000000' },
  nuxtjs:       { slug: 'nuxtjs',       color: '#00dc82' },
  nuxt:         { slug: 'nuxtjs',       color: '#00dc82' },

  nodejs:       { slug: 'nodejs',       color: '#339933' },
  node:         { slug: 'nodejs',       color: '#339933' },
  express:      { slug: 'express',      color: '#000000' },
  nestjs:       { slug: 'nestjs',       color: '#e0234e' },
  django:       { slug: 'django',       color: '#092e20' },
  flask:        { slug: 'flask',        color: '#000000' },
  fastapi:      { slug: 'fastapi',      color: '#009688' },
  spring:       { slug: 'spring',       color: '#6db33f' },
  springboot:   { slug: 'spring',       color: '#6db33f' },
  laravel:      { slug: 'laravel',      color: '#ff2d20' },
  rails:        { slug: 'rails',        color: '#cc0000' },

  mongodb:      { slug: 'mongodb',      color: '#47a248' },
  mongo:        { slug: 'mongodb',      color: '#47a248' },
  mysql:        { slug: 'mysql',        color: '#4479a1' },
  postgresql:   { slug: 'postgresql',   color: '#336791' },
  postgres:     { slug: 'postgresql',   color: '#336791' },
  redis:        { slug: 'redis',        color: '#dc382d' },
  elasticsearch:{ slug: 'elasticsearch',color: '#005571' },
  cassandra:    { slug: 'cassandra',    color: '#1287b1' },
  sqlite:       { slug: 'sqlite',       color: '#003b57' },

  docker:       { slug: 'docker',       color: '#2496ed' },
  kubernetes:   { slug: 'kubernetes',   color: '#326ce5' },
  k8s:          { slug: 'kubernetes',   color: '#326ce5' },
  nginx:        { slug: 'nginx',        color: '#009639' },
  apache:       { slug: 'apache',       color: '#d22128' },
  jenkins:      { slug: 'jenkins',      color: '#d24939' },
  ansible:      { slug: 'ansible',      color: '#ee0000' },
  terraform:    { slug: 'terraform',    color: '#623ce4' },
  prometheus:   { slug: 'prometheus',   color: '#e6522c' },
  grafana:      { slug: 'grafana',      color: '#f46800' },

  tensorflow:   { slug: 'tensorflow',   color: '#ff6f00' },
  tf:           { slug: 'tensorflow',   color: '#ff6f00' },
  pytorch:      { slug: 'pytorch',      color: '#ee4c2c' },
  hadoop:       { slug: 'hadoop',       color: '#fdb927' },
  spark:        { slug: 'apache',       color: '#e25a1c' },
  pandas:       { slug: 'pandas',       color: '#150458' },
  numpy:        { slug: 'numpy',        color: '#013243' },
  scikit:       { slug: 'scikitlearn',  color: '#f89939' },
  sklearn:      { slug: 'scikitlearn',  color: '#f89939' },
  keras:        { slug: 'keras',        color: '#d00000' },
  opencv:       { slug: 'opencv',       color: '#5c3a26' },
  jupyter:      { slug: 'jupyter',      color: '#f37726' },
  langchain:    { slug: 'python',       color: '#1c3c3c' },
  openai:       { slug: 'openai',       color: '#10a37f' },
  huggingface:  { slug: 'huggingface',  color: '#ff9a00' },

  android:      { slug: 'android',      color: '#3ddc84' },
  ios:          { slug: 'apple',        color: '#999999' },
  flutter:      { slug: 'flutter',      color: '#02569b' },
  reactnative:  { slug: 'reactnative',  color: '#61dafb' },

  git:          { slug: 'git',          color: '#f05033' },
  github:       { slug: 'github',       color: '#181717' },
  gitlab:       { slug: 'gitlab',       color: '#fca326' },
  linux:        { slug: 'linux',        color: '#fcc624' },
  bash:         { slug: 'bash',         color: '#4eaa25' },
  vscode:       { slug: 'vscode',       color: '#007acc' },

  figma:        { slug: 'figma',        color: '#f24e1e' },
  sketch:       { slug: 'sketch',       color: '#fdb300' },
  photoshop:    { slug: 'photoshop',    color: '#31a8ff' },
  illustrator:  { slug: 'illustrator',  color: '#ff9a00' },
}

// 类别配色(兜底)
const FALLBACK_PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#eab308',
  '#06b6d4', '#f43f5e', '#8b5cf6',
]

function normalize(skill: string): string {
  return skill.toLowerCase().replace(/[\s.\-_/]/g, '')
}

function getMeta(skill: string) {
  const key = normalize(skill)
  return SKILL_META[key]
}

// 稳定的 mastery 百分比(70-100),根据技能名 hash
function masteryOf(skill: string): number {
  let h = 0
  for (let i = 0; i < skill.length; i++) h = (h * 31 + skill.charCodeAt(i)) | 0
  return 70 + (Math.abs(h) % 31)
}

function fallbackColor(skill: string): string {
  let h = 0
  for (let i = 0; i < skill.length; i++) h = (h * 17 + skill.charCodeAt(i)) | 0
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length]
}

// ── 单个技能卡片 ──
export function SkillCard({ skill, index = 0 }: { skill: string; index?: number }) {
  const meta = getMeta(skill)
  const color = meta?.color ?? fallbackColor(skill)
  const slug = meta?.slug
  const mastery = masteryOf(skill)

  // 图标缩小:56 → 36;保留 devicon 品牌色(去 grayscale,加透明度让背景卡片透出)
  const iconStyle: CSSProperties = {
    width: 36,
    height: 36,
    opacity: 0.9,
    objectFit: 'contain',
  }

  // 进度条进入动画:从 0% 增长到 mastery%,逐个 stagger
  // 单卡动画时长 1.1s,每张延迟 60ms,最多叠加 ~1s 后全部到位
  const animDelay = Math.min(index, 18) * 60

  return (
    <div
      className="rounded-2xl border p-3 flex flex-col items-center"
      style={{
        borderColor: 'var(--color-outline-variant)',
        background: 'var(--color-surface)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div className="h-10 flex items-center justify-center mb-2">
        {slug ? (
          <img
            src={`https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${slug}/${slug}-original.svg`}
            alt={skill}
            style={iconStyle}
            loading="lazy"
            onError={(e) => {
              // 找不到 logo 时退化为 lucide Code 图标
              const target = e.currentTarget
              target.style.display = 'none'
              const parent = target.parentElement
              if (parent && !parent.querySelector('.skill-fallback-icon')) {
                const span = document.createElement('span')
                span.className = 'skill-fallback-icon'
                span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`
                parent.appendChild(span)
              }
            }}
          />
        ) : (
          <Code style={{ width: 32, height: 32, color: '#94a3b8' }} strokeWidth={1.5} />
        )}
      </div>
      <p
        className="text-sm font-semibold mb-2.5 truncate w-full text-center"
        style={{ color: 'var(--color-on-surface)' }}
      >
        {skill}
      </p>
      <div
        className="w-full h-1.5 rounded-full overflow-hidden"
        style={{ background: 'var(--color-surface-container-high)' }}
      >
        <div
          className="h-full rounded-full skill-card-bar"
          style={{
            // 用 CSS 变量把目标宽度传给 @keyframes(--bar-target 默认就是 mastery%)
            ['--bar-target' as any]: `${mastery}%`,
            width: `${mastery}%`,
            background: color,
            animationDelay: `${animDelay}ms`,
          }}
        />
      </div>
    </div>
  )
}

// ── 卡片网格 ──
export function SkillCardGrid({ skills }: { skills: string[] }) {
  return (
    <>
      {/* 进度条入场动画:从 0 长到目标宽度 */}
      <style>{`
        @keyframes skillCardBarGrow {
          from { width: 0%; }
          to { width: var(--bar-target); }
        }
        .skill-card-bar {
          width: 0%;
          animation: skillCardBarGrow 1.1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))' }}
      >
        {skills.map((s, i) => (
          <SkillCard key={s} skill={s} index={i} />
        ))}
      </div>
    </>
  )
}