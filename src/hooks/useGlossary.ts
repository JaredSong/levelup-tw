import { useEffect, useState } from 'react'

export interface GlossaryEntry {
  term: string
  pinyin: string
  en: string
  cue: string
  aliases: string[]
  kind: 'exam' | 'term'
  sections: string[]
  qids: string[]
}

export function useGlossary() {
  const [glossary, setGlossary] = useState<GlossaryEntry[]>([])

  useEffect(() => {
    void fetch('/data/glossary.json')
      .then((response) => (response.ok ? response.json() as Promise<GlossaryEntry[]> : []))
      .then(setGlossary)
      .catch(() => setGlossary([]))
  }, [])

  return glossary
}
