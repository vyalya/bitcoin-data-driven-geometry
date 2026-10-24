import { Vector3 } from 'three';
import type { BlockTuple, NetworkSnapshot } from '../types';
import type { GearGeometry } from './geometry';
import { difficultyFill, normalized } from '../metrics';
import { polygonPoint } from './model';
import { addressPoint } from './presentation';
export type SignalLabel={id:string;text:string;anchor:Vector3;side:'left'|'right';row:number};

/** Leaders terminate on a real, nonempty instance or a measured rim portion. */
export function signalLabels(snapshot:NetworkSnapshot,blocks:BlockTuple[],core:GearGeometry,addressCount:number):SignalLabel[] {
  const labels:SignalLabel[]=[];
  const largest=(matrices:GearGeometry['bodyMatrices'])=>{
    let best=-1,length=0;
    matrices.forEach((matrix,i)=>{const value=new Vector3().setFromMatrixScale(matrix).y;if(value>length){length=value;best=i;}});
    return best;
  };
  const bodyIndex=largest(core.bodyMatrices);
  if(bodyIndex>=0){
    labels.push({id:'blocks',text:'Blocks',anchor:new Vector3(0,-.35,.5).applyMatrix4(core.bodyMatrices[bodyIndex]),side:'left',row:.18});
    labels.push({id:'weight',text:'Block weight',anchor:new Vector3(0,.5,.5).applyMatrix4(core.bodyMatrices[bodyIndex]),side:'left',row:.38});
  }
  for(const [id,text,matrices,row] of [
    ['transactions','Transactions',core.transactionMatrices,.58],
    ['fees-total','Fees',core.feeMatrices,.78],
  ] as const){
    const index=largest(matrices);
    if(index>=0)labels.push({id,text,anchor:new Vector3(0,.4,.5).applyMatrix4(matrices[index]),side:'left',row});
  }
  const difficulty=difficultyFill(snapshot.difficulty,snapshot.scales.difficulty);
  const hashrate=normalized(snapshot.networkHashrateEh,snapshot.scales.hashrateEh);
  if(difficulty>0)labels.push({id:'difficulty',text:'Difficulty',anchor:new Vector3(...polygonPoint(2.55,difficulty*.55,-.0675)),side:'right',row:.26});
  if(hashrate>0)labels.push({id:'hashrate',text:'Hashrate',anchor:new Vector3(...polygonPoint(2.83,hashrate*.55,-.1375)),side:'right',row:.48});
  if(addressCount>0)labels.push({id:'addresses',text:'Active addresses',anchor:addressPoint(Math.min(10,addressCount-1)),side:'right',row:.72});
  // The compact block array is the identity source for all three instance sets.
  if(core.bodyMatrices.length!==blocks.length)throw Error('Signal labels require matching block identities');
  return labels;
}
