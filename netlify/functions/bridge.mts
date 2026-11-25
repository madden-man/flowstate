// The bridge (PLAN-WORLDS.md section 5, W2): the one Netlify function on the FlowState site, and the only thing on the
// web that holds the Atlas string. The phone reaches it same origin at /.netlify/functions/bridge.
//
// Environment (set on the site, for functions): BRIDGE_MONGODB_URI, an Atlas user that may read and write only the
// `bridge_` collections of novel_companion and music_companion (docs/BRIDGE.md has the role, unverified), and
// BRIDGE_TOKEN, the bearer the phone pastes in Settings. Without the token every answer is 401 and nothing is touched.
//
// The handler is netlify/lib/bridge.ts; the protocol is src/bridge/protocol.ts.
import { MongoClient } from 'mongodb';
import { handle, type ClientLike } from '../lib/bridge.ts';

// One client a warm instance, connected on the first request that passes the token check.
let client: Promise<MongoClient> | null = null;
const connect = (uri: string): Promise<ClientLike> => {
  client ??= new MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 5000 }).connect().catch(e => { client = null; throw e; });
  return client as unknown as Promise<ClientLike>;
};

export default async (req: Request): Promise<Response> => {
  const env = { BRIDGE_TOKEN: process.env.BRIDGE_TOKEN, BRIDGE_MONGODB_URI: process.env.BRIDGE_MONGODB_URI };
  try {
    return await handle(req, { env, client: () => connect(env.BRIDGE_MONGODB_URI!) });
  } catch (e) {
    console.error('bridge', e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ error: 'failed' }), { status: 502, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
};
