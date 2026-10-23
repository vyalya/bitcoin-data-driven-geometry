import {Vector3} from 'three';
import {randomFor} from '../metrics';
// Stipple positions are illustrative, not observed locations or payment paths.
export function addressPoint(index:number,target=new Vector3()) {
  const radius=.64*Math.sqrt(randomFor(index,0)),angle=randomFor(index,1)*Math.PI*2;
  return target.set(radius*Math.cos(angle),radius*Math.sin(angle),.105);
}
