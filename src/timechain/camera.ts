import { Vector3 } from 'three';
import type { PerspectiveCamera } from 'three';
export type StudyControls = {target:Vector3;enableDamping:boolean;update:()=>unknown;saveState:()=>void};
/** Fit the same full-size sculpture at every viewport size, clearing old pan inertia. */
export function fitStudyCamera(camera:PerspectiveCamera,controls:StudyControls|null,width:number,height:number){
  const damping=controls?.enableDamping;
  if(controls){controls.enableDamping=false;controls.update();}
  const half=Math.atan(Math.tan(camera.fov*Math.PI/360)*Math.min(1,width/height));
  camera.position.copy(new Vector3(5.4,7.8,8.8).normalize().multiplyScalar(5.1/Math.sin(half)));
  camera.up.set(0,1,0);camera.zoom=1;
  camera.lookAt(0,0,0);camera.updateProjectionMatrix();
  if(controls){controls.target.set(0,0,0);controls.update();controls.saveState();controls.enableDamping=damping!;}
  camera.updateMatrixWorld(true);
}
