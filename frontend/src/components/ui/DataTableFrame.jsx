import { useEffect, useRef, useState } from 'react'
import { cn } from './cn'

export default function DataTableFrame({ className, children }) {
  const scrollRef = useRef(null)
  const [canScrollUp, setCanScrollUp] = useState(false)
  const [isScrollable, setIsScrollable] = useState(false)

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return

    const updateScrollState = () => {
      setIsScrollable(node.scrollHeight > node.clientHeight)
      setCanScrollUp(node.scrollTop > 12 && node.scrollHeight > node.clientHeight)
    }

    updateScrollState()
    node.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState)

    return () => {
      node.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [children])

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface">
      <div
        ref={scrollRef}
        className={cn(
          'overflow-x-auto [&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10 [&_thead_th]:bg-surface-muted',
          className,
        )}
      >
        {children}
      </div>
      {isScrollable && canScrollUp ? (
        <button
          type="button"
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="pointer-events-none absolute bottom-3 right-3 rounded-full border border-border-strong bg-surface-muted p-2 text-text-primary opacity-0 shadow-soft transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
          aria-label="Move table to top"
          title="Move to top"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M12 19V5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M6 11l6-6 6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
