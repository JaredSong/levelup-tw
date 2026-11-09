// Small motion helpers for the public pages (landing, /exams/, /guide/). Each
// one is a progressive enhancement: the prerendered HTML already shows the
// final state, and prefers-reduced-motion keeps it that way.
//
// Patterns and timings are named after common motion patterns:
// number-counter, velocity-marquee, scroll-spy-dots, timeline-draw.
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** cubic-bezier(x1, y1, x2, y2) solved for y at time t (0–1). */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const x = (s: number) => ((ax * s + bx) * s + cx) * s
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx
  return (t: number) => {
    let s = t
    for (let i = 0; i < 6; i += 1) {
      const d = dx(s)
      if (Math.abs(d) < 1e-6) break
      s -= (x(s) - t) / d
    }
    s = Math.min(1, Math.max(0, s))
    return ((ay * s + by) * s + cy) * s
  }
}
const easeOut = bezier(0.2, 0.8, 0.2, 1)

/**
 * number-counter: counts 0 → target once, the first time `ref` scrolls into
 * view (1400 ms, ease-out). Returns the value to render. Server render and
 * reduced motion get the final value.
 */
export function useCountUp(target: number, ref: RefObject<Element | null>, duration = 1400): number {
  const [value, setValue] = useState(target)
  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || !('IntersectionObserver' in window)) return
    let frame = 0
    setValue(0)
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      const start = performance.now() + 200
      const tick = (now: number) => {
        const p = Math.min(1, Math.max(0, (now - start) / duration))
        setValue(Math.round(target * easeOut(p)))
        if (p < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      setValue(target)
    }
  }, [target, ref, duration])
  return value
}

/**
 * velocity-marquee, calm version: a native horizontal scroller drifts slowly on
 * its own. The row holds its items twice (the second set marked
 * data-clone) so it can wrap without a seam. Drift pauses on hover, focus,
 * touch, wheel and while off-screen; the visitor can always scroll or swipe.
 *
 * Returns `wrap(direction)`, which the arrow buttons call before scrolling so a
 * step back from the first card lands on the clone set instead of a hard stop.
 */
export function useAutoDrift(ref: RefObject<HTMLElement | null>, enabled: boolean, speed = 24) {
  const spanRef = useRef(0)
  const holdRef = useRef(0)

  useEffect(() => {
    const row = ref.current
    if (!row || !enabled) return
    const measure = () => {
      const first = row.firstElementChild as HTMLElement | null
      const clone = row.querySelector<HTMLElement>('[data-clone]')
      spanRef.current = first && clone ? clone.offsetLeft - first.offsetLeft : 0
    }
    measure()
    const resize = new ResizeObserver(measure)
    resize.observe(row)

    let hovered = false
    let focused = false
    let visible = false
    let pos = row.scrollLeft
    let last = performance.now()
    let frame = 0

    const hold = (ms: number) => { holdRef.current = performance.now() + ms }
    const onEnter = () => { hovered = true }
    const onLeave = () => { hovered = false; hold(600) }
    const onFocusIn = () => { focused = true }
    const onFocusOut = () => { focused = false }
    const onTouch = () => hold(3500)
    const onWheel = () => hold(2500)
    const onScroll = () => {
      // Hand-scrolled to the very end of the clone set: step back one set.
      const span = spanRef.current
      if (span > 0 && row.scrollLeft >= row.scrollWidth - row.clientWidth - 2) row.scrollLeft -= span
      // A user scroll moves us away from our own position: follow it.
      if (Math.abs(row.scrollLeft - pos) > 2) pos = row.scrollLeft
    }
    row.addEventListener('pointerenter', onEnter)
    row.addEventListener('pointerleave', onLeave)
    row.addEventListener('focusin', onFocusIn)
    row.addEventListener('focusout', onFocusOut)
    row.addEventListener('touchstart', onTouch, { passive: true })
    row.addEventListener('wheel', onWheel, { passive: true })
    row.addEventListener('scroll', onScroll, { passive: true })
    const io = new IntersectionObserver((entries) => { visible = entries.some((entry) => entry.isIntersecting) })
    io.observe(row)

    const tick = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      const running = visible && !hovered && !focused && now > holdRef.current && !document.hidden
      if (running && spanRef.current > 0) {
        pos += (speed * dt) / 1000
        if (pos >= spanRef.current) pos -= spanRef.current
        row.scrollLeft = pos
      } else {
        pos = row.scrollLeft
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      io.disconnect()
      row.removeEventListener('pointerenter', onEnter)
      row.removeEventListener('pointerleave', onLeave)
      row.removeEventListener('focusin', onFocusIn)
      row.removeEventListener('focusout', onFocusOut)
      row.removeEventListener('touchstart', onTouch)
      row.removeEventListener('wheel', onWheel)
      row.removeEventListener('scroll', onScroll)
    }
  }, [ref, enabled, speed])

  /**
   * Call before an arrow-button scroll: holds the drift so it doesn't fight the
   * smooth scroll, and before a step back from near the start jumps forward one
   * set (invisible: the clone set shows the same cards).
   */
  return (direction: 1 | -1) => {
    holdRef.current = performance.now() + 1800
    const row = ref.current
    const span = spanRef.current
    if (!row || span <= 0) return
    if (direction < 0 && row.scrollLeft < row.clientWidth) row.scrollLeft += span
  }
}

/** Adds `is-in` to every `[data-reveal]` under `root` once it scrolls into view. */
export function useReveal(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current
    if (!el || !('IntersectionObserver' in window)) return
    const targets = el.querySelectorAll('[data-reveal]')
    if (prefersReducedMotion()) {
      targets.forEach((target) => target.classList.add('is-in'))
      return
    }
    targets.forEach((target) => target.classList.add('will-reveal'))
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('is-in')
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 })
    targets.forEach((target) => observer.observe(target))
    return () => observer.disconnect()
  }, [root])
}

/** scroll-spy: id of the section that holds the window's middle line. */
export function useScrollSpy(ids: string[]): string {
  const [active, setActive] = useState(ids[0] ?? '')
  const key = ids.join('|')
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const sections = key.split('|').map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el))
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id)
    }, { rootMargin: '-50% 0px -50% 0px' })
    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [key])
  return active
}
