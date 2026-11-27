import { BOARDS } from "../data/boards";

interface SidebarProps {
  board: number;
  onSelect: (index: number) => void;
 
}

export default function Sidebar({
  board,
  onSelect,
  
}: SidebarProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[#222]" style={{ backgroundColor: "#EAE6DF" }}>
      <div className="border-b border-[#222] p-4" style={{ backgroundColor: "#EAE6DF" }}>
        <h1 className="text-lg font-bold">Robotics Bench</h1>
        <p className="mt-1 text-xs leading-snug text-[#555]">
          Real boards you can build, power up and break.
        </p>
        
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {BOARDS.map(([n, s], i) => (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`mb-1 w-full rounded-md px-3 py-2 text-left transition ${board === i ? "bg-[#222] text-[#EAE6DF]" : "hover:bg-[#dcd6cb]"}`}
          >
            <div className="text-[10px] opacity-60">Fig. {String(i + 1).padStart(2, "0")}</div>
            <div className="text-sm font-bold">{n}</div>
            <div className="text-[10px] opacity-60">{s}</div>
          </button>
        ))}
      </div>
    </aside>
  );
}
