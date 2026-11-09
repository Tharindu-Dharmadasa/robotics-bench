import {create} from 'zustand';
import {BOARDS,BY} from '../data/boards';
import {evaluate} from '../engine/evaluate';
import type {BoardDef,SimResult,Status} from '../data/types';
export interface BS{placed:string[];soldered:string[];burnt:string[];powered:boolean;inputs:Record<string,boolean>;res:SimResult|null}
const fresh=():BS=>({placed:[],soldered:[],burnt:[],powered:false,inputs:{},res:null});
const EMPTY=fresh(),sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
interface S{boardId:string;boards:Record<string,BS>;hover:string|null;busy:boolean;
 select:(id:string)=>void;toggle:(id:string)=>void;placeAll:()=>Promise<void>;solderAll:()=>Promise<void>;
 power:()=>void;setInput:(k:string)=>void;reset:()=>void;setHover:(id:string|null)=>void}
export const useBench=create<S>((set,get)=>{
 const cur=()=>get().boards[get().boardId]??EMPTY;
 const upd=(fn:(s:BS)=>BS)=>set(st=>{const b=BY[st.boardId];let s=fn(st.boards[st.boardId]??EMPTY);const res=evaluate(b,s);
  if(res?.burn.length)s={...s,burnt:[...new Set([...s.burnt,...res.burn])]};return{boards:{...st.boards,[b.id]:{...s,res}}}});
 const run=async(pick:(s:BS,id:string)=>boolean,step:(s:BS,id:string)=>BS)=>{if(get().busy)return;set({busy:true});
  for(const p of BY[get().boardId].parts)if(pick(cur(),p.id)){upd(s=>step(s,p.id));await sleep(330)}set({busy:false})};
 return{boardId:BOARDS[0].id,boards:{},hover:null,busy:false,
  select:id=>set({boardId:id}),
  toggle:id=>upd(s=>s.placed.includes(id)?{...s,placed:s.placed.filter(x=>x!==id),soldered:s.soldered.filter(x=>x!==id),burnt:s.burnt.filter(x=>x!==id)}:{...s,placed:[...s.placed,id]}),
  placeAll:()=>run((s,id)=>!s.placed.includes(id),(s,id)=>({...s,placed:[...s.placed,id]})),
  solderAll:()=>run((s,id)=>s.placed.includes(id)&&!s.soldered.includes(id),(s,id)=>({...s,soldered:[...s.soldered,id]})),
  power:()=>upd(s=>({...s,powered:!s.powered})),
  setInput:k=>upd(s=>({...s,inputs:{...s.inputs,[k]:!s.inputs[k]}})),
  reset:()=>upd(()=>fresh()),setHover:hover=>set({hover})}});
export const useCurrent=()=>{const id=useBench(s=>s.boardId);const bs=useBench(s=>s.boards[id])??EMPTY;return{board:BY[id],bs}};
export const deriveStatus=(b:BoardDef,s:BS):Status=>s.powered&&s.res?s.res.status:s.placed.length<b.parts.length?'ASSEMBLING':s.soldered.length<s.placed.length?'NEEDS SOLDER':'READY';
