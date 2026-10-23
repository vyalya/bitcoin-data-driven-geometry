import { BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three';
import type { BlockTuple } from '../types';
import {
  BLOCK_BASE_RADIUS, TRANSACTION_BASE_RADIUS, POLYGON_SIDES,
  blockPose, blockLength, transactionLength, feeLength, polygonPoint,
} from './model';
export type GearGeometry = {
  bodyMatrices: Matrix4[]; transactionMatrices: Matrix4[]; feeMatrices: Matrix4[]; railMatrices: Matrix4[];
  rails: BufferGeometry; links: BufferGeometry;
};
const vectorGeometry = (positions: number[]) => {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
};

/** Three aligned instance arrays share the exact compact-record index. */
export function buildGearGeometry(blocks: readonly BlockTuple[], feesSat: readonly (number | null)[], maxNonCoinbase: number, maxBlockFeesSat: number): GearGeometry {
  if (feesSat.length !== blocks.length) throw new Error('Gear fees must match block count and order');
  const bodyMatrices: Matrix4[] = [], transactionMatrices: Matrix4[] = [], feeMatrices: Matrix4[] = [], railMatrices: Matrix4[] = [];
  const railPositions: number[] = [], linkPositions: number[] = [], linkPairs: [number, number][] = [];
  const count = blocks.length;
  const bodyWidth = Math.min(.10, 2 * Math.PI * BLOCK_BASE_RADIUS / count * .58);
  const metricWidth = Math.min(.025, 2 * Math.PI * TRANSACTION_BASE_RADIUS / count * .24);
  const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3(), zAxis = new Vector3(0, 0, 1);
  blocks.forEach((block, i) => {
    const pose = blockPose(i, count), radial = new Vector3(...pose.normal), tangent = new Vector3(...pose.tangent);
    const length = blockLength(block[2]);
    rotation.setFromAxisAngle(zAxis, pose.angle - Math.PI / 2);
    position.copy(radial).multiplyScalar(BLOCK_BASE_RADIUS + length / 2);
    bodyMatrices.push(new Matrix4().compose(position, rotation, scale.set(bodyWidth, length, .18)));
    const lengths = [transactionLength(block[3], maxNonCoinbase) ?? 0, feeLength(feesSat[i], maxBlockFeesSat) ?? 0];
    lengths.forEach((barLength, j) => {
      position.copy(radial).multiplyScalar(TRANSACTION_BASE_RADIUS + barLength / 2)
        .addScaledVector(tangent, (j === 0 ? -1 : 1) * metricWidth * .8);
      position.z = .14;
      // Collapse every axis: a zero-height box otherwise retains an XZ face
      // that can appear when viewed edge-on, despite representing no observation.
      const matrix = new Matrix4().compose(position, rotation, barLength > 0 ? scale.set(metricWidth, barLength, .045) : scale.setScalar(0));
      (j === 0 ? transactionMatrices : feeMatrices).push(matrix);
    });
    position.copy(radial).multiplyScalar((.72 + BLOCK_BASE_RADIUS) / 2); position.z = .09;
    railMatrices.push(new Matrix4().compose(position, rotation, scale.set(metricWidth * 3, BLOCK_BASE_RADIUS - .72, .06)));
    // The center trace sits just above its solid backing and between the bars.
    for (const radius of [.72, BLOCK_BASE_RADIUS]) railPositions.push(radial.x * radius, radial.y * radius, .122);
    if (i > 0 && Number.isSafeInteger(block[0]) && Number.isSafeInteger(blocks[i - 1][0]) && blocks[i - 1][0] >= 0 && block[0] === blocks[i - 1][0] + 1) {
      const previousAngle = blockPose(i - 1, count).angle;
      for (let segment = 0; segment < 4; segment++) {
        for (const t of [segment / 4, (segment + 1) / 4]) {
          const angle = previousAngle + (pose.angle - previousAngle) * t;
          linkPositions.push(BLOCK_BASE_RADIUS * Math.cos(angle), BLOCK_BASE_RADIUS * Math.sin(angle), 0);
        }
        linkPairs.push([i - 1, i]);
      }
    }
  });
  const rails = vectorGeometry(railPositions), links = vectorGeometry(linkPositions);
  rails.userData.blockIndices = blocks.map((_, index) => index);
  links.userData.blockPairs = linkPairs;
  return { bodyMatrices, transactionMatrices, feeMatrices, railMatrices, rails, links };
}

/** Flat-sided extruded annular prefix. Width is radial; fill measures the
 * centerline perimeter of a regular 64-gon, never a rounded orbit or ring count.
 */
export function bandGeometry(radius: number, width: number, depth: number, z: number, fill: number | null | undefined): BufferGeometry {
  if (![radius, width, depth, z].every(Number.isFinite) || radius <= 0 || width <= 0 || width >= 2 * radius || depth <= 0) throw new RangeError('Invalid polygon band dimensions');
  if (fill != null && (!Number.isFinite(fill) || fill < 0 || fill > 1)) throw new RangeError('Polygon fill must be between zero and one');
  const fraction = fill ?? 0, positions: number[] = [], normals: number[] = [];
  const geometry = new BufferGeometry(), segmentFractions: number[] = [];
  const inner = radius - width / 2, outer = radius + width / 2;
  const top = z + depth / 2, bottom = z - depth / 2;
  const point = (r: number, f: number, height: number) => { const p = polygonPoint(r, f); return new Vector3(p[0], p[1], height); };
  const quad = (a: Vector3, b: Vector3, c: Vector3, d: Vector3, outward: Vector3) => {
    const winding = b.clone().sub(a).cross(c.clone().sub(a)).dot(outward);
    const vertices = winding < 0 ? [a, d, c, a, c, b] : [a, b, c, a, c, d];
    for (const p of vertices) { positions.push(p.x, p.y, p.z); normals.push(outward.x, outward.y, outward.z); }
  };
  const totalSides = fraction * POLYGON_SIDES;
  for (let side = 0; side < Math.ceil(totalSides); side++) {
    const part = Math.min(1, totalSides - side), start = side / POLYGON_SIDES, end = (side + part) / POLYGON_SIDES;
    segmentFractions.push(part);
    const i0 = point(inner, start, top), i1 = point(inner, end, top), o0 = point(outer, start, top), o1 = point(outer, end, top);
    const ib0 = point(inner, start, bottom), ib1 = point(inner, end, bottom), ob0 = point(outer, start, bottom), ob1 = point(outer, end, bottom);
    const angle = Math.PI / 2 - (side + .5) * 2 * Math.PI / POLYGON_SIDES;
    const outward = new Vector3(Math.cos(angle), Math.sin(angle), 0);
    quad(i0, o0, o1, i1, new Vector3(0, 0, 1));
    quad(ib0, ib1, ob1, ob0, new Vector3(0, 0, -1));
    quad(o0, ob0, ob1, o1, outward);
    quad(i0, i1, ib1, ib0, outward.clone().negate());
    if (fraction < 1 && side === 0) quad(i0, ib0, ob0, o0, new Vector3(-1, 0, 0));
    if (fraction < 1 && side === Math.ceil(totalSides) - 1) {
      const p = polygonPoint(radius, end), tangent = new Vector3(p[1], -p[0], 0).normalize();
      quad(i1, o1, ob1, ib1, tangent);
    }
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.userData.fill = fraction;
  geometry.userData.segmentFractions = segmentFractions;
  geometry.userData.perimeterLength = 2 * radius * POLYGON_SIDES * Math.sin(Math.PI / POLYGON_SIDES) * fraction;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function buildFrame(difficulty: number | null | undefined, hashrate: number | null | undefined) {
  const supportMatrices: Matrix4[] = [], zAxis = new Vector3(0, 0, 1);
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI / 2 - i * Math.PI / 4;
    const position = new Vector3(Math.cos(angle), Math.sin(angle), 0).multiplyScalar((.7 + 2.83) / 2); position.z = -.12;
    supportMatrices.push(new Matrix4().compose(position, new Quaternion().setFromAxisAngle(zAxis, angle - Math.PI / 2), new Vector3(.026, 2.83 - .7, .10)));
  }
  return {
    difficultyBand: bandGeometry(2.55, .045, .025, -.08, difficulty),
    hashrateBand: bandGeometry(2.83, .065, .025, -.15, hashrate),
    difficultyBacking: bandGeometry(2.55, .045, .01, -.105, 1),
    hashrateBacking: bandGeometry(2.83, .065, .01, -.175, 1),
    supportMatrices,
  };
}
