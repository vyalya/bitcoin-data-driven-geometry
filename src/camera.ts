import type { PerspectiveCamera } from 'three';

// Fully replace the detail pose on view changes: TrackballControls also changes
// camera.x, up, quaternion and zoom, not just its distance from the origin.
export function resetCameraPose(camera: PerspectiveCamera, y:number, z:number, fov:number, targetY:number) {
  camera.position.set(0,y,z);
  camera.up.set(0,1,0);
  camera.zoom=1;
  camera.fov=fov;
  camera.lookAt(0,targetY,0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}

export function gridLayout(width:number,height:number,count:number) {
  const columns=width<460?2:width<760?3:5;
  const rows=Math.max(1,Math.ceil(count/columns));
  const visibleRows=Math.min(rows,Math.max(2,Math.min(6,Math.floor(height/width*columns))));
  const halfWidth=((columns-1)*3.6+3.2)/2;
  const halfHeight=((visibleRows-1)*3.2+3.2)/2;
  const tangent=Math.tan(42*Math.PI/360);
  const distance=Math.max(halfHeight/tangent,halfWidth/(tangent*width/height))*1.08;
  const rowY=(row:number)=>((rows-1)/2-row)*3.2;
  const firstRow=(visibleRows-1)/2, lastRow=Math.max(firstRow,rows-1-firstRow);
  return {columns,rows,visibleRows,distance,firstRow,lastRow,rowY};
}
