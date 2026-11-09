export type Status='ASSEMBLING'|'NEEDS SOLDER'|'READY'|'RUNNING'|'IDLE'|'FAULT'|'DEAD';
export type Cond={has:string}|{missing:string}|{input:string}|{not:Cond}|{all:Cond[]}|{any:Cond[]};
export interface PartDef{id:string;name:string;note:string;x:number;y:number;w:number;d:number;h:number;c:string;glow?:string}
export interface Rule{when:Cond;status:Status;msg:string;mA:number;lit:string[];blink:string[];burn:string[]}
export type SimResult=Omit<Rule,'when'>;
export interface BoardDef{id:string;fig:string;name:string;pcb:string;inputs?:{id:string;label:string}[];parts:PartDef[];rules:Rule[];lesson:string;tryIt:string}
