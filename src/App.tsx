import {AnimatePresence,motion} from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import {BOARDS} from './data/boards';
import {useBench,useCurrent,deriveStatus} from './store/bench';
import {Stage} from './components/Stage';
const Btn=({children,...p}:React.ComponentProps<typeof motion.button>)=>(
 <motion.button whileHover={{y:-2}} whileTap={{scale:.95}} className="rounded-md border-[1.5px] border-[var(--ink)] bg-[var(--surf)] px-3 py-2 disabled:opacity-40" {...p}>{children}</motion.button>);
export default function App(){
 const st=useBench();const {board:b,bs}=useCurrent();
 const status=deriveStatus(b,bs),uns=bs.placed.length-bs.soldered.length;
 const msg=bs.powered&&bs.res?bs.res.msg:bs.placed.length<b.parts.length?'Click part names, or the parts themselves, to place them on the board.':uns?'Solder the joints, then plug in USB.':'All soldered. Plug in USB to power the board.';
 const tone=status==='RUNNING'?'var(--ok)':status==='FAULT'||status==='DEAD'?'var(--bad)':'var(--ink)';
 return(<Tooltip.Provider delayDuration={120}>
 <div className="mx-auto grid min-h-screen max-w-6xl gap-5 p-4 md:grid-cols-[250px_1fr]">
  <aside className="space-y-3">
   <h1 className="text-sm font-bold uppercase tracking-widest">Robotics Bench</h1>
   <nav className="space-y-1">{BOARDS.map(x=>{const on=x.id===st.boardId;return(
    <button key={x.id} onClick={()=>st.select(x.id)} className="relative block w-full rounded-md px-3 py-2 text-left">
     {on&&<motion.span layoutId="nav" className="absolute inset-0 rounded-md bg-[var(--ink)]"/>}
     <span className="relative" style={{color:on?'var(--paper)':undefined}}>{x.name}<small className="block opacity-60">{x.fig}</small></span></button>)})}</nav>
   <h2 className="pt-2 text-xs uppercase tracking-widest text-[var(--acc)]">Parts bin</h2>
   <ul className="space-y-1.5">{b.parts.map(p=>{const pl=bs.placed.includes(p.id),bu=bs.burnt.includes(p.id);return(
    <motion.li key={p.id} whileHover={{x:4}} whileTap={{scale:.98}} onClick={()=>st.toggle(p.id)} onMouseEnter={()=>st.setHover(p.id)} onMouseLeave={()=>st.setHover(null)}
     className="cursor-pointer rounded-md border bg-[var(--surf)] px-3 py-2" style={{borderColor:st.hover===p.id?'var(--acc)':'var(--line)'}}>
     <b>{p.name}</b><i className="block text-xs not-italic opacity-60">{p.note}</i>
     <em className="text-xs not-italic" style={{color:bu?'var(--bad)':pl?'var(--ok)':'var(--acc)'}}>{bu?'burnt: click to replace':bs.soldered.includes(p.id)?'soldered':pl?'placed: needs solder':'click to place'}</em>
    </motion.li>)})}</ul>
  </aside>
  <main className="space-y-3">
   <div className="flex flex-wrap items-end justify-between gap-3">
    <div><small className="opacity-60">{b.fig}</small><h2 className="text-xl font-bold">{b.name}</h2></div>
    <div className="flex gap-5 text-right">{([['STATUS',status],['PARTS',`${bs.placed.length}/${b.parts.length}`],['TO SOLDER',uns],['CURRENT',`${bs.res?.mA??0} mA`]] as const).map(([k,v])=>
     <div key={k}><small className="block text-[10px] tracking-widest opacity-60">{k}</small>
      <motion.b key={String(v)} initial={{scale:.75,opacity:0}} animate={{scale:1,opacity:1}} className="inline-block" style={{color:k==='STATUS'?tone:undefined}}>{v}</motion.b></div>)}</div>
   </div>
   <Stage/>
   <div className="flex flex-wrap gap-2">
    <Btn disabled={st.busy} onClick={st.placeAll}>Place all parts</Btn><Btn disabled={st.busy} onClick={st.solderAll}>Solder joints</Btn>
    <Btn onClick={st.power}>{bs.powered?'Unplug USB':'Plug in USB'}</Btn>
    {b.inputs?.map(i=><Btn key={i.id} onClick={()=>st.setInput(i.id)}>{i.label}: {bs.inputs[i.id]?'HIGH':'LOW'}</Btn>)}
    <Btn onClick={st.reset}>Reset</Btn></div>
   <AnimatePresence mode="wait"><motion.p key={msg} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}} aria-live="polite"
    className="rounded-md border-l-4 bg-[var(--surf)] p-3" style={{borderColor:tone}}>{msg}</motion.p></AnimatePresence>
   <div className="grid gap-3 md:grid-cols-2">
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surf)] p-3"><h3 className="mb-1 text-xs uppercase tracking-widest text-[var(--acc)]">Meet the board</h3>{b.lesson}</section>
    <section className="rounded-lg border border-[var(--line)] bg-[var(--surf)] p-3"><h3 className="mb-1 text-xs uppercase tracking-widest text-[var(--acc)]">Try to break it</h3>{b.tryIt}</section>
   </div>
  </main></div></Tooltip.Provider>);
}
