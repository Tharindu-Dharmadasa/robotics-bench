// A fake serial monitor. The engine says WHAT to print (getSerialScript); this component adds the TIMING:
// it prints one line at a time, with a timestamp, and loops while a sketch is running.
import {useEffect, useRef, useState} from 'react';
import {useBenchStore, useCurrentBoard} from '../store/benchStore';
import {getSerialScript} from '../engine/serialScript';

const MAX_VISIBLE_LINES = 9;
const SECONDS_BETWEEN_LINES = 0.9;

export function SerialMonitor() {
  const {board, boardState} = useCurrentBoard();
  const {uploadedBoardIds, uploadProgress} = useBenchStore();
  const script = getSerialScript(board, boardState, uploadedBoardIds.includes(board.id));
  const [lines, setLines] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  // Restart the output whenever the script changes (new board, new status, upload finished).
  const scriptKey = `${board.id}|${script.repeats}|${script.lines.join('|')}`;
  useEffect(() => {
    setLines([]);
    const startedAt = Date.now();
    let nextIndex = 0;
    const printNextLine = () => {
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1).padStart(5, '0');
      const text = script.lines[nextIndex % script.lines.length];
      nextIndex++;
      setLines((previous) => [...previous.slice(-(MAX_VISIBLE_LINES - 1)), `[${seconds}] ${text}`]);
    };
    printNextLine();
    if (!script.repeats) return;
    const timer = setInterval(printNextLine, SECONDS_BETWEEN_LINES * 1000);
    return () => clearInterval(timer); // stop the loop when the script changes or the component unmounts
  }, [scriptKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { scroller.current?.scrollTo({top: scroller.current.scrollHeight}); }, [lines]); // keep the newest line in view

  const shownLines = uploadProgress !== null
    ? ['Compiling sketch…', `Uploading… ${Math.round(uploadProgress * 100)}%`]
    : lines;

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
      <h3 className="mb-2 text-xs uppercase tracking-widest text-[var(--accent)]">Serial monitor</h3>
      <div ref={scroller} aria-live="polite" className="h-56 overflow-y-auto rounded-md bg-[#14181f] p-3 font-mono text-xs leading-relaxed">
        {shownLines.map((line, index) => (
          <div key={index} className={line.includes('!!') ? 'text-[#ff8a80]' : 'text-[#9be7a8]'}>{line}</div>
        ))}
      </div>
    </section>
  );
}
