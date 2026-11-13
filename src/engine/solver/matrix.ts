// ─────────────────────────────────────────────────────────────────────────────
// Matrix and linear solver utilities for Modified Nodal Analysis (MNA).
// Solves Ax = b using Gaussian elimination with partial pivoting.
// ─────────────────────────────────────────────────────────────────────────────

export class Matrix {
  readonly rows: number;
  readonly cols: number;
  readonly data: Float64Array;

  constructor(rows: number, cols: number, initialData?: number[] | Float64Array) {
    this.rows = rows;
    this.cols = cols;
    this.data = new Float64Array(rows * cols);
    if (initialData) {
      this.data.set(initialData);
    }
  }

  get(r: number, c: number): number {
    return this.data[r * this.cols + c];
  }

  set(r: number, c: number, value: number): void {
    this.data[r * this.cols + c] = value;
  }

  add(r: number, c: number, delta: number): void {
    this.data[r * this.cols + c] += delta;
  }

  clone(): Matrix {
    const m = new Matrix(this.rows, this.cols);
    m.data.set(this.data);
    return m;
  }

  clear(): void {
    this.data.fill(0);
  }
}

const EPSILON = 1e-12;

/**
 * Solves Ax = b using Gaussian elimination with partial pivoting.
 * Returns null if the matrix is singular or near-singular (e.g. floating nodes).
 */
export function solveLinearSystem(A: Matrix, b: Float64Array | number[]): Float64Array | null {
  const n = A.rows;
  if (A.cols !== n || b.length !== n) {
    throw new Error(`Dimension mismatch: A is ${A.rows}x${A.cols}, b is length ${b.length}`);
  }

  // Create working copies of A and b
  const aCopy = A.clone();
  const bCopy = new Float64Array(b);

  // Forward elimination with partial pivoting
  for (let k = 0; k < n; k++) {
    // Find pivot row
    let maxVal = Math.abs(aCopy.get(k, k));
    let pivotRow = k;
    for (let i = k + 1; i < n; i++) {
      const val = Math.abs(aCopy.get(i, k));
      if (val > maxVal) {
        maxVal = val;
        pivotRow = i;
      }
    }

    if (maxVal < EPSILON) {
      // Near-singular: could be a floating node or redundant equation
      return null;
    }

    // Swap rows if necessary
    if (pivotRow !== k) {
      for (let j = k; j < n; j++) {
        const temp = aCopy.get(k, j);
        aCopy.set(k, j, aCopy.get(pivotRow, j));
        aCopy.set(pivotRow, j, temp);
      }
      const tempB = bCopy[k];
      bCopy[k] = bCopy[pivotRow];
      bCopy[pivotRow] = tempB;
    }

    // Eliminate below
    const pivot = aCopy.get(k, k);
    for (let i = k + 1; i < n; i++) {
      const factor = aCopy.get(i, k) / pivot;
      aCopy.set(i, k, 0);
      for (let j = k + 1; j < n; j++) {
        aCopy.add(i, j, -factor * aCopy.get(k, j));
      }
      bCopy[i] -= factor * bCopy[k];
    }
  }

  // Back substitution
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = bCopy[i];
    for (let j = i + 1; j < n; j++) {
      sum -= aCopy.get(i, j) * x[j];
    }
    const diag = aCopy.get(i, i);
    if (Math.abs(diag) < EPSILON) {
      return null;
    }
    x[i] = sum / diag;
  }

  return x;
}

