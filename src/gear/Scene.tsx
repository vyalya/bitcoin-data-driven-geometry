import { createContext, useContext, useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { NetworkSnapshot, BlockTuple } from '../types';
import type { GearData } from './data';
import { buildGearGeometry, buildFrame } from './geometry';
import { relationshipGroups } from './relationships';
import { normalized, difficultyFill } from '../metrics';
import { addressPoint } from './presentation';

export const GearDataContext = createContext<GearData | null>(null);
type Props = {
  snapshot:NetworkSnapshot; blocks?:BlockTuple[]; activeGroup?:string|null;
  selectedBlockIndex?:number; mini?:boolean; opacity?:number;
  onHover?:(id:string|null)=>void; onClick?:(id:string)=>void;
  onBlockHover?:(block:BlockTuple|null,index:number)=>void;
  onRingHover?:(type:string|null)=>void;
  onMetricBlockHover?:(type:'transactions'|'fees-total',block:BlockTuple,index:number)=>void;
};
const noRaycast=()=>{};
export function GearShape(props:Props) {
  const data=useContext(GearDataContext),day=data?.days[props.snapshot.snapshotTime.slice(0,10)];
  if(!data||!day||(props.blocks??props.snapshot.blocks??[]).length!==day.heights.length)return null;
  return <GearLoaded {...props} data={data} fees={day.feesSat}/>;
}
function GearLoaded({snapshot:s,blocks=s.blocks??[],data,fees,activeGroup=null,selectedBlockIndex=-1,
  mini=false,opacity=1,onHover,onClick,onBlockHover,onRingHover,onMetricBlockHover}:Props&{data:GearData;fees:(number|null)[]}) {
  const core=useMemo(()=>buildGearGeometry(blocks,fees,data.maxNonCoinbase,data.maxBlockFeesSat),[blocks,fees,data]);
  const frame=useMemo(()=>buildFrame(difficultyFill(s.difficulty,s.scales.difficulty),normalized(s.networkHashrateEh,s.scales.hashrateEh)),[s]);
  const toothGeo=useMemo(()=>new RoundedBoxGeometry(1,1,1,mini?1:2,.055),[mini]);
  const body=useRef<THREE.InstancedMesh>(null),tx=useRef<THREE.InstancedMesh>(null),fee=useRef<THREE.InstancedMesh>(null),support=useRef<THREE.InstancedMesh>(null),rails=useRef<THREE.InstancedMesh>(null);
  const related=relationshipGroups(activeGroup);
  const strength=(id:string)=>!activeGroup||activeGroup===id?1:related.includes(id)?.88:.22;
  useEffect(()=>()=>{core.rails.dispose();core.links.dispose();},[core]);
  useEffect(()=>()=>{frame.difficultyBand.dispose();frame.hashrateBand.dispose();frame.difficultyBacking.dispose();frame.hashrateBacking.dispose();},[frame]);
  useEffect(()=>()=>toothGeo.dispose(),[toothGeo]);
  useLayoutEffect(()=>{
    const meshes=[body.current,tx.current,fee.current];
    if(meshes.some(m=>!m))return;
    const matrices=[core.bodyMatrices,core.transactionMatrices,core.feeMatrices];
    const colors=['#f7931a','#e8c386','#ef8b32'];
    meshes.forEach((mesh,j)=>{
      matrices[j].forEach((matrix,i)=>{mesh!.setMatrixAt(i,matrix);mesh!.setColorAt(i,new THREE.Color(i===selectedBlockIndex?'#fff5d7':colors[j]));});
      mesh!.instanceMatrix.needsUpdate=true;
      if(mesh!.instanceColor)mesh!.instanceColor.needsUpdate=true;
      mesh!.computeBoundingSphere();
    });
    if(rails.current){
      core.railMatrices.forEach((m,i)=>{rails.current!.setMatrixAt(i,m);rails.current!.setColorAt(i,new THREE.Color(i===selectedBlockIndex?'#dba45c':'#464037'));});
      rails.current.instanceMatrix.needsUpdate=true;
      if(rails.current.instanceColor)rails.current.instanceColor.needsUpdate=true;
      rails.current.computeBoundingSphere();
    }
    const traceColors=new Float32Array(core.rails.getAttribute('position').count*3);
    for(let i=0;i<blocks.length;i++){
      const color=new THREE.Color(i===selectedBlockIndex?'#fff2cb':'#70604d');
      color.toArray(traceColors,i*6);color.toArray(traceColors,i*6+3);
    }
    core.rails.setAttribute('color',new THREE.BufferAttribute(traceColors,3));
  },[core,selectedBlockIndex]);
  useLayoutEffect(()=>{
    if(!support.current)return;
    frame.supportMatrices.forEach((m,i)=>support.current!.setMatrixAt(i,m));
    support.current.instanceMatrix.needsUpdate=true;support.current.computeBoundingSphere();
  },[frame]);
  const leave=()=>{onHover?.(null);onRingHover?.(null);};
  const inspect=(e:ThreeEvent<PointerEvent|MouseEvent>,id:'spine'|'transactions'|'fees-total',click=false)=>{
    e.stopPropagation();if(click&&e.delta>5)return;
    const i=e.instanceId;if(i===undefined||!blocks[i])return;
    onHover?.(id);
    if(id==='spine')onBlockHover?.(blocks[i],i);else onMetricBlockHover?.(id,blocks[i],i);
    if(click)onClick?.(id);
  };
  const events=(id:'spine'|'transactions'|'fees-total')=>mini?{}:{onPointerMove:(e:ThreeEvent<PointerEvent>)=>inspect(e,id),onPointerOut:leave,onClick:(e:ThreeEvent<MouseEvent>)=>inspect(e,id,true)};
  const metricEvents=(id:string,type=id)=>mini?{}:{
    onPointerOver:(e:ThreeEvent<PointerEvent>)=>{e.stopPropagation();onHover?.(id);onRingHover?.(type);},
    onPointerOut:leave,
    onClick:(e:ThreeEvent<MouseEvent>)=>{e.stopPropagation();if(e.delta>5)return;onHover?.(id);onRingHover?.(type);onClick?.(id);}
  };
  const count=Math.min(Math.floor((s.activeAddresses??0)/(mini?s.scales.gridAddressesPerParticle:s.scales.detailAddressesPerParticle)),mini?180:1500);
  const dots=useMemo(()=>{
    const positions=new Float32Array(count*3);
    for(let i=0;i<count;i++)addressPoint(i).toArray(positions,i*3);
    return positions;
  },[count]);
  return <group>
    {/* Graphite structure joins all data-bearing pieces. It encodes no quantity. */}
    <instancedMesh ref={support} args={[undefined,undefined,frame.supportMatrices.length]} raycast={noRaycast}>
      <boxGeometry args={[1,1,1]}/><meshStandardMaterial color="#5b5144" roughness={.7} metalness={.15} transparent opacity={opacity*.65}/>
    </instancedMesh>
    <mesh geometry={frame.difficultyBacking} raycast={noRaycast}><meshStandardMaterial color="#3d3831" roughness={.8} transparent opacity={opacity*.75}/></mesh>
    <mesh geometry={frame.hashrateBacking} raycast={noRaycast}><meshStandardMaterial color="#3d3831" roughness={.8} transparent opacity={opacity*.75}/></mesh>
    <mesh rotation={[Math.PI/2,0,0]} position={[0,0,-.03]} raycast={noRaycast}>
      <cylinderGeometry args={[.75,.75,.24,mini?32:64]}/><meshStandardMaterial color="#292722" metalness={.15} roughness={.7} transparent opacity={opacity}/>
    </mesh>
    <instancedMesh key={`rails${blocks.length}`} ref={rails} args={[undefined,undefined,blocks.length]} raycast={noRaycast}>
      <boxGeometry args={[1,1,1]}/><meshStandardMaterial color="white" metalness={.1} roughness={.85} transparent opacity={opacity*.8}/>
    </instancedMesh>
    <lineSegments geometry={core.rails} raycast={noRaycast}><lineBasicMaterial vertexColors transparent opacity={opacity*.65}/></lineSegments>
    <lineSegments geometry={core.links} raycast={noRaycast}><lineBasicMaterial color="#e7a454" transparent opacity={opacity*strength('spine')*.9}/></lineSegments>
    <instancedMesh key={`body${blocks.length}`} ref={body} args={[toothGeo,undefined,blocks.length]} raycast={mini?noRaycast:undefined} {...events('spine')}>
      <meshStandardMaterial color="white" emissive="#ee8b24" emissiveIntensity={activeGroup==='spine'?.16:.055} metalness={.13} roughness={.58} transparent={opacity*strength('spine')<1} opacity={opacity*strength('spine')}/>
    </instancedMesh>
    <instancedMesh key={`tx${blocks.length}`} ref={tx} args={[undefined,undefined,blocks.length]} raycast={mini?noRaycast:undefined} {...events('transactions')}>
      <boxGeometry args={[1,1,1]}/><meshStandardMaterial color="white" emissive="#e8c386" emissiveIntensity={activeGroup==='transactions'?.28:.13} roughness={.58} transparent opacity={opacity*strength('transactions')}/>
    </instancedMesh>
    <instancedMesh key={`fee${blocks.length}`} ref={fee} args={[undefined,undefined,blocks.length]} raycast={mini?noRaycast:undefined} {...events('fees-total')}>
      <boxGeometry args={[1,1,1]}/><meshStandardMaterial color="white" emissive="#ef8b32" emissiveIntensity={activeGroup==='fees-total'?.3:.15} roughness={.55} transparent opacity={opacity*strength('fees-total')}/>
    </instancedMesh>
    <mesh geometry={frame.difficultyBand} raycast={mini?noRaycast:undefined} {...metricEvents('difficulty')}>
      <meshStandardMaterial color="#e6b164" emissive="#e6b164" emissiveIntensity={related.includes('difficulty')?.18:.06} metalness={.12} roughness={.55} transparent opacity={opacity*strength('difficulty')}/>
    </mesh>
    <mesh geometry={frame.hashrateBand} raycast={mini?noRaycast:undefined} {...metricEvents('hashrate')}>
      <meshStandardMaterial color="#f7931a" emissive="#f7931a" emissiveIntensity={related.includes('hashrate')?.18:.06} metalness={.12} roughness={.55} transparent opacity={opacity*strength('hashrate')}/>
    </mesh>
    {count>0&&<points raycast={mini?noRaycast:undefined} {...metricEvents('particles','addresses')}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[dots,3]}/></bufferGeometry>
      <pointsMaterial color={activeGroup==='particles'?'#fff7df':'#e3bd81'} size={mini?.025:.014} sizeAttenuation transparent opacity={opacity*strength('particles')*.9} depthWrite={false}/>
    </points>}
  </group>;
}
