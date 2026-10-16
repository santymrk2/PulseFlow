// ----- FreeShow -----
// Render de letra con acordes (vista de músicos). Coloca cada acorde sobre la
// letra en la posición marcada por ChordPro (`[Am]`), permitiendo transponer.

import { buildSegments, type ChordLine } from "@/lib/chordpro"

export default function ChordLyrics({
    lines,
    semitones = 0,
    className,
}: {
    lines: ChordLine[]
    semitones?: number
    className?: string
}) {
    return (
        <div className={className}>
            {lines.map((line, index) => (
                <div key={index} className="pt-4 leading-snug">
                    {buildSegments(line, semitones).map((segment, segmentIndex) => (
                        <span key={segmentIndex} className="relative inline whitespace-pre-wrap">
                            {segment.chord && (
                                <span className="absolute -top-3.5 left-0 font-mono text-[11px] font-semibold text-amber-400">
                                    {segment.chord}
                                </span>
                            )}
                            {segment.text}
                        </span>
                    ))}
                    {line.text.length === 0 && <span className="inline-block h-4" />}
                </div>
            ))}
        </div>
    )
}
