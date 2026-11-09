import {describe,it,expect} from 'vitest';
import {BY} from '../data/boards';
import {evaluate} from './evaluate';
const run=(id:string,skip:string[]=[],sold=true)=>{const ids=BY[id].parts.map(p=>p.id).filter(x=>!skip.includes(x));
 return evaluate(BY[id],{placed:ids,soldered:sold?ids:[],burnt:[],powered:true,inputs:{sig:true}})!};
describe('engine',()=>{
 it('LED runs when complete',()=>{const r=run('led');expect(r.status).toBe('RUNNING');expect(r.lit).toEqual(['led'])});
 it('LED burns without resistor',()=>{const r=run('led',['res']);expect(r.status).toBe('FAULT');expect(r.burn).toEqual(['led'])});
 it('unsoldered parts are electrically absent',()=>expect(run('led',[],false).status).toBe('DEAD'));
 it('transistor dies without base resistor',()=>expect(run('npn',['rb']).burn).toEqual(['q']));
 it('Uno halts without crystal',()=>expect(run('uno',['xtal']).status).toBe('FAULT'));
 it('Uno blinks when complete',()=>expect(run('uno').blink).toEqual(['led13']));
});
