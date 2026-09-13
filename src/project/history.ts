/**
 * Undo/redo (PRD §8's deferral, re-taken 2026-09-13).
 *
 * §8 deferred undo/redo when this was a 30-symbol single-sheet tool. At 67
 * symbols, multi-sheet, engineering lists and a numbering panel, a mis-drag
 * that deletes a pipe or silently renumbers a sheet is expensive to recover by
 * hand. So it is built now.
 *
 * ── THE HARD PART IS NOT THE STACK ──
 *
 * React Flow fires `onNodesChange` on EVERY mousemove during a drag, and its
 * `dimensions` change fires whenever a node is measured (i.e. on mount, on
 * every port edit, on zoom). A history that pushes per change gives one undo
 * step per pixel of mouse travel and a stack full of "nothing visibly
 * happened" entries. That is the classic broken-undo bug, and it is a
 * correctness problem rather than a polish one: undo becomes unusable exactly
 * when a user needs it.
 *
 * Two mechanisms handle it:
 *
 *   1. `isUndoableNodeChange` — a WHITELIST. Only `remove` and non-dragging
 *      `position` changes are undoable. `select` (fired on every click) and
 *      `dimensions` (fired on every measure) are deliberately excluded: they
 *      carry no user intent, and including `dimensions` would make the mount
 *      of a fresh sheet an undoable action.
 *
 *   2. MERGE KEYS. Every commit carries a key. A commit whose key matches the
 *      top of the stack, within MERGE_WINDOW_MS, REPLACES it instead of
 *      pushing. So a 400-event drag across the sheet is one entry, and typing
 *      `FIC-101` into a tag field is one entry rather than seven.
 *
 * A merge key is only valid within its time window, and any commit with a
 * different key seals the previous entry (so drag-then-rotate-then-drag gives
 * three entries, not one merged blob).
 *
 * The stack stores whole `Project` snapshots. The project is a plain
 * serializable object whose nodes/edges are replaced immutably by every
 * mutation in useProject, so snapshots share all unchanged substructure — the
 * memory cost is pointers, not deep copies. That is why snapshotting is
 * affordable here and why a diff-based scheme would be premature.
 */

/** Snapshots retained before the oldest is dropped. */
export const HISTORY_LIMIT = 100;

/**
 * How long a merge key stays open. Long enough to swallow a drag or a burst of
 * typing, short enough that a deliberate second action on the same target is a
 * separate undo step.
 */
export const MERGE_WINDOW_MS = 900;

/**
 * How long a node removal stays "open" for a cascading edge removal to merge
 * into it.
 *
 * Deleting a selected node with pipes attached makes React Flow emit a node
 * removal and an edge removal as two separate change batches. They are one
 * user gesture and must be one undo step — otherwise the first undo restores
 * the node while its pipes stay deleted, a state that never existed and that
 * the user cannot get out of by undoing again (they would then lose the node).
 *
 * The window only needs to cover the gap between two synchronous React Flow
 * callbacks, so it is deliberately short: a genuine second delete moments
 * later must still be its own step.
 */
export const REMOVAL_CASCADE_MS = 250;

export interface HistoryEntry<T> {
  /** The state BEFORE the change, i.e. what undo restores. */
  state: T;
  /** Identifies the gesture this entry belongs to; see the module note. */
  mergeKey: string;
  /** Timestamp of the most recent commit merged into this entry. */
  at: number;
}

export interface History<T> {
  past: HistoryEntry<T>[];
  future: T[];
}

export function createHistory<T>(): History<T> {
  return { past: [], future: [] };
}

/**
 * Record a new state. `previous` is the state being replaced — the thing undo
 * must restore — and `next` is only used to clear the redo stack.
 *
 * Merging: when `mergeKey` matches the newest entry and it is still within the
 * window, that entry is KEPT (its `state` already holds the pre-gesture
 * snapshot, which is precisely what undo should restore) and only its
 * timestamp is refreshed. Pushing instead would make the first pixel of a drag
 * the undo target, and the second pixel the undo target after that.
 */
export function record<T>(
  history: History<T>,
  previous: T,
  next: T,
  mergeKey: string,
  now: number,
  limit: number = HISTORY_LIMIT,
): History<T> {
  void next;
  const top = history.past[history.past.length - 1];
  if (top && top.mergeKey === mergeKey && now - top.at <= MERGE_WINDOW_MS) {
    const merged = [...history.past];
    merged[merged.length - 1] = { ...top, at: now };
    // A new action invalidates the redo branch even when it merges.
    return { past: merged, future: [] };
  }

  const past = [...history.past, { state: previous, mergeKey, at: now }];
  // Drop the oldest entries once over the limit, so a long session cannot grow
  // the stack without bound.
  while (past.length > limit) past.shift();
  return { past, future: [] };
}

/** Pop the newest entry, returning the state to restore and the new history. */
export function undo<T>(
  history: History<T>,
  current: T,
): { history: History<T>; state: T } | null {
  if (history.past.length === 0) return null;
  const past = [...history.past];
  const entry = past.pop() as HistoryEntry<T>;
  return {
    // The state being left behind becomes redoable.
    history: { past, future: [current, ...history.future] },
    state: entry.state,
  };
}

/** Re-apply the most recently undone state. */
export function redo<T>(
  history: History<T>,
  current: T,
): { history: History<T>; state: T } | null {
  if (history.future.length === 0) return null;
  const [state, ...rest] = history.future;
  // Re-push the state being replaced so undo can step back into it. The merge
  // key is tagged `redo:` and carries the stack depth, which makes it unique
  // per re-push: `record`'s merge branch can never fire on it, so a redo step
  // cannot be silently swallowed by an unrelated entry with a matching key.
  const key = `redo:${history.past.length}:${Date.now()}`;
  const past = [...history.past, { state: current, mergeKey: key, at: Date.now() }];
  return { history: { past, future: rest }, state };
}

/** Whether a React Flow node change represents user intent worth undoing. */
export function isUndoableNodeChange(change: { type?: string; dragging?: boolean }): boolean {
  // `remove` — the user deleted a node.
  if (change.type === 'remove') return true;
  // `position` — a move. During a drag these arrive continuously, so only the
  // FINAL change (dragging === false) is treated as the commit point. The
  // snapshot recorded at that moment is the pre-drag state, because the merge
  // key keeps the entry open across the whole gesture.
  if (change.type === 'position') return change.dragging !== true;
  // `select` and `dimensions` are excluded on purpose — see the module note.
  return false;
}

/** Whether an edge change represents user intent worth undoing. */
export function isUndoableEdgeChange(change: { type?: string }): boolean {
  // `select` fires on click and carries no intent; `remove` is the real one.
  return change.type === 'remove';
}

/**
 * Merge key for a node/edge removal.
 *
 * Deliberately contains NO timestamp. An earlier version embedded `Date.now()`,
 * which made the key unique per invocation — and that broke under
 * StrictMode, which double-invokes state updaters in development. The two
 * invocations only merged when they happened to land in the same millisecond,
 * so the number of undo steps a single delete produced depended on wall-clock
 * timing. Identity alone is the correct key: two distinct gestures cannot
 * delete the same id twice (the second delete has nothing to remove, and its
 * updater returns the input unchanged, so it never records). Consecutive
 * deletes of different items differ by id and stay separate steps.
 *
 * Gesture grouping is handled separately by the removal-cascade window in
 * REMOVAL_CASCADE_MS.
 */
export function removeKey(kind: 'node' | 'edge', id: string): string {
  return `remove:${kind}:${id}`;
}

/**
 * Merge key for a continuous edit to one target. Same target + same kind
 * within the window = one entry, which is what makes typing a tag one undo
 * step instead of one per keystroke.
 */
export function editKey(kind: 'node' | 'edge' | 'sheet' | 'numbering', id: string): string {
  return `edit:${kind}:${id}`;
}
