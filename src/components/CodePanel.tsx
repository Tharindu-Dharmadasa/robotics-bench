// "Try it yourself": the example Arduino code for this board, plus the Upload button.
// Uploading is simulated (a progress bar), and it needs the board to be powered, like a real USB upload.
import {motion} from 'framer-motion';
import {useState} from 'react';
import {useBenchStore, useCurrentBoard} from '../store/benchStore';

export function CodePanel() {
  const {board, boardState} = useCurrentBoard();
  const {uploadedBoardIds, uploadProgress, uploadSketch} = useBenchStore();
  const [justCopied, setJustCopied] = useState(false);
  const isUploaded = uploadedBoardIds.includes(board.id);
  const isUploading = uploadProgress !== null;
  const hasPower = boardState.isPowered && boardState.lastResult?.status !== 'DEAD';

  const copyCode = async () => {
    await navigator.clipboard.writeText(board.sketch ?? '');
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 1500);
  };

  return (
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs uppercase tracking-widest text-[var(--accent)]">Try it yourself</h3>
        {board.sketch && (
          <div className="flex items-center gap-2 text-xs">
            <button onClick={copyCode} className="rounded border border-[var(--line)] px-2 py-1">{justCopied ? 'Copied' : 'Copy'}</button>
            <motion.button whileTap={{scale: 0.95}} onClick={uploadSketch} disabled={!hasPower || isUploading}
              title={hasPower ? 'Upload the sketch to the board' : 'Plug in USB first'}
              className="rounded border-[1.5px] border-[var(--ink)] px-3 py-1 font-semibold disabled:opacity-40">
              {isUploading ? 'Uploading…' : isUploaded ? 'Upload again' : 'Upload sketch'}
            </motion.button>
          </div>
        )}
      </div>

      {board.sketch ? (<>
        {/* Progress bar: only visible while uploading. */}
        {isUploading && <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--line)]"><motion.div className="h-full bg-[var(--accent)]" animate={{width: `${(uploadProgress ?? 0) * 100}%`}} /></div>}
        <pre className="max-h-64 overflow-auto rounded-md bg-[#14181f] p-3 text-xs leading-relaxed text-[#e8e4d8]">{board.sketch}</pre>
        <p className="mt-2 text-xs opacity-70">{isUploaded ? 'Sketch uploaded. It stays on the board until you reset it.' : hasPower ? 'Ready to upload.' : 'Plug in USB to enable uploading.'}</p>
      </>) : (
        <p className="text-sm opacity-70">No code here: this is a pure analog circuit with no microcontroller. Move on to the Arduino to see code run.</p>
      )}
    </section>
  );
}
