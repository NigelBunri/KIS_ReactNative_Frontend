import { runSerializedForSession } from '../e2ee';

// Regression coverage for the confirmed root cause of "some received
// messages, images, and files appear encrypted/unreadable": decryptFromUser
// is invoked via fire-and-forget loops over a whole batch of messages at
// once (conversation history load, gap-fill resync) with no protection
// against two of those decrypts — for the SAME sender/device session —
// racing on that session's loadSession -> advance-ratchet -> storeSession
// sequence. runSerializedForSession is the fix: every decrypt for a given
// session id now runs strictly one at a time, while decrypts for DIFFERENT
// sessions remain fully concurrent (no unnecessary cross-sender blocking).

describe('runSerializedForSession', () => {
  it('runs two jobs for the SAME session id strictly sequentially, never overlapping', async () => {
    const events: string[] = [];
    let secondStartedBeforeFirstFinished = false;

    const job1 = async () => {
      events.push('job1:start');
      await new Promise((r) => setTimeout(r, 20));
      events.push('job1:end');
      return 'job1-result';
    };
    const job2 = async () => {
      events.push('job2:start');
      if (!events.includes('job1:end')) secondStartedBeforeFirstFinished = true;
      await new Promise((r) => setTimeout(r, 1));
      events.push('job2:end');
      return 'job2-result';
    };

    const [result1, result2] = await Promise.all([
      runSerializedForSession('user-a.1', job1),
      runSerializedForSession('user-a.1', job2),
    ]);

    expect(secondStartedBeforeFirstFinished).toBe(false);
    expect(events).toEqual(['job1:start', 'job1:end', 'job2:start', 'job2:end']);
    expect(result1).toBe('job1-result');
    expect(result2).toBe('job2-result');
  });

  it('allows jobs for DIFFERENT session ids to run concurrently (no cross-sender blocking)', async () => {
    const events: string[] = [];

    const slowJob = async () => {
      events.push('slow:start');
      await new Promise((r) => setTimeout(r, 30));
      events.push('slow:end');
      return 'slow-result';
    };
    const fastJob = async () => {
      events.push('fast:start');
      await new Promise((r) => setTimeout(r, 1));
      events.push('fast:end');
      return 'fast-result';
    };

    const [slowResult, fastResult] = await Promise.all([
      runSerializedForSession('user-a.1', slowJob),
      runSerializedForSession('user-b.1', fastJob),
    ]);

    // The fast job for a DIFFERENT session must finish before the slow
    // one — proof they ran concurrently, not serialized against each other.
    expect(events.indexOf('fast:end')).toBeLessThan(events.indexOf('slow:end'));
    expect(slowResult).toBe('slow-result');
    expect(fastResult).toBe('fast-result');
  });

  it('a job that rejects does not permanently wedge later jobs for the same session', async () => {
    const failing = async () => {
      throw new Error('bad mac');
    };
    const succeeding = async () => 'ok';

    await expect(runSerializedForSession('user-c.1', failing)).rejects.toThrow('bad mac');
    await expect(runSerializedForSession('user-c.1', succeeding)).resolves.toBe('ok');
  });

  it('three concurrent jobs for the same session all run in submission order, never interleaved', async () => {
    const order: number[] = [];
    const makeJob = (n: number) => async () => {
      order.push(n);
      await new Promise((r) => setTimeout(r, 5));
      return n;
    };

    const results = await Promise.all([
      runSerializedForSession('user-d.1', makeJob(1)),
      runSerializedForSession('user-d.1', makeJob(2)),
      runSerializedForSession('user-d.1', makeJob(3)),
    ]);

    expect(order).toEqual([1, 2, 3]);
    expect(results).toEqual([1, 2, 3]);
  });
});
