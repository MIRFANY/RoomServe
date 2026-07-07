import { useState, useEffect } from "react";
import { collection, onSnapshot, updateDoc, doc, query, orderBy } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useNavigate } from "react-router-dom";

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

//  format date


const STATUS_CONFIG = {
  pending:   { label: "Pending",   color: "#d4a017", bg: "#2a2208", border: "#d4a01733", dot: "#f0c040" },
  active:    { label: "Active",    color: "#4caf82", bg: "#0a2018", border: "#4caf8233", dot: "#4caf82" },
  suspended: { label: "Suspended", color: "#c47a7a", bg: "#1e0a0a", border: "#c47a7a33", dot: "#c47a7a" },
};

export default function SuperAdminDashboard() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [selectedHotel, setSelectedHotel] = useState(null);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Real-time hotels listener
  useEffect(() => {
    const q = query(collection(db, "hotels"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setHotels(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const updateHotelStatus = async (hotelId, status) => {
    try {
      await updateDoc(doc(db, "hotels", hotelId), { status });
      showToast(`Hotel ${status === "active" ? "approved" : status === "suspended" ? "suspended" : "rejected"} successfully`);
      setSelectedHotel(null);
    } catch (e) {
      showToast("Error: " + e.message, "error");
    }
  };

  const filtered = hotels.filter(h => filter === "all" || h.status === filter);

  const stats = {
    total:     hotels.length,
    pending:   hotels.filter(h => h.status === "pending").length,
    active:    hotels.filter(h => h.status === "active").length,
    suspended: hotels.filter(h => h.status === "suspended").length,
    revenue:   hotels.reduce((s, h) => s + (h.revenue || 0), 0),
  };

  return (
    <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", minHeight: "100vh", background: "#080806", color: "#e8e0d0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500&family=Montserrat:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #8b735544; }
        .M { font-family: 'Montserrat', sans-serif; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes dotPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.5)} }
        .hotel-row { background:linear-gradient(150deg,#111008,#0d0d06); border:1px solid #252518; transition:all .3s; cursor:pointer; }
        .hotel-row:hover { border-color:#3a3828; box-shadow:0 8px 32px #00000055; }
        .filter-btn { padding:6px 16px; background:transparent; border:1px solid #252518; color:#555; font-family:'Montserrat',sans-serif; font-size:9px; font-weight:500; letter-spacing:2px; text-transform:uppercase; cursor:pointer; transition:all .25s; }
        .filter-btn.on { border-color:#c9a84c; color:#c9a84c; background:#c9a84c0d; }
        .gold-line { height:2px; background:linear-gradient(90deg,transparent,#c9a84c44,#c9a84c,#c9a84c44,transparent); }
        .spinner { width:24px; height:24px; border:2px solid #c9a84c22; border-top-color:#c9a84c; border-radius:50%; animation:spin .8s linear infinite; }
        .modal-bg { position:fixed; inset:0; background:#000000cc; backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center; z-index:200; }
        .modal { background:#0a0a06; border:1px solid #252518; width:90%; max-width:480px; animation:fadeUp .3s ease; }
        .toast-box { position:fixed; bottom:28px; right:28px; padding:13px 22px; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:500; letter-spacing:1px; z-index:999; animation:fadeUp .3s ease; }
        .toast-ok { background:#151510; border:1px solid #c9a84c44; color:#c9a84c; }
        .toast-err { background:#150e0e; border:1px solid #c44c4c44; color:#c47a7a; }
      `}</style>

      {/* HEADER */}
      <header style={{ borderBottom: "1px solid #141410", padding: "0 36px", position: "sticky", top: 0, background: "#080806", zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 36, height: 36, border: "1px solid #c9a84c44", display: "flex", alignItems: "center", justifyContent: "center", color: "#c9a84c" }}>⚜</div>
            <div>
              <div className="M" style={{ fontSize: 8, letterSpacing: 4, color: "#555", textTransform: "uppercase" }}>RoomServe</div>
              <div style={{ fontSize: 17, fontWeight: 300 }}>Super Admin Dashboard</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {stats.pending > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", background: "#2a2208", border: "1px solid #d4a01733" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f0c040", animation: "dotPulse 1s infinite" }} />
                <span className="M" style={{ fontSize: 9, color: "#d4a017", letterSpacing: 2 }}>{stats.pending} PENDING</span>
              </div>
            )}
            <button onClick={() => { auth.signOut(); navigate("/login"); }}
              style={{ padding: "7px 16px", background: "transparent", border: "1px solid #2a2a18", color: "#666", fontFamily: "'Montserrat',sans-serif", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
              Logout
            </button>
          </div>
        </div>
      </header>
      <div className="gold-line" />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 36px" }}>

        {/* STATS */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 32 }}>
          {[
            { l: "Total Hotels",  v: stats.total,     i: "🏨", c: "#c9a84c" },
            { l: "Pending",       v: stats.pending,   i: "⏳", c: "#d4a017" },
            { l: "Active",        v: stats.active,    i: "✅", c: "#4caf82" },
            { l: "Suspended",     v: stats.suspended, i: "🚫", c: "#c47a7a" },
            { l: "Total Revenue", v: `₹${stats.revenue.toLocaleString()}`, i: "💰", c: "#c9a84c" },
          ].map(s => (
            <div key={s.l} style={{ background: "linear-gradient(150deg,#131208,#0e0e08)", border: "1px solid #252518", padding: "18px 20px" }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{s.i}</div>
              <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: typeof s.v === "string" ? 20 : 28, color: s.c, lineHeight: 1, marginBottom: 5 }}>{s.v}</div>
              <div className="M" style={{ fontSize: 9, letterSpacing: 2, color: "#555", textTransform: "uppercase" }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* PENDING ALERT */}
        {stats.pending > 0 && (
          <div style={{ background: "#1a1208", border: "1px solid #d4a01733", padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <span style={{ fontSize: 20 }}>🔔</span>
            <div>
              <div className="M" style={{ fontSize: 10, fontWeight: 700, color: "#d4a017", letterSpacing: 2, textTransform: "uppercase" }}>
                {stats.pending} Hotel{stats.pending > 1 ? "s" : ""} Awaiting Approval
              </div>
              <div className="M" style={{ fontSize: 10, color: "#8b7355", marginTop: 3 }}>Review and approve or reject new hotel registrations</div>
            </div>
          </div>
        )}

        {/* FILTERS */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[
            { k: "all",       l: `All (${stats.total})`         },
            { k: "pending",   l: `Pending (${stats.pending})`   },
            { k: "active",    l: `Active (${stats.active})`     },
            { k: "suspended", l: `Suspended (${stats.suspended})` },
          ].map(f => (
            <button key={f.k} className={`filter-btn ${filter === f.k ? "on" : ""}`} onClick={() => setFilter(f.k)}>{f.l}</button>
          ))}
        </div>

        {/* HOTELS LIST */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div className="spinner" style={{ margin: "0 auto 16px" }} />
            <div className="M" style={{ fontSize: 10, letterSpacing: 3, color: "#555" }}>LOADING…</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🏨</div>
            <div className="M" style={{ fontSize: 10, letterSpacing: 3, color: "#383828", textTransform: "uppercase" }}>No hotels in this category</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((hotel, i) => {
              const sc = STATUS_CONFIG[hotel.status] || STATUS_CONFIG.pending;
              return (
                <div key={hotel.id} className="hotel-row" style={{ animation: `fadeUp .4s ${i * 0.06}s ease both` }} onClick={() => setSelectedHotel(hotel)}>
                  <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>

                    {/* Left */}
                    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                      <div style={{ width: 48, height: 48, background: sc.bg, border: `1px solid ${sc.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🏨</div>
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 400, color: "#e8e0d0", marginBottom: 3 }}>{hotel.hotelName}</div>
                        <div className="M" style={{ fontSize: 10, color: "#555", marginBottom: 3 }}>{hotel.ownerName} · {hotel.city}</div>
                        <div className="M" style={{ fontSize: 9, color: "#444" }}>{hotel.email} · {hotel.phone}</div>
                      </div>
                    </div>

                    {/* Right */}
                    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                      <div style={{ textAlign: "right" }}>
                        <div className="M" style={{ fontSize: 9, color: "#444", marginBottom: 4 }}>Registered {formatDate(hotel.createdAt)}</div>
                        <div className="M" style={{ fontSize: 10, color: "#c9a84c" }}>₹{(hotel.revenue || 0).toLocaleString()} revenue</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, background: sc.bg, border: `1px solid ${sc.border}`, padding: "5px 12px" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
                        <span className="M" style={{ fontSize: 9, fontWeight: 600, color: sc.color, letterSpacing: 1, textTransform: "uppercase" }}>{sc.label}</span>
                      </div>
                      <div className="M" style={{ fontSize: 9, color: "#555", letterSpacing: 1 }}>Click to manage →</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* HOTEL DETAIL MODAL */}
      {selectedHotel && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setSelectedHotel(null)}>
          <div className="modal">
            <div style={{ padding: "24px 28px", borderBottom: "1px solid #181810" }}>
              <div className="M" style={{ fontSize: 8, letterSpacing: 3, color: "#8b7355", textTransform: "uppercase", marginBottom: 4 }}>Hotel Management</div>
              <div style={{ fontSize: 22, fontWeight: 300 }}>{selectedHotel.hotelName}</div>
            </div>

            <div style={{ padding: "20px 28px" }}>
              {/* Hotel details */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                {[
                  ["Owner",      selectedHotel.ownerName],
                  ["Email",      selectedHotel.email],
                  ["Phone",      selectedHotel.phone],
                  ["City",       selectedHotel.city],
                  ["Registered", formatDate(selectedHotel.createdAt)],
                  ["Hotel ID",   selectedHotel.hotelId],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#555", textTransform: "uppercase", marginBottom: 3 }}>{k}</div>
                    <div className="M" style={{ fontSize: 11, color: "#c9a84c" }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Current status */}
              <div style={{ background: STATUS_CONFIG[selectedHotel.status]?.bg || "#1a1a10", border: `1px solid ${STATUS_CONFIG[selectedHotel.status]?.border || "#252518"}`, padding: "10px 14px", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_CONFIG[selectedHotel.status]?.dot }} />
                <span className="M" style={{ fontSize: 10, color: STATUS_CONFIG[selectedHotel.status]?.color, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
                  Current Status: {STATUS_CONFIG[selectedHotel.status]?.label}
                </span>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {selectedHotel.status === "pending" && (
                  <>
                    <button onClick={() => updateHotelStatus(selectedHotel.id, "active")}
                      style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg,#c9a84c,#9a7830)", border: "none", color: "#0a0a06", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
                      ✓ Approve & Activate Hotel
                    </button>
                    <button onClick={() => updateHotelStatus(selectedHotel.id, "suspended")}
                      style={{ width: "100%", padding: "12px", background: "#1e0a0a", border: "1px solid #c47a7a33", color: "#c47a7a", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
                      ✕ Reject Application
                    </button>
                  </>
                )}
                {selectedHotel.status === "active" && (
                  <button onClick={() => updateHotelStatus(selectedHotel.id, "suspended")}
                    style={{ width: "100%", padding: "12px", background: "#1e0a0a", border: "1px solid #c47a7a33", color: "#c47a7a", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
                    🚫 Suspend Hotel
                  </button>
                )}
                {selectedHotel.status === "suspended" && (
                  <button onClick={() => updateHotelStatus(selectedHotel.id, "active")}
                    style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg,#c9a84c,#9a7830)", border: "none", color: "#0a0a06", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
                    ✓ Reactivate Hotel
                  </button>
                )}
                <button onClick={() => setSelectedHotel(null)}
                  style={{ width: "100%", padding: "10px", background: "transparent", border: "1px solid #252518", color: "#555", fontFamily: "'Montserrat',sans-serif", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast-box ${toast.type === "error" ? "toast-err" : "toast-ok"}`}>{toast.type === "error" ? "✕  " : "✓  "}{toast.msg}</div>}

      <div style={{ marginTop: 60, borderTop: "1px solid #141410", padding: "16px 36px", textAlign: "center" }}>
        <div className="M" style={{ fontSize: 8, letterSpacing: 3, color: "#1e1e14", textTransform: "uppercase" }}>RoomServe Platform · Super Admin · All Hotels</div>
      </div>
    </div>
  );
}
