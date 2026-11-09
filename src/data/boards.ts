import type {BoardDef,Cond,Rule,Status} from './types';
const P=(id:string,name:string,note:string,x:number,y:number,w:number,d:number,h:number,c:string,glow?:string)=>({id,name,note,x,y,w,d,h,c,glow});
const R=(when:Cond,status:Status,msg:string,mA=0,o:Partial<Rule>={}):Rule=>({when,status,msg,mA,lit:[],blink:[],burn:[],...o});
const no=(id:string):Cond=>({missing:id}),has=(id:string):Cond=>({has:id}),ALL:Cond={all:[]};
export const BOARDS:BoardDef[]=[
{id:'led',fig:'Fig. 01',name:'LED + resistor',pcb:'#2f6b4f',
 lesson:'A source, a current limiter and a light. The resistor decides how much current the LED sees.',
 tryIt:'Power it without the resistor, then replace the burnt LED and try again.',
 parts:[P('pwr','5 V header','power in',20,50,40,44,20,'#555'),P('res','330 Ω resistor','limits current',105,28,54,14,9,'#d9b36c'),P('led','Red LED','the load',170,84,24,24,16,'#e04a3f','#ff5a4a')],
 rules:[R(no('pwr'),'DEAD','No 5 V source on the board, so nothing is powered.'),
  R(no('led'),'IDLE','Circuit is open: there is no LED to carry current.'),
  R(no('res'),'FAULT','No current limiter! About 600 mA hit the LED and it burned out.',600,{burn:['led']}),
  R(ALL,'RUNNING','LED lit. The resistor limits current to about 14 mA.',14,{lit:['led']})]},
{id:'npn',fig:'Fig. 02',name:'Transistor switch',pcb:'#2f6b4f',inputs:[{id:'sig',label:'Signal'}],
 lesson:'A tiny base current lets a transistor switch a bigger load current, the way a microcontroller pin drives bigger loads.',
 tryIt:'Set the signal HIGH with no base resistor, or remove the LED resistor.',
 parts:[P('pwr','5 V header','power in',14,10,36,36,18,'#555'),P('rb','1 kΩ base resistor','protects the base',70,30,44,12,8,'#d9b36c'),P('q','2N2222 NPN','the switch',130,22,26,20,16,'#2b2b2b'),P('rl','330 Ω resistor','limits LED current',75,80,44,12,8,'#d9b36c'),P('led','Green LED','the load',170,90,24,24,16,'#3fae66','#7dff9e')],
 rules:[R(no('pwr'),'DEAD','No 5 V source on the board.'),R(no('q'),'IDLE','No transistor, so nothing can switch the LED.'),
  R({not:{input:'sig'}},'IDLE','Signal is LOW: the transistor is off. Set the signal HIGH.',1),
  R(no('rb'),'FAULT','No base resistor: the base was over-driven and the transistor died.',300,{burn:['q']}),
  R(no('led'),'IDLE','Open load: no LED in the collector path.',2),
  R(no('rl'),'FAULT','No series resistor on the LED, so it burned out.',500,{burn:['led']}),
  R(ALL,'RUNNING','About 4 mA of base current switches about 16 mA through the LED.',20,{lit:['led']})]},
{id:'uno',fig:'Fig. 03',name:'Arduino Uno R3',pcb:'#2b5aa8',
 lesson:'An ATmega328P needs power, a clean 5 V rail and a 16 MHz clock before it runs your sketch. Pin 13 drives an LED.',
 tryIt:'Remove the crystal or the regulator, then power up. Try the LED without its resistor.',
 parts:[P('usb','USB-B connector','power + serial',10,10,44,40,22,'#aaa'),P('reg','5 V regulator','clean rail',70,12,26,22,14,'#2b2b2b'),P('xtal','16 MHz crystal','the clock',75,60,34,16,12,'#c0c0c8'),P('mcu','ATmega328P','the brain',130,40,70,28,12,'#222'),P('cap','100 nF capacitor','noise filter',70,105,20,14,12,'#d6a228'),P('r13','Pin 13 resistor','limits LED',130,100,36,12,8,'#d9b36c'),P('led13','Pin 13 LED','blink output',185,100,24,20,12,'#f0a020','#ffc04a')],
 rules:[R(no('usb'),'DEAD','No USB power.'),R(no('reg'),'DEAD','No 5 V regulator, so there is no stable supply rail.'),
  R(no('mcu'),'IDLE','Power is fine but there is no ATmega328P to run code.',5),
  R(no('xtal'),'FAULT','No 16 MHz crystal: the chip never starts executing.',22),
  R({all:[has('led13'),no('r13')]},'FAULT','Pin 13 drove the LED with no resistor. LED burned out.',90,{burn:['led13']}),
  R({any:[no('led13'),no('r13')]},'RUNNING','Code runs, but pin 13 shows nothing. Add its resistor and LED.',45),
  R(no('cap'),'RUNNING','Blinks, but with no decoupling cap the supply is noisy and may reset.',48,{blink:['led13']}),
  R(ALL,'RUNNING','Blink sketch running: pin 13 toggles once a second.',45,{blink:['led13']})]}
];
export const BY=Object.fromEntries(BOARDS.map(b=>[b.id,b])) as Record<string,BoardDef>;
