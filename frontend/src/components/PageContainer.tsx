import React from 'react'

interface Props {
  children: React.ReactNode
  title: string
}

export default function PageContainer({ children, title }: Props) {
  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      <h1 className="text-xl font-bold mb-6">{title}</h1>
      {children}
    </div>
  )
}
