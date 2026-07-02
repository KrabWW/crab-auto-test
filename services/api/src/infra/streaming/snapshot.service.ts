import { Injectable } from "@nestjs/common";
import type { StreamEnvelope } from "@crab/shared-types";

/**
 * R8 snapshot service.
 *
 * On reconnect, clients GET the authoritative current state (this service),
 * NOT a server-side per-event replay buffer (§11 b′3). `seq` is ordering-only.
 *
 * Events are buffered per active run/execution ONLY for live subscribers and
 * discarded once the run/execution reaches a terminal state. There is no
 * durable replay log.
 */
@Injectable()
export class SnapshotService {
  private readonly live = new Map<string, StreamEnvelope[]>();
  private readonly subscribers = new Map<string, Set<(e: StreamEnvelope) => void>>();

  /** Append a live event for current subscribers (not a durable replay log). */
  append(targetId: string, env: StreamEnvelope): void {
    const buf = this.live.get(targetId);
    if (buf) {
      buf.push(env);
      if (buf.length > 200) buf.shift(); // bounded live window only
    }
    const subs = this.subscribers.get(targetId);
    if (subs) for (const cb of subs) cb(env);
  }

  register(targetId: string): void {
    if (!this.live.has(targetId)) this.live.set(targetId, []);
  }

  /** Subscribe to live appends. Returns an unsubscribe function. */
  subscribe(targetId: string, cb: (e: StreamEnvelope) => void): () => void {
    let subs = this.subscribers.get(targetId);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(targetId, subs);
    }
    subs.add(cb);
    return () => {
      subs!.delete(cb);
      if (subs!.size === 0) this.subscribers.delete(targetId);
    };
  }

  release(targetId: string): void {
    this.live.delete(targetId);
    this.subscribers.delete(targetId);
  }

  /** Authoritative snapshot for reconnect (R8). */
  snapshot(targetId: string): StreamEnvelope[] {
    return [...(this.live.get(targetId) ?? [])];
  }

  nextSeq(targetId: string): number {
    return (this.live.get(targetId)?.length ?? 0) + 1;
  }
}
