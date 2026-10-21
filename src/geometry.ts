import { Object3D, Color } from 'three';
import type { InstancedMesh } from 'three';
import type { BlockTuple } from './types';

export type FormStyle = 'atom' | 'classic';
export const POINT_HIT_THRESHOLD = 0.045;
export const BLOCK_WEIGHT_LIMIT = 4_000_000;
export const toothLength = (weight:number) => 0.12 + 1.35 * weight / BLOCK_WEIGHT_LIMIT;

// Both presentation modes and the legend use exactly the same measurements.
// Hit targets widen the cross-section only; they never change the drawn length.
export function setBlockInstances(mesh:InstancedMesh, blocks:BlockTuple[], style:FormStyle, hitTarget=false, selected=-1) {
  const dummy=new Object3D(), color=new Color();
  mesh.count=blocks.length;
  blocks.forEach((block,i)=>{
    const length=toothLength(block[2]), radius=.3+length/2;
    const width=hitTarget?.075:i===selected?.065:.025;
    if(style==='atom'){
      const y=1-2*(i+.5)/blocks.length, r=Math.sqrt(1-y*y), azimuth=i*Math.PI*(3-Math.sqrt(5));
      dummy.position.set(Math.cos(azimuth)*r*radius,y*radius,Math.sin(azimuth)*r*radius);
    }else{
      const angle=i/blocks.length*Math.PI*2;
      dummy.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,0);
    }
    dummy.lookAt(0,0,0);
    dummy.scale.set(width,width,length);
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
    if(!hitTarget)mesh.setColorAt(i,color.set(i===selected?'#FFF1D8':'#F7931A'));
  });
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  // Three caches instance bounds; recompute after dates or layout change.
  mesh.computeBoundingSphere();
  mesh.computeBoundingBox();
}
