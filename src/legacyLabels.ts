import {Euler,Vector3} from 'three';
import type {NetworkSnapshot,BlockTuple} from './types';
import type {FormStyle} from './geometry';
import {blockMatrix} from './geometry';
import {coreRingSpecs} from './rings';
import type {SignalLabel} from './gear/labels';

type LegacyStyle=Exclude<FormStyle,'gear'>;
/** Use the actual block transform and each style's own ring planes/scales. */
export function legacySignalLabels(snapshot:NetworkSnapshot,blocks:BlockTuple[],style:LegacyStyle,addressCount:number,addressAnchor:Vector3):SignalLabel[] {
  const labels:SignalLabel[]=[];
  if(blocks.length){
    const index=blocks.reduce((best,block,i)=>block[2]>blocks[best][2]?i:best,0);
    const matrix=blockMatrix(blocks[index],index,blocks.length,style);
    labels.push({id:'blocks',text:'Blocks',anchor:new Vector3(0,0,.35).applyMatrix4(matrix),side:'left',row:.18});
    labels.push({id:'weight',text:'Block weight',anchor:new Vector3(0,0,-.5).applyMatrix4(matrix),side:'left',row:.38});
  }
  for(const [index,ring] of coreRingSpecs(snapshot,style).entries()){
    // ArcBand emits no mesh below this angular threshold.
    if(2*Math.PI*ring.fill<1e-6)continue;
    const angle=2*Math.PI*ring.fill*.55;
    labels.push({id:ring.id,text:({transactions:'Transactions','fees-total':'Fees',difficulty:'Difficulty',hashrate:'Hashrate'} as Record<string,string>)[ring.id],
      anchor:new Vector3(Math.cos(angle)*ring.radius,Math.sin(angle)*ring.radius,0).applyEuler(new Euler(...ring.rotation)),
      side:index<2?'left':'right',row:[.58,.78,.26,.48][index]});
  }
  // Share the live vector updated by AddressParticles as its dots move.
  if(addressCount>0)labels.push({id:'addresses',text:'Active addresses',anchor:addressAnchor,side:'right',row:.72});
  return labels;
}
export function legacyEndpoints(blocks:BlockTuple[],style:LegacyStyle) {
  const indices=blocks.length===0?[]:blocks.length===1?[0]:[0,blocks.length-1];
  return indices.map(index=>{
    const point=new Vector3(0,0,-.5).applyMatrix4(blockMatrix(blocks[index],index,blocks.length,style));
    point.addScaledVector(point.clone().normalize(),.12);
    return {height:blocks[index][0],role:blocks.length===1?'only':index===0?'start':'end',position:point.toArray() as [number,number,number]};
  });
}
