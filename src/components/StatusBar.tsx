// Top-right readout: status, parts placed, joints left to solder, current draw.
import {motion} from 'framer-motion';
import {useCurrentBoard} from '../store/benchStore';
import {getBoardStatus} from '../engine/boardStatus';

export function StatusBar() {
  const {board, boardState} = useCurrentBoard();
  const status = getBoardStatus(board, boardState);
  const jointsLeftToSolder = boardState.placedPartIds.length - boardState.solderedPartIds.length;
  const statusColor = status === 'RUNNING' ? 'var(--ok)' : status === 'FAULT' || status === 'DEAD' ? 'var(--bad)' : 'var(--ink)';

  const readouts: [label: string, value: string | number, color?: string][] = [
    ['STATUS', status, statusColor],
    ['PARTS', `${boardState.placedPartIds.length}/${board.parts.length}`],
    ['TO SOLDER', jointsLeftToSolder],
    ['CURRENT', `${boardState.lastResult?.currentMilliamps ?? 0} mA`],
  ];

  return (
    <div className="flex gap-5 text-right">
      {readouts.map(([label, value, color]) => (
        <div key={label}>
          <small className="block text-[10px] tracking-widest opacity-60">{label}</small>
          {/* Changing `key` remounts the element, so the "pop in" animation replays on every value change. */}
          <motion.b key={String(value)} initial={{scale: 0.75, opacity: 0}} animate={{scale: 1, opacity: 1}} className="inline-block" style={{color}}>{value}</motion.b>
        </div>
      ))}
    </div>
  );
}
