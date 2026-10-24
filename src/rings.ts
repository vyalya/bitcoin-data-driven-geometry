import type {NetworkSnapshot} from './types';
import type {FormStyle} from './geometry';
import {normalized,difficultyFill} from './metrics';

export function coreRingSpecs(s:NetworkSnapshot,style:FormStyle){
  const rings: {id:string;radius:number;fill:number;color:string;rotation:[number,number,number]}[] = [
    {id:"transactions",radius:2,fill:normalized(s.transactionCount,s.scales.dailyTransactions),color:"#FFC873",rotation:[0,0,0]},
    {id:"fees-total",radius:2.5,fill:normalized(s.totalFeesBtc,s.scales.feesBtc),color:"#F7931A",rotation:[0,0,0]},
    {id:"difficulty",radius:3,fill:difficultyFill(s.difficulty,s.scales.difficulty),color:"#D9A441",rotation:[Math.PI/2,0,0]},
    {id:"hashrate",radius:3.5,fill:normalized(s.networkHashrateEh,s.scales.hashrateEh),color:"#FFE0A3",rotation:[0,Math.PI/2,0]},
  ];
  if(style==="atom")rings.forEach((r,i)=>r.rotation=([[0.3,0.2,0],[1.05,0.6,0.55],[-0.85,0.55,-0.65],[0.2,1.2,-0.3]] as [number,number,number][])[i]);
  return rings;
}

