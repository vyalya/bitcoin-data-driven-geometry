import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,InstancedMesh,MeshBasicMaterial,Matrix4,Vector3,Quaternion,Raycaster,PerspectiveCamera,Points,BufferGeometry,Float32BufferAttribute,PointsMaterial,DoubleSide} from 'three';
import {setBlockInstances,toothLength,POINT_HIT_THRESHOLD} from '../src/geometry.ts';
import {sameSelection,inspectSelection} from '../src/selection.ts';
import {resetCameraPose,gridLayout} from '../src/camera.ts';
import {readJSON} from '../pipeline/lib/data.mjs';

const makeMesh=n=>new InstancedMesh(new BoxGeometry(1,1,1),new MeshBasicMaterial({side:DoubleSide}),n);
test('both layouts retain each block’s weight, count, and selectable instance identity',()=>{
  const records=readJSON('public/data/blocks.json')['2024-04-20'];
  const mesh=makeMesh(records.length),matrix=new Matrix4(),position=new Vector3(),scale=new Vector3(),rotation=new Quaternion();
  for(const style of ['classic','atom','classic','atom']){
    setBlockInstances(mesh,records,style,true);mesh.updateMatrixWorld(true);
    assert.equal(mesh.count,records.length);
    for(let i=0;i<records.length;i++){
      mesh.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
      assert.ok(Math.abs(scale.z-toothLength(records[i][2]))<1e-6);
      assert.ok(mesh.boundingSphere.containsPoint(position));
      // Aim along each tooth’s outward radial axis. It must remain hittable
      // after switching layouts, with its original block index intact.
      const direction=position.clone().normalize();
      const hits=new Raycaster(direction.clone().multiplyScalar(5),direction.negate()).intersectObject(mesh);
      assert.ok(hits.some(hit=>hit.instanceId===i),`${style}: tooth ${i} unreachable`);
    }
  }
  mesh.geometry.dispose();mesh.material.dispose();
});
test('cached instance bounds grow when moving from genesis to full blocks',()=>{
  const mesh=makeMesh(2);setBlockInstances(mesh,[[0,285,1140,1]],'classic',true);
  const oldRadius=mesh.boundingSphere.radius;
  setBlockInstances(mesh,[[1,1000000,4000000,2],[2,1000000,4000000,2]],'atom',true);
  assert.ok(mesh.boundingSphere.radius>oldRadius);
  mesh.geometry.dispose();mesh.material.dispose();
});
test('particle hit padding no longer captures clicks far from a visible dot',()=>{
  const points=new Points(new BufferGeometry().setAttribute('position',new Float32BufferAttribute([.5,0,1],3)),new PointsMaterial());
  const ray=new Raycaster(new Vector3(0,0,5),new Vector3(0,0,-1));
  ray.params.Points.threshold=POINT_HIT_THRESHOLD;
  assert.equal(ray.intersectObject(points).length,0);
  ray.set(new Vector3(.5,0,5),new Vector3(0,0,-1));assert.equal(ray.intersectObject(points).length,1);
  points.geometry.dispose();points.material.dispose();
});
test('selecting another tooth switches the pin; only the same tooth toggles off',()=>{
  assert.equal(sameSelection({type:'block',block:[1]},{type:'block',block:[2]}),false);
  assert.equal(sameSelection({type:'block',block:[1]},{type:'block',block:[1]}),true);
  assert.equal(sameSelection({type:'blocks'},{type:'block',block:[1]}),false);
});
test('hover previews another signal while preserving the clicked selection for pointer exit',()=>{
  const pin={type:'transactions'},hover={type:'fees-total'};
  const preview=inspectSelection(hover,'fees-total',pin,'transactions');
  assert.equal(preview.context,hover);assert.equal(preview.group,'fees-total');assert.equal(preview.pinned,false);
  const restored=inspectSelection({type:'none'},null,pin,'transactions');
  assert.equal(restored.context,pin);assert.equal(restored.group,'transactions');assert.equal(restored.pinned,true);
  const idle=inspectSelection({type:'none'},null,{type:'none'},null);
  assert.equal(idle.group,null);assert.equal(idle.pinned,false);
});
test('a pinned tooth does not stop another tooth or ring being inspected',()=>{
  const pin={type:'block',block:[420000],index:0},other={type:'block',block:[420001],index:1};
  const preview=inspectSelection(other,'spine',pin,'spine');
  assert.equal(preview.context,other);assert.equal(preview.pinned,false);
  assert.equal(inspectSelection(pin,'spine',pin,'spine').pinned,true);
  assert.equal(inspectSelection({type:'hashrate'},'hashrate',pin,'spine').group,'hashrate');
  assert.equal(inspectSelection({type:'none'},null,pin,'spine').context,pin);
});
test('camera reset removes accumulated pan, roll, and zoom across repeated view changes',()=>{
  const camera=new PerspectiveCamera(42,1.5,.05,1000);
  for(let i=0;i<25;i++){
    camera.position.set(8+i,-3,2);camera.up.set(1,.2,-.7);camera.zoom=4;camera.lookAt(8,3,-4);
    resetCameraPose(camera,30,25,42,30);
    const center=new Vector3(0,30,0).project(camera);
    assert.ok(Math.abs(center.x)<1e-12&&Math.abs(center.y)<1e-12);
    assert.deepEqual(camera.up.toArray(),[0,1,0]);assert.equal(camera.zoom,1);
    resetCameraPose(camera,1.5,11,36,0);
    assert.ok(new Vector3().project(camera).length()>0);
    assert.ok(Math.abs(new Vector3().project(camera).y)<1e-12);
  }
});
test('responsive grid stays within its viewport on mobile, tablet, desktop and short screens',()=>{
  for(const [width,height] of [[320,410],[375,540],[430,400],[560,650],[900,700],[1600,1100],[340,190]]){
    const layout=gridLayout(width,height,150),camera=new PerspectiveCamera(42,width/height,.05,1000);
    resetCameraPose(camera,layout.rowY(layout.firstRow),layout.distance,42,layout.rowY(layout.firstRow));
    for(const column of [0,layout.columns-1])for(const row of [0,layout.visibleRows-1]){
      const x=(column-(layout.columns-1)/2)*3.6;
      for(const dx of [-1.6,1.6])for(const dy of [-1.6,1.6]){
        const projected=new Vector3(x+dx,layout.rowY(row)+dy,0).project(camera);
        assert.ok(Math.abs(projected.x)<=1&&Math.abs(projected.y)<=1,`${width}x${height} clipped`);
      }
    }
  }
});
