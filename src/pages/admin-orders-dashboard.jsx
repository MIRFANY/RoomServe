import { useState, useEffect, useRef, useCallback } from "react";
import { collection, onSnapshot, updateDoc, doc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const SC = {
  pending:   { label: "New Order",  color: "#d4a017", bg: "#2a2208", border: "#d4a01733", dot: "#f0c040", pulse: true  },
  accepted:  { label: "Accepted",   color: "#4caf82", bg: "#0a2018", border: "#4caf8233", dot: "#4caf82", pulse: false },
  preparing: { label: "Preparing",  color: "#5b9bd5", bg: "#0a1828", border: "#5b9bd533", dot: "#5b9bd5", pulse: true  },
  ready:     { label: "Ready",      color: "#a67dc8", bg: "#1a0a28", border: "#a67dc833", dot: "#a67dc8", pulse: false },
  delivered: { label: "Delivered",  color: "#666",    bg: "#1a1a14", border: "#66666633", dot: "#666",    pulse: false },
  rejected:  { label: "Rejected",   color: "#c47a7a", bg: "#1e0a0a", border: "#c47a7a33", dot: "#c47a7a", pulse: false },
  settled:   { label: "Settled",    color: "#444",    bg: "#111108", border: "#44444433", dot: "#444",    pulse: false },
};

function createBeep(ctx) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
}

function elapsed(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

function OrderCard({ order, onAccept, onReject, onAdvance, isNew }) {
  const sc = SC[order.status] || SC.pending;
  const [expanded, setExpanded] = useState(order.status === "pending");
  return (
    <div style={{ background: "#0f0d08", border: `1px solid ${isNew ? "#c9a84c" : sc.border}`, borderLeft: `4px solid ${sc.dot}`, marginBottom: 14, transition: "all .4s", animation: isNew ? "newOrderIn .5s ease" : "none", position: "relative", overflow: "hidden" }}>
      {isNew && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at top left, #c9a84c08, transparent 60%)", pointerEvents: "none" }} />}
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ background: sc.bg, border: `1px solid ${sc.border}`, padding: "8px 12px", textAlign: "center", minWidth: 56 }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase" }}>Room</div>
            <div style={{ fontSize: 20, fontWeight: 600, color: sc.color, lineHeight: 1.1 }}>{order.roomNumber}</div>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#e8e0d0", marginBottom: 3 }}>{order.guestName}</div>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, color: "#555" }}>{order.id?.slice(-8)} · {elapsed(order.createdAt)}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: sc.bg, border: `1px solid ${sc.border}`, padding: "5px 11px" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: sc.dot, flexShrink: 0, animation: sc.pulse ? "dotPulse 1.4s infinite" : "none" }} />
            <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, fontWeight: 600, color: sc.color, letterSpacing: 1, textTransform: "uppercase" }}>{sc.label}</span>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, color: "#555" }}>Total</div>
            <div style={{ fontSize: 16, color: "#c9a84c" }}>₹{order.total?.toLocaleString()}</div>
          </div>
          <div style={{ color: "#444", fontSize: 12, transition: "transform .3s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</div>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: "1px solid #1a1812", animation: "expandIn .25s ease" }}>
          <div style={{ padding: "14px 18px" }}>
            <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, letterSpacing: 3, color: "#555", textTransform: "uppercase", marginBottom: 12 }}>Order Items</div>
            {order.items?.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #151310" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{item.image}</span>
                  <div>
                    <div style={{ fontSize: 14, color: "#e8e0d0" }}>{item.name}</div>
                    <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 10, color: "#555" }}>×{item.qty}</div>
                  </div>
                </div>
                <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 13, color: "#c9a84c" }}>₹{item.subtotal?.toLocaleString()}</div>
              </div>
            ))}
          </div>
          {order.status === "pending" && (
            <div style={{ padding: "0 18px 16px", display: "flex", gap: 10 }}>
              <button onClick={() => onReject(order.id)} style={{ flex: 1, padding: "11px", background: "#1e0a0a", border: "1px solid #c47a7a33", color: "#c47a7a", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>✕ Reject</button>
              <button onClick={() => onAccept(order.id)} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg,#c9a84c,#9a7830)", border: "none", color: "#0a0a06", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>✓ Accept Order</button>
            </div>
          )}
          {order.status === "accepted" && (
            <div style={{ padding: "0 18px 16px" }}>
              <button onClick={() => onAdvance(order.id, "preparing")} style={{ width: "100%", padding: "11px", background: "#0a1828", border: "1px solid #5b9bd533", color: "#5b9bd5", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>🍽 Mark as Preparing</button>
            </div>
          )}
          {order.status === "preparing" && (
            <div style={{ padding: "0 18px 16px" }}>
              <button onClick={() => onAdvance(order.id, "ready")} style={{ width: "100%", padding: "11px", background: "#1a0a28", border: "1px solid #a67dc833", color: "#a67dc8", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>🛎 Mark as Ready</button>
            </div>
          )}
          {order.status === "ready" && (
            <div style={{ padding: "0 18px 16px" }}>
              <button onClick={() => onAdvance(order.id, "delivered")} style={{ width: "100%", padding: "11px", background: "#0a1808", border: "1px solid #4caf8233", color: "#4caf82", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>✅ Mark as Delivered</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminOrdersDashboard({ hotelId }) {
  const [orders, setOrders] = useState([]);
  const [newOrderIds, setNewOrderIds] = useState(new Set());
  const [filter, setFilter] = useState("all");
  const [beepActive, setBeepActive] = useState(false);
  const [beepMuted, setBeepMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prevOrderIds, setPrevOrderIds] = useState(new Set());
  const audioCtxRef = useRef(null);
  const beepIntervalRef = useRef(null);

  // ── Firestore path uses hotelId ──
  const ordersPath = `hotels/${hotelId}/orders`;

  const getCtx = () => { if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)(); return audioCtxRef.current; };
  const stopBeep = useCallback(() => { setBeepActive(false); clearInterval(beepIntervalRef.current); }, []);
  const startBeep = useCallback(() => {
    if (beepMuted) return;
    setBeepActive(true);
    try { createBeep(getCtx()); } catch(e) {}
    beepIntervalRef.current = setInterval(() => { try { createBeep(getCtx()); } catch(e) {} }, 1800);
  }, [beepMuted]);

  useEffect(() => {
    if (!hotelId) return;
    const q = query(collection(db, ordersPath), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      const incoming = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const incomingIds = new Set(incoming.map(o => o.id));
      const brandNew = incoming.filter(o => o.status === "pending" && !prevOrderIds.has(o.id));
      if (brandNew.length > 0) {
        const newIds = new Set(brandNew.map(o => o.id));
        setNewOrderIds(prev => new Set([...prev, ...newIds]));
        setTimeout(() => setNewOrderIds(prev => { const next = new Set(prev); newIds.forEach(id => next.delete(id)); return next; }), 4000);
      }
      setPrevOrderIds(incomingIds);
      setOrders(incoming);
      setLoading(false);
    });
    return () => unsub();
  }, [hotelId]);

  useEffect(() => {
    const hasPending = orders.some(o => o.status === "pending");
    if (hasPending && !beepMuted) { if (!beepActive) startBeep(); }
    else stopBeep();
  }, [orders, beepMuted]);

  const updateStatus = async (id, status) => {
    const data = { status };
    if (status === "accepted") data.acceptedAt = serverTimestamp();
    if (status === "delivered") data.deliveredAt = serverTimestamp();
    await updateDoc(doc(db, ordersPath, id), data);
  };

  const onAccept  = id => updateStatus(id, "accepted");
  const onReject  = id => updateStatus(id, "rejected");
  const onAdvance = (id, status) => updateStatus(id, status);

  const filtered = orders.filter(o => {
    if (filter === "all")    return true;
    if (filter === "active") return ["pending","accepted","preparing"].includes(o.status);
    if (filter === "ready")  return o.status === "ready";
    if (filter === "done")   return ["delivered","rejected","settled"].includes(o.status);
    return o.status === filter;
  });

  const pendingCount = orders.filter(o => o.status === "pending").length;
  const activeCount  = orders.filter(o => ["pending","accepted","preparing"].includes(o.status)).length;
  const readyCount   = orders.filter(o => o.status === "ready").length;
  const totalRevenue = orders.filter(o => !["rejected","settled"].includes(o.status)).reduce((s,o) => s + (o.total||0), 0);
  const activeRooms  = [...new Set(orders.filter(o => ["pending","accepted","preparing","ready"].includes(o.status)).map(o => o.roomNumber))];

  return (
    <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", minHeight: "100vh", background: "#080806", color: "#e8e0d0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500&family=Montserrat:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .M { font-family: 'Montserrat', sans-serif; }
        @keyframes newOrderIn { 0%{opacity:0;transform:translateY(-12px) scale(.98)} 100%{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes expandIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes dotPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.5)} }
        @keyframes beepRing { 0%,100%{transform:scale(1)} 20%,60%{transform:scale(1.15) rotate(-8deg)} 40%,80%{transform:scale(1.15) rotate(8deg)} }
        @keyframes flashBorder { 0%,100%{border-color:#c9a84c22} 50%{border-color:#c9a84c} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .filter-btn { padding:6px 16px; background:transparent; border:1px solid #252518; color:#555; font-family:'Montserrat',sans-serif; font-size:9px; font-weight:500; letter-spacing:2px; text-transform:uppercase; cursor:pointer; transition:all .25s; }
        .filter-btn.on { border-color:#c9a84c; color:#c9a84c; background:#c9a84c0d; }
        .stat-card { background:linear-gradient(150deg,#131208,#0e0e08); border:1px solid #252518; padding:18px 20px; position:relative; overflow:hidden; }
        .stat-card::after { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:var(--accent,#c9a84c); opacity:.3; }
        .mute-btn { padding:8px 16px; background:transparent; border:1px solid #252518; color:#666; font-family:'Montserrat',sans-serif; font-size:9px; font-weight:500; letter-spacing:2px; text-transform:uppercase; cursor:pointer; transition:all .25s; display:flex; align-items:center; gap:8px; }
        .mute-btn.active { border-color:#c9a84c44; color:#c9a84c; }
        .gold-line { height:2px; background:linear-gradient(90deg,transparent,#c9a84c44,#c9a84c,#c9a84c44,transparent); }
        .spinner { width:24px; height:24px; border:2px solid #c9a84c22; border-top-color:#c9a84c; border-radius:50%; animation:spin .8s linear infinite; }
      `}</style>

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "28px 32px" }}>
        {/* STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
          {[
            { l: "Pending",  v: pendingCount,  i: "⏳", c: "#d4a017" },
            { l: "Active",   v: activeCount,   i: "🔥", c: "#5b9bd5" },
            { l: "Ready",    v: readyCount,    i: "🛎", c: "#a67dc8" },
            { l: "Revenue",  v: `₹${totalRevenue.toLocaleString()}`, i: "💰", c: "#c9a84c" },
          ].map(s => (
            <div key={s.l} className="stat-card" style={{ "--accent": s.c }}>
              <div style={{ fontSize: 22, marginBottom: 8 }}>{s.i}</div>
              <div style={{ fontSize: typeof s.v === "string" ? 20 : 30, fontWeight: 300, color: s.c, lineHeight: 1, marginBottom: 5 }}>{s.v}</div>
              <div className="M" style={{ fontSize: 9, letterSpacing: 2, color: "#555", textTransform: "uppercase" }}>{s.l}</div>
            </div>
          ))}
        </div>

        {pendingCount > 0 && (
          <div style={{ background: "#1a1208", border: "1px solid #c9a84c33", padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, marginBottom: 20, animation: "flashBorder 1.5s infinite" }}>
            <span style={{ fontSize: 22, animation: "beepRing .5s infinite" }}>🔔</span>
            <div>
              <div className="M" style={{ fontSize: 10, fontWeight: 700, color: "#c9a84c", letterSpacing: 2, textTransform: "uppercase" }}>{pendingCount} New Order{pendingCount > 1 ? "s" : ""} Awaiting Response</div>
              <div className="M" style={{ fontSize: 10, color: "#8b7355", marginTop: 3 }}>Accept or reject to stop the notification</div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <button className={`mute-btn ${!beepMuted ? "active" : ""}`} onClick={() => { setBeepMuted(m => !m); if (!beepMuted) stopBeep(); }}>
                <span style={{ fontSize: 14, animation: beepActive && !beepMuted ? "beepRing .4s infinite" : "none" }}>{beepMuted ? "🔇" : "🔔"}</span>
                {beepMuted ? "Unmute" : "Sound On"}
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24, alignItems: "start" }}>
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
              {[{ k: "all", l: `All (${orders.length})` }, { k: "active", l: `Active (${activeCount})` }, { k: "pending", l: `Pending (${pendingCount})` }, { k: "ready", l: `Ready (${readyCount})` }, { k: "done", l: "Completed" }].map(f => (
                <button key={f.k} className={`filter-btn ${filter === f.k ? "on" : ""}`} onClick={() => setFilter(f.k)}>{f.l}</button>
              ))}
            </div>
            {loading ? (
              <div style={{ textAlign: "center", padding: "80px 0" }}><div className="spinner" style={{ margin: "0 auto 16px" }} /><div className="M" style={{ fontSize: 10, letterSpacing: 3, color: "#555" }}>LOADING…</div></div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0", color: "#333" }}><div style={{ fontSize: 40, marginBottom: 14 }}>🍽️</div><div className="M" style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase" }}>No orders here</div></div>
            ) : filtered.map(order => (
              <OrderCard key={order.id} order={order} onAccept={onAccept} onReject={onReject} onAdvance={onAdvance} isNew={newOrderIds.has(order.id)} />
            ))}
          </div>

          {/* SIDEBAR */}
          <div style={{ position: "sticky", top: 88, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "linear-gradient(150deg,#131208,#0e0e08)", border: "1px solid #252518", padding: 20 }}>
              <div className="M" style={{ fontSize: 9, letterSpacing: 3, color: "#8b7355", textTransform: "uppercase", marginBottom: 16 }}>Active Rooms</div>
              {activeRooms.length === 0
                ? <div className="M" style={{ fontSize: 10, color: "#383828", textAlign: "center", padding: "16px 0" }}>No active rooms</div>
                : activeRooms.map(room => {
                    const hasPending = orders.some(o => o.roomNumber === room && o.status === "pending");
                    return (
                      <div key={room} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #151310" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: hasPending ? "#d4a017" : "#4caf82", animation: hasPending ? "dotPulse 1s infinite" : "none" }} />
                          <div style={{ fontSize: 15, color: "#e8e0d0" }}>Room {room}</div>
                        </div>
                        <div className="M" style={{ fontSize: 10, color: "#c9a84c" }}>{orders.filter(o => o.roomNumber === room && ["pending","accepted","preparing","ready"].includes(o.status)).length} order(s)</div>
                      </div>
                    );
                  })
              }
            </div>
            <div style={{ background: "linear-gradient(150deg,#131208,#0e0e08)", border: "1px solid #c9a84c22", padding: 20 }}>
              <div className="M" style={{ fontSize: 9, letterSpacing: 3, color: "#8b7355", textTransform: "uppercase", marginBottom: 14 }}>Revenue</div>
              {[{ l: "Total Orders", v: orders.length }, { l: "Rejected", v: orders.filter(o => o.status === "rejected").length }].map(r => (
                <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #151310" }}>
                  <span className="M" style={{ fontSize: 10, color: "#555" }}>{r.l}</span>
                  <span className="M" style={{ fontSize: 10, color: "#c9a84c" }}>{r.v}</span>
                </div>
              ))}
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #252518", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span className="M" style={{ fontSize: 9, letterSpacing: 2, color: "#8b7355", textTransform: "uppercase" }}>Total</span>
                <span style={{ fontSize: 20, color: "#c9a84c" }}>₹{totalRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}