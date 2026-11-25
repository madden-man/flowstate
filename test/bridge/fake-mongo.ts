// An in-memory stand-in for the few MongoDB driver calls the bridge makes (netlify/lib/bridge.ts CollLike). It
// remembers every database and collection it was asked for, so a test can assert the function stayed inside the two
// databases and the `bridge_` prefix. Filters understood: {}, { _id }, { _id, rev: { $lt } }. No real connection.
import type { ClientLike, CollLike } from '../../netlify/lib/bridge';

type Doc = Record<string, unknown>;

export class FakeMongo implements ClientLike {
  data = new Map<string, Map<string, Doc>>();
  touched: { db: string; coll: string; op: string }[] = [];

  rows(db: string, coll: string): Map<string, Doc> {
    const k = `${db}.${coll}`;
    if (!this.data.has(k)) this.data.set(k, new Map());
    return this.data.get(k)!;
  }
  seed(db: string, coll: string, docs: Doc[]) { for (const d of docs) this.rows(db, coll).set(String(d._id), structuredClone(d)); }

  db(name: string) {
    return {
      collection: (coll: string): CollLike => {
        const note = (op: string) => this.touched.push({ db: name, coll, op });
        const rows = () => this.rows(name, coll);
        const match = (d: Doc, f: Doc) => Object.entries(f).every(([k, v]) => {
          if (v && typeof v === 'object' && '$lt' in (v as Doc)) return typeof d[k] === 'number' && (d[k] as number) < ((v as Doc).$lt as number);
          return d[k] === v;
        });
        return {
          findOne: async f => { note('findOne'); const d = [...rows().values()].find(d => match(d, f)); return d ? structuredClone(d) : null; },
          find: f => ({ toArray: async () => { note('find'); return [...rows().values()].filter(d => match(d, f)).map(d => structuredClone(d)); } }),
          updateOne: async (f, u) => {
            note('updateOne');
            const d = [...rows().values()].find(d => match(d, f));
            if (!d) return { matchedCount: 0 };
            Object.assign(d, structuredClone((u as { $set: Doc }).$set));
            return { matchedCount: 1 };
          },
          insertOne: async doc => {
            note('insertOne');
            const id = String(doc._id);
            if (rows().has(id)) throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
            rows().set(id, structuredClone(doc));
            return { insertedId: id };
          },
        };
      },
    };
  }
}
