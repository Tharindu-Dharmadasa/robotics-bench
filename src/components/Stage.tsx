import {motion} from 'framer-motion';
import * as Tooltip from '@radix-ui/react-tooltip';
import {useBench,useCurrent} from '../store/bench';
/* isometric projection: board coords (x,y,z) -> screen */
const P=(x:number,y:number,z=0):string=>`${(300+(x-y)*1.212).toFixed(1)},${(100+(x+y)*.7-z).toFixed(1)}`;
const pts=(a:number[][])=>a.map(p=>P(p[0],p[1],p[2])).join(' ');
const ink={stroke:'var(--ink)',strokeWidth:1.5,strokeLinejoin:'round'} as const;
const Box=({x,y,w,d,h,c}:{x:number;y:number;w:number;d:number;h:number;c:string})=>(
 <g fill={c} {...ink}>
  <polygon style={{filter:'brightness(.82)'}} points={pts([[x,y+d,0],[x+w,y+d,0],[x+w,y+d,h],[x,y+d,h]])}/>
  <polygon style={{filter:'brightness(.64)'}} points={pts([[x+w,y,0],[x+w,y+d,0],[x+w,y+d,h],[x+w,y,h]])}/>
  <polygon points={pts([[x,y,h],[x+w,y,h],[x+w,y+d,h],[x,y+d,h]])}/>
 </g>);
const V={out:{y:-170,opacity:0},in:{y:0,x:0,opacity:1,transition:{type:'spring' as const,stiffness:170,damping:11}},
 burnt:{y:0,opacity:1,x:[0,-5,5,-4,4,0],transition:{duration:.5}}};
export function Stage(){
 const {board:b,bs}=useCurrent();const {toggle,hover,setHover}=useBench();
 const W=240,D=150,T=12;
 return(
 <svg viewBox="0 0 720 400" className="block w-full rounded-xl border border-[var(--line)] bg-[var(--surf)]" role="img" aria-label={`${b.name} board`}>
  <g fill={b.pcb} {...ink}>
   <polygon style={{filter:'brightness(.82)'}} points={pts([[0,D,-T],[W,D,-T],[W,D,0],[0,D,0]])}/>
   <polygon style={{filter:'brightness(.64)'}} points={pts([[W,0,-T],[W,D,-T],[W,D,0],[W,0,0]])}/>
   <polygon points={pts([[0,0,0],[W,0,0],[W,D,0],[0,D,0]])}/>
  </g>
  {[...b.parts].sort((a,c)=>a.x+a.y-c.x-c.y).map(p=>{
   const placed=bs.placed.includes(p.id),burnt=bs.burnt.includes(p.id),sold=bs.soldered.includes(p.id);
   const blink=!!bs.res?.blink.includes(p.id),on=blink||!!bs.res?.lit.includes(p.id);
   const [cx,cy]=P(p.x+p.w/2,p.y+p.d/2,p.h).split(',').map(Number);
   const [j1x,j1y]=P(p.x+p.w*.25,p.y+p.d+3).split(',').map(Number),[j2x,j2y]=P(p.x+p.w*.75,p.y+p.d+3).split(',').map(Number);
   return(<g key={p.id}>
    <motion.polygon initial={false} animate={{opacity:placed?0:1}} fill="none" stroke="var(--acc)" strokeDasharray="5 4" strokeWidth={1.5} points={pts([[p.x,p.y,0],[p.x+p.w,p.y,0],[p.x+p.w,p.y+p.d,0],[p.x,p.y+p.d,0]])}/>
    <Tooltip.Root><Tooltip.Trigger asChild>
     <motion.g initial={false} variants={V} animate={burnt?'burnt':placed?'in':'out'} style={{cursor:'pointer'}}
      onClick={()=>toggle(p.id)} onMouseEnter={()=>setHover(p.id)} onMouseLeave={()=>setHover(null)}>
      <g className={burnt?'grayscale brightness-[.35]':''} style={hover===p.id?{filter:'drop-shadow(0 0 3px var(--acc))'}:undefined}><Box {...p}/></g>
      <motion.ellipse cx={cx} cy={cy} rx={24} ry={13} fill={p.glow??'#fff'} className="pointer-events-none blur-md" initial={false}
       animate={{opacity:on?(blink?[.95,0]:.95):0}} transition={on&&blink?{duration:.5,repeat:Infinity,repeatType:'reverse',ease:'linear'}:{duration:.3}}/>
      {burnt&&[0,.6,1.2].map(d=><motion.circle key={d} cx={cx+d*8-8} cy={cy} r={5} fill="var(--ink)" className="pointer-events-none"
       animate={{y:-46,scale:2.2,opacity:[.55,0]}} transition={{duration:1.8,repeat:Infinity,delay:d}}/>)}
      {hover===p.id&&<text x={cx} y={cy-24} textAnchor="middle" fontSize={11} fill="var(--ink)" stroke="var(--surf)" strokeWidth={4} paintOrder="stroke">{p.name}</text>}
     </motion.g></Tooltip.Trigger>
     <Tooltip.Portal><Tooltip.Content sideOffset={6} className="rounded bg-[var(--ink)] px-2 py-1 text-xs text-[var(--paper)]">{p.name}: {p.note}</Tooltip.Content></Tooltip.Portal>
    </Tooltip.Root>
    {[[j1x,j1y],[j2x,j2y]].map(([x,y],i)=><motion.circle key={i} cx={x} cy={y} r={3} stroke="var(--ink)" initial={false} style={{transformBox:'fill-box',transformOrigin:'center'}}
     animate={{opacity:placed?1:0,fill:sold?'#e6a817':'#8c8c8c',scale:sold?[1.9,1]:1}}/>)}
   </g>);})}
 </svg>);
}
