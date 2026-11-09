import type {BoardDef,Cond,SimResult} from '../data/types';
export interface SimInput{placed:string[];soldered:string[];burnt:string[];powered:boolean;inputs:Record<string,boolean>}
/** Pure rules engine. Present = placed AND soldered AND not burnt. First matching rule wins. */
export function evaluate(b:BoardDef,i:SimInput):SimResult|null{
 if(!i.powered)return null;
 const here=new Set(b.parts.map(p=>p.id).filter(id=>i.placed.includes(id)&&i.soldered.includes(id)&&!i.burnt.includes(id)));
 const t=(c:Cond):boolean=>'has' in c?here.has(c.has):'missing' in c?!here.has(c.missing):'input' in c?!!i.inputs[c.input]:'not' in c?!t(c.not):'all' in c?c.all.every(t):c.any.some(t);
 const r=b.rules.find(r=>t(r.when));
 if(!r)return{status:'IDLE',msg:'Nothing happens.',mA:0,lit:[],blink:[],burn:[]};
 const {when:_w,...out}=r;return out;
}
