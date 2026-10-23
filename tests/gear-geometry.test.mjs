import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { BoxGeometry, InstancedMesh, MeshBasicMaterial, Vector3, Quaternion, Raycaster, DoubleSide } from 'three';
import { blockPose, blockLength, transactionLength, feeLength, polygonPoint, METRIC_MAX_LENGTH } from '../src/gear/model.ts';
const compiled = await build({ entryPoints: [new URL('../src/gear/geometry.ts', import.meta.url).pathname], bundle: true, write: false, platform: 'node', format: 'esm' });
const { buildGearGeometry, buildFrame, bandGeometry } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const allBlocks = read('public/data/blocks.json'), data = read('public/data/block-fees.json');
const maxTransactions = data.maxNonCoinbase, maxFees = data.maxBlockFeesSat;
const makeInstances = matrices => {
  const mesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ side: DoubleSide }), matrices.length);
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.updateMatrixWorld(true);return mesh;
};
const dispose = gear => { gear.rails.dispose();gear.links.dispose(); };

test('each real gear tooth and paired bars invert to the recorded weight, transactions, and satoshis', () => {
  const p = new Vector3(), q = new Quaternion(), scale = new Vector3();
  for (const [date, blocks] of Object.entries(allBlocks)) {
    const gear = buildGearGeometry(blocks, data.days[date].feesSat, maxTransactions, maxFees);
    assert.equal(gear.bodyMatrices.length, blocks.length);
    assert.equal(gear.transactionMatrices.length, blocks.length);
    assert.equal(gear.feeMatrices.length, blocks.length);
    for (let i = 0; i < blocks.length; i++) {
      const pose=blockPose(i,blocks.length), radial=new Vector3(...pose.normal), tangent=new Vector3(...pose.tangent);
      gear.bodyMatrices[i].decompose(p,q,scale);
      assert.ok(Math.abs((scale.y-.12)/.75*4e6-blocks[i][2])<1e-8);
      assert.ok(Math.abs(scale.z-.18)<1e-12);
      assert.ok(new Vector3(0,-.5,0).applyMatrix4(gear.bodyMatrices[i]).distanceTo(new Vector3(...pose.position))<1e-12);
      assert.ok(new Vector3(0,1,0).applyQuaternion(q).distanceTo(radial)<1e-12);
      for(const [j,matrix] of [gear.transactionMatrices[i],gear.feeMatrices[i]].entries()) {
        p.setFromMatrixPosition(matrix);scale.setFromMatrixScale(matrix);
        assert.ok(Math.abs(p.z-.14)<1e-12);
        const metricWidth=Math.min(.025,2*Math.PI*.8/blocks.length*.24);
        assert.ok(Math.abs(p.dot(tangent)-(j===0?-1:1)*metricWidth*.8)<1e-12);
        assert.ok(Math.abs(p.dot(radial)-(.8+scale.y/2))<1e-12);
        const decoded=j===0?scale.y/METRIC_MAX_LENGTH*maxTransactions:Math.expm1(scale.y/METRIC_MAX_LENGTH*Math.log1p(maxFees/1e8))*1e8;
        const expected=j===0?blocks[i][3]-1:data.days[date].feesSat[i];
        assert.ok(Math.abs(decoded-expected)<(j===0?1e-8:.0001));
      }
    }
    dispose(gear);
  }
});

test('clockwise block order begins at noon and invalid observations never gain nonzero bars', () => {
  const poses=Array.from({length:4},(_,i)=>blockPose(i,4));
  [[0,1,0],[1,0,0],[0,-1,0],[-1,0,0]].forEach((normal,i)=>assert.ok(new Vector3(...poses[i].normal).distanceTo(new Vector3(...normal))<1e-12));
  assert.equal(transactionLength(1,maxTransactions),0);assert.equal(feeLength(0,maxFees),0);
  for(const value of [null,undefined,NaN,Infinity,-1,.5]){assert.equal(transactionLength(value,maxTransactions),null);assert.equal(feeLength(value,maxFees),null);}
  assert.equal(transactionLength(0,maxTransactions),null);assert.equal(transactionLength(maxTransactions+2,maxTransactions),null);assert.equal(feeLength(maxFees+1,maxFees),null);
  for(const pair of [[-1,3],[3,3],[0,0],[.5,3],[0,NaN]])assert.throws(()=>blockPose(...pair),RangeError);
  assert.throws(()=>blockLength(4000001),RangeError);
});

function corners(matrix){return[-1,1].flatMap(x=>[-1,1].map(y=>new Vector3(x/2,y/2,0).applyMatrix4(matrix)));}
function overlaps(a,b){const va=corners(a),vb=corners(b);const axes=[a,b].flatMap(m=>[new Vector3().setFromMatrixColumn(m,0).normalize(),new Vector3().setFromMatrixColumn(m,1).normalize()]);return axes.every(axis=>{const pa=va.map(p=>p.dot(axis)),pb=vb.map(p=>p.dot(axis));return Math.min(Math.max(...pa),Math.max(...pb))-Math.max(Math.min(...pa),Math.min(...pb))>1e-12;});}
test('223 full teeth and 446 paired bars have disjoint footprints',()=>{
  const blocks=Array.from({length:223},(_,i)=>[i,1e6,4e6,maxTransactions+1]),gear=buildGearGeometry(blocks,Array(223).fill(maxFees),maxTransactions,maxFees);
  const matrices=[...gear.bodyMatrices,...gear.transactionMatrices,...gear.feeMatrices];
  for(let i=0;i<matrices.length;i++)for(let j=i+1;j<matrices.length;j++)assert.equal(overlaps(matrices[i],matrices[j]),false,`Shapes ${i}/${j} overlap`);
  dispose(gear);
});

test('actual Three raycasts select the right flat tooth and bar, with no zero or missing phantom hits',()=>{
  const blocks=Array.from({length:223},(_,i)=>[840000+i,1e6,Math.round(4e6*i/222),i%11?100+i:1]);
  const fees=blocks.map((_,i)=>i%7===0?null:i%13===0?0:Math.round(maxFees*(.1+.9*i/223)));
  const gear=buildGearGeometry(blocks,fees,maxTransactions,maxFees);
  for(const [kind,matrices] of [['body',gear.bodyMatrices],['transaction',gear.transactionMatrices],['fee',gear.feeMatrices]]) {
    const mesh=makeInstances(matrices);
    for(let i=0;i<blocks.length;i++) {
      const p=new Vector3().setFromMatrixPosition(matrices[i]);
      const hits=new Raycaster(new Vector3(p.x,p.y,1),new Vector3(0,0,-1)).intersectObject(mesh);
      const empty=kind==='transaction'&&blocks[i][3]===1||kind==='fee'&&!fees[i];
      if(empty){
        assert.ok(!hits.some(h=>h.instanceId===i),`${kind} ${i} has a phantom front hit`);
        const radial=new Vector3(...blockPose(i,blocks.length).normal);
        const sideHits=new Raycaster(p.clone().addScaledVector(radial,.2),radial.clone().negate()).intersectObject(mesh);
        assert.ok(!sideHits.some(h=>h.instanceId===i),`${kind} ${i} has a phantom radial hit`);
        for(const x of [-.5,.5])for(const y of [-.5,.5])for(const z of [-.5,.5]){
          assert.ok(new Vector3(x,y,z).applyMatrix4(matrices[i]).distanceTo(p)<1e-12,`${kind} ${i} retains a visible collapsed face`);
        }
      }else assert.equal(hits[0]?.instanceId,i,`${kind} ${i} is not selectable`);
    }
    mesh.geometry.dispose();mesh.material.dispose();
  }
  dispose(gear);
});

test('rails retain block identity and the ordered chain track preserves gaps without day closure',()=>{
  const blocks=[[10,1e6,4e6,1],[11,1e6,4e6,1],[14,1e6,4e6,1],[15,1e6,4e6,1]],gear=buildGearGeometry(blocks,[0,0,0,0],maxTransactions,maxFees);
  assert.deepEqual(gear.rails.userData.blockIndices,[0,1,2,3]);
  const rails=gear.rails.getAttribute('position');assert.equal(rails.count,8);
  for(let i=0;i<4;i++){const a=new Vector3().fromBufferAttribute(rails,i*2),b=new Vector3().fromBufferAttribute(rails,i*2+1);assert.ok(Math.abs(Math.hypot(a.x,a.y)-.72)<1e-6);assert.ok(Math.abs(Math.hypot(b.x,b.y)-1.5)<1e-6);}
  assert.deepEqual(gear.links.userData.blockPairs,[[0,1],[0,1],[0,1],[0,1],[2,3],[2,3],[2,3],[2,3]]);
  const links=gear.links.getAttribute('position');for(let i=0;i<links.count;i++)assert.ok(Math.abs(Math.hypot(links.getX(i),links.getY(i))-1.5)<1e-6);
  dispose(gear);
});

test('polygon bands measure a straight-sided perimeter prefix, not an angular approximation',()=>{
  const radius=2.55,width=.045,depth=.025,z=-.08;
  for(const fill of [.0001,.17356,.5,.999,1]) {
    const geometry=bandGeometry(radius,width,depth,z,fill),positions=geometry.getAttribute('position'),outer=new Map();
    for(let i=0;i<positions.count;i++) {
      const x=positions.getX(i),y=positions.getY(i),h=positions.getZ(i);
      if(Math.abs(h-(z+depth/2))<1e-7&&Math.hypot(x,y)>radius)outer.set(`${x.toFixed(8)},${y.toFixed(8)}`,[x,y]);
    }
    const points=[...outer.values()].sort((a,b)=>{const angle=p=>(Math.PI/2-Math.atan2(p[1],p[0])+2*Math.PI)%(2*Math.PI);return angle(a)-angle(b);});
    let perimeter=0;for(let i=1;i<points.length;i++)perimeter+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
    if(fill===1)perimeter+=Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1]);
    assert.ok(Math.abs(perimeter-2*(radius+width/2)*64*Math.sin(Math.PI/64)*fill)<2e-6);
    const endpoint=polygonPoint(radius+width/2,fill,z+depth/2);
    assert.ok([...outer.values()].some(p=>Math.hypot(p[0]-endpoint[0],p[1]-endpoint[1])<1e-6));
    assert.equal(geometry.index,null);geometry.dispose();
  }
});

test('zero and missing polygon fills have no faces; tiny positive fills keep finite unit normals',()=>{
  for(const fill of [null,undefined,0,Number.EPSILON,8.088296104155976e-16,1e-10,.2,1]) {
    const geometry=bandGeometry(2.83,.065,.025,-.15,fill),p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
    assert.equal(p.count,n.count);assert.ok(p.array.every(Number.isFinite));assert.ok(n.array.every(Number.isFinite));
    if(!fill)assert.equal(p.count,0);else assert.ok(p.count>0);
    for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-6);
    geometry.dispose();
  }
  for(const value of [NaN,Infinity,-1,1.01])assert.throws(()=>bandGeometry(2.83,.065,.025,-.15,value),RangeError);
});

test('one difficulty rim, one hashrate rim, and eight static supports keep separate data and structure',()=>{
  const frames=[buildFrame(null,0),buildFrame(.4,.8)];
  assert.equal(frames[0].difficultyBand.getAttribute('position').count,0);assert.equal(frames[0].hashrateBand.getAttribute('position').count,0);
  for(const frame of frames) {
    assert.equal(frame.supportMatrices.length,8);
    assert.equal(frame.difficultyBacking.userData.fill,1);assert.equal(frame.hashrateBacking.userData.fill,1);
    for(const matrix of frame.supportMatrices){const a=new Vector3(0,-.5,0).applyMatrix4(matrix),b=new Vector3(0,.5,0).applyMatrix4(matrix);assert.ok(Math.abs(Math.hypot(a.x,a.y)-.7)<1e-12);assert.ok(Math.abs(Math.hypot(b.x,b.y)-2.83)<1e-12);assert.equal(a.z,-.12);assert.equal(b.z,-.12);assert.ok(Math.abs(new Vector3().setFromMatrixScale(matrix).z-.10)<1e-12);}
  }
  frames[0].supportMatrices.forEach((matrix,i)=>assert.ok(matrix.equals(frames[1].supportMatrices[i])));
  for(const frame of frames)for(const key of ['difficultyBand','hashrateBand','difficultyBacking','hashrateBacking'])frame[key].dispose();
});


test('solid rail backings physically join each tooth and both positive data bars',()=>{
  const blocks=Array.from({length:223},(_,i)=>[i,1e6,4e6,maxTransactions+1]),gear=buildGearGeometry(blocks,Array(223).fill(maxFees),maxTransactions,maxFees);
  assert.equal(gear.railMatrices.length,blocks.length);
  for(let i=0;i<blocks.length;i++){
    const rail=gear.railMatrices[i],p=new Vector3().setFromMatrixPosition(rail),scale=new Vector3().setFromMatrixScale(rail);
    assert.ok(Math.abs(p.z-.09)<1e-12);assert.ok(Math.abs(scale.y-.78)<1e-12);assert.ok(Math.abs(scale.z-.06)<1e-12);
    const endpoint=new Vector3(0,.5,0).applyMatrix4(rail),toothBase=new Vector3(0,-.5,0).applyMatrix4(gear.bodyMatrices[i]);
    assert.ok(Math.hypot(endpoint.x-toothBase.x,endpoint.y-toothBase.y)<1e-12);
    const rp=blockPose(i,blocks.length),radial=new Vector3(...rp.normal),tangent=new Vector3(...rp.tangent);
    for(const matrix of [gear.transactionMatrices[i],gear.feeMatrices[i]]){
      const bp=new Vector3().setFromMatrixPosition(matrix),bs=new Vector3().setFromMatrixScale(matrix);
      assert.ok(bp.z-bs.z/2<p.z+scale.z/2);assert.ok(bp.z+bs.z/2>p.z-scale.z/2);
      assert.ok(Math.abs(bp.dot(tangent))+bs.x/2<scale.x/2);
      assert.ok(bp.dot(radial)-bs.y/2>.72);assert.ok(bp.dot(radial)+bs.y/2<1.5);
    }
    assert.ok(p.z-scale.z/2<.09);
  }
  dispose(gear);
});
