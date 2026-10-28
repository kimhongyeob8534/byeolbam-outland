// 별밤 아웃랜드 — 길드 방 중계 서버 (Cloudflare Worker + Durable Object)
// 게임 화면(public/index.html)은 Cloudflare가 그대로 내려주고,
// /ws?room=방이름 으로 들어온 웹소켓만 이 코드가 처리합니다.

const MAX_PLAYERS = 20;
const MAX_BOTS = 30;
const SIZES = ['s', 'm', 'l'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('웹소켓 전용 주소입니다.', { status: 426 });
      }
      const room = (url.searchParams.get('room') || 'byeolbam').slice(0, 20);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(room));
      return stub.fetch(request);
    }
    // 그 외 주소는 게임 파일로
    return env.ASSETS.fetch(request);
  },
};

export class Room {
  constructor(state, env) {
    this.state = state;
    this.players = new Map(); // id -> { ws, n, c, s, b }
    this.order = [];          // 입장 순서 (방장 승계용)
    this.host = null;
    this.phase = 'lobby';
    this.game = null;
    this.claimed = new Set();
    this.seq = 0;
  }

  async fetch(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.attach(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  attach(ws) {
    let id = null;
    ws.addEventListener('message', (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      if (!m || typeof m.t !== 'string') return;
      if (m.t === 'join') {
        if (id) return;
        if (this.players.size >= MAX_PLAYERS) {
          this.send(ws, { t: 'full' });
          try { ws.close(1000, 'full'); } catch {}
          return;
        }
        id = 'P' + (++this.seq) + Math.random().toString(36).slice(2, 6);
        const n = String(m.n || '데바').slice(0, 10);
        const c = Number.isInteger(m.c) ? m.c : 0;
        this.players.set(id, { ws, n, c, s: null, b: null });
        this.order.push(id);
        if (!this.host || !this.players.has(this.host)) this.host = id;
        this.send(ws, {
          t: 'welcome', id, now: Date.now(), host: this.host,
          phase: this.phase, game: this.phase === 'game' ? this.game : null,
        });
        this.broadcastLobby();
        return;
      }
      if (!id) return;
      this.onMsg(id, m);
    });
    const bye = () => { if (id) { const was = id; id = null; this.leave(was); } };
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);
  }

  onMsg(id, m) {
    const isHost = id === this.host;
    switch (m.t) {
      case 'st': {
        const out = { t: 'snap', p: {} };
        if (m.s) out.p[id] = m.s;
        if (isHost && Array.isArray(m.b)) out.b = m.b;
        if (m.s || out.b) this.broadcast(out, id);
        if (Array.isArray(m.e) && m.e.length) this.broadcast({ t: 'ev', e: m.e }, id);
        break;
      }
      case 'claim': {
        if (this.phase !== 'game') break;
        const i = m.i;
        if (i == null || this.claimed.has(i)) break;
        this.claimed.add(i);
        this.broadcast({ t: 'chest', i, by: m.by });
        break;
      }
      case 'start': {
        if (!isHost || this.phase === 'game') break;
        const bots = Math.max(0, Math.min(MAX_BOTS, (m.bots | 0)));
        const size = SIZES.includes(m.size) ? m.size : 'm';
        const roster = [...this.players.entries()].map(([pid, p]) => ({ id: pid, n: p.n, c: p.c }));
        this.game = { seed: (Math.random() * 1e9) | 0, startAt: Date.now() + 300, bots, roster, size };
        this.phase = 'game';
        this.claimed = new Set();
        this.broadcast({ t: 'start', now: Date.now(), game: this.game });
        break;
      }
      case 'tolobby': {
        if (!isHost) break;
        this.phase = 'lobby';
        this.game = null;
        this.claimed = new Set();
        this.broadcast({ t: 'tolobby' });
        this.broadcastLobby();
        break;
      }
    }
  }

  leave(id) {
    if (!this.players.has(id)) return;
    this.players.delete(id);
    this.order = this.order.filter((x) => x !== id);
    if (this.players.size === 0) {
      this.host = null; this.phase = 'lobby'; this.game = null; this.claimed = new Set();
      return;
    }
    this.broadcast({ t: 'leave', id });
    if (this.host === id) {
      this.host = this.order[0];
      this.broadcast({ t: 'host', id: this.host });
    }
    this.broadcastLobby();
  }

  broadcastLobby() {
    const players = [...this.players.entries()].map(([pid, p]) => ({ id: pid, n: p.n, c: p.c, h: pid === this.host }));
    this.broadcast({ t: 'lobby', players, host: this.host });
  }

  broadcast(msg, exceptId) {
    const data = JSON.stringify(msg);
    for (const [pid, p] of this.players) {
      if (pid === exceptId) continue;
      try { p.ws.send(data); } catch {}
    }
  }

  send(ws, msg) {
    try { ws.send(JSON.stringify(msg)); } catch {}
  }
}
