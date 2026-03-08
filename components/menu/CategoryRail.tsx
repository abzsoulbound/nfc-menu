"use client"

import { useEffect, useMemo, useState } from "react"

type CategorySection = {
  id: string
  label: string
}

function idFromHash(hash: string) {
  if (!hash) return ""
  return hash.startsWith("#") ? hash.slice(1) : hash
}

export function CategoryRail({
  sections,
  className = "",
}: {
  sections: CategorySection[]
  className?: string
}) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "")

  const sectionKey = useMemo(
    () => sections.map(section => section.id).join("|"),
    [sections]
  )

  useEffect(() => {
    const sectionIds = sectionKey ? sectionKey.split("|") : []
    if (sectionIds.length === 0) return
    setActiveId(sectionIds[0])

    const handleHash = () => {
      const hashId = idFromHash(window.location.hash)
      if (hashId) {
        setActiveId(hashId)
      }
    }

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top) -
              Math.abs(b.boundingClientRect.top)
          )

        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id)
        }
      },
      {
        threshold: [0.1, 0.25, 0.5, 0.75],
        rootMargin: "-35% 0px -45% 0px",
      }
    )

    for (const sectionId of sectionIds) {
      const node = document.getElementById(sectionId)
      if (node) observer.observe(node)
    }

    handleHash()
    window.addEventListener("hashchange", handleHash)

    return () => {
      window.removeEventListener("hashchange", handleHash)
      observer.disconnect()
    }
  }, [sectionKey])

  if (sections.length === 0) return null

  return (
    <nav
      className={`overflow-hidden rounded-2xl border border-[var(--border-subtle)] surface-secondary p-3 backdrop-blur ${className}`}
      aria-label="Menu sections"
    >
      <div className="scroll-fade-x flex gap-2.5 overflow-x-auto pb-1">
        {sections.map(section => {
          const active = section.id === activeId

          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={() => setActiveId(section.id)}
              className={`action-surface whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                active
                  ? ""
                  : "action-surface-muted hover:-translate-y-px"
              }`}
            >
              {section.label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
