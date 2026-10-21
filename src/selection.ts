// Blocks within the same nucleus are distinct selections, not one toggle.
export function sameSelection(a:{type:string;block?:readonly number[]},b:{type:string;block?:readonly number[]}) {
  return a.type===b.type && (a.type!=='block'||a.block?.[0]===b.block?.[0]);
}
