export const THRESHOLD: number
export class VisualCompareError extends Error {}

export interface Region {
  y0: number
  y1: number
}
export interface PairSpec {
  stage: string
  name: string
  reference?: string
  region?: Region
  actual?: Region
  reference_region?: Region
  windows?: number
  allowHeightDelta?: number
  note?: string
}
export interface PairResult {
  id: string
  percent: number
  width: number
  actual: { height: number; region: Region }
  reference: { height: number; region: Region }
  fullDelta: number
  note: string | null
}
export interface GeometrySpec {
  stage?: string
  name: string
  tolerance?: number
  blocks: { name: string; y: number; height: number }[]
}
export interface GeometryRow {
  name: string
  expected: { y: number; height: number }
  actual: { y: number; height: number }
  dy: number
  dh: number
  differs: boolean
}

export function comparePair(spec: PairSpec, root: string, options?: { write?: boolean }): PairResult
export function expandWindows(
  spec: PairSpec,
  root: string,
): { specs: PairSpec[]; uncovered: { delta: number; side: string; pixels: number } | null }
export function compareGeometry(
  spec: GeometrySpec,
  measured: Record<string, { y: number; height: number }>,
): GeometryRow[]
