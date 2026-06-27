import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  collection, doc, addDoc, setDoc, onSnapshot,
  query, where, orderBy, serverTimestamp, getDoc
} from "firebase/firestore";
import { db } from "../firebase";

const CATEGORIES = ["All", "Breakfast", "Lunch", "Dinner", "Snacks", "Beverages", "Desserts"];
const TAX_RATE = 0.18;

const STATUS_CONFIG = {
  pending:   { label: "Awaiting Confirmation", color: "#b8860b", bg: "#fef9ec", dot: "#f0c040", pulse: true  },
  accepted:  { label: "Order Accepted",         color: "#1a6b3a", bg: "#edfaf3", dot: "#34c26b", pulse: false },
  preparing: { label: "Being Prepared",         color: "#1a4a8a", bg: "#eef4fd", dot: "#4a90e2", pulse: true  },
  ready:     { label: "Ready to Deliver",       color: "#6a3a9a", bg: "#f5eeff", dot: "#a67dc8", pulse: false },
  delivered: { label: "Delivered",              color: "#555",    bg: "#f5f5f2", dot: "#aaa",    pulse: false },
  settled:   { label: "Settled",                color: "#aaa",    bg: "#f5f5f2", dot: "#ccc",    pulse: false },
};

function elapsed(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function CustomerApp() {
  const { hotelId, roomNumber } = useParams();

  const [screen, setScreen] = useState("welcome"); // welcome | menu
  const [guestName, setGuestName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [menu, setMenu] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState({});
  const [activeTab, setActiveTab] = useState("menu");
  const [orders, setOrders] = useState([]);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [itemDetail, setItemDetail] = useState(null);
  const [roomInfo, setRoomInfo] = useState(null);
  const [hotelInfo, setHotelInfo] = useState(null);

  // Firestore paths
  const menuPath   = `hotels/${hotelId}/menu`;
  const ordersPath = `hotels/${hotelId}/orders`;
  const guestsPath = `hotels/${hotelId}/guests`;
  const roomsPath  = `hotels/${hotelId}/rooms`;

  // Load hotel & room info
  useEffect(() => {
    if (!hotelId || !roomNumber) return;
    getDoc(doc(db, "hotels", hotelId)).then(snap => { if (snap.exists()) setHotelInfo(snap.data()); });
    getDoc(doc(db, roomsPath, roomNumber)).then(snap => { if (snap.exists()) setRoomInfo(snap.data()); });
  }, [hotelId, roomNumber]);

  // Load menu (available items only)
  useEffect(() => {
    if (!hotelId) return;
    const unsub = onSnapshot(
      query(collection(db, menuPath), where("available", "==", true)),
      snap => { setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setMenuLoading(false); }
    );
    return () => unsub();
  }, [hotelId]);

  // Load orders for this room in real time
  useEffect(() => {
    if (screen !== "menu" || !hotelId) return;
    const q = query(
      collection(db, ordersPath),
      where("roomNumber", "==", roomNumber),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [screen, hotelId, roomNumber]);

  // ── Enter as guest (name only) ──
  const handleEnter = async () => {
    if (!guestName.trim()) return setError("Please enter your name");
    setLoading(true);
    setError("");
    try {
      await setDoc(doc(db, guestsPath, roomNumber), {
        roomNumber,
        name: guestName.trim(),
        hotelId,
        checkIn: serverTimestamp(),
        active: true,
        pendingAmount: 0,
      });
      setScreen("menu");
    } catch (e) {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  // Cart helpers
  const cartCount = id => cart[id] || 0;
  const addToCart = id => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeFromCart = id => setCart(c => { const n = { ...c }; if (n[id] > 1) n[id]--; else delete n[id]; return n; });
  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartSubtotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = menu.find(m => m.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const filteredMenu = menu.filter(i => activeCategory === "All" || i.category === activeCategory);

  // Place order
  const placeOrder = async () => {
    if (Object.keys(cart).length === 0) return;
    setPlacingOrder(true);
    try {
      const items = Object.entries(cart).map(([id, qty]) => {
        const item = menu.find(m => m.id === id);
        return { id, name: item.name, image: item.image, price: item.price, qty, subtotal: item.price * qty };
      });
      await addDoc(collection(db, ordersPath), {
        roomNumber, guestName: guestName.trim(), hotelId,
        items, total: cartSubtotal,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setCart({});
      setOrderSuccess(true);
      setActiveTab("orders");
      setTimeout(() => setOrderSuccess(false), 3000);
    } catch (e) { alert("Error placing order: " + e.message); }
    setPlacingOrder(false);
  };

  const pendingAmount = orders.filter(o => !["settled","rejected"].includes(o.status)).reduce((s, o) => s + o.total, 0);
  const tax = Math.round(pendingAmount * TAX_RATE);
  const hotelName = hotelInfo?.hotelName || "Hotel";

  return (
    <div style={{ fontFamily: "'Playfair Display', Georgia, serif", minHeight: "100vh", background: "#f7f3ec", display: "flex", justifyContent: "center" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #c9a84c55; }
        .phone { width:100%; max-width:420px; min-height:100vh; background:#faf7f2; position:relative; box-shadow:0 0 80px #00000022; }
        .screen { animation: fadeUp .4s ease both; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{opacity:0;transform:translateX(-50%) translateY(100%)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes dotPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.5)} }

        .btn-primary { width:100%; padding:16px; background:#1a1208; color:#c9a84c; border:none; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:600; letter-spacing:3px; text-transform:uppercase; cursor:pointer; transition:all .3s; display:flex; align-items:center; justify-content:center; gap:10px; }
        .btn-primary:hover { background:#2a1e0e; }
        .btn-primary:disabled { background:#ccc; color:#999; cursor:not-allowed; }

        .inp { width:100%; padding:16px 18px; background:#fff; border:1px solid #e8e0d0; color:#1a1208; font-family:'Playfair Display',serif; font-size:18px; outline:none; transition:border-color .25s; }
        .inp:focus { border-color:#c9a84c; }
        .inp::placeholder { color:#c4b89a; font-style:italic; }

        .cat-pill { padding:7px 16px; background:transparent; border:1px solid #e8e0d0; color:#8a7a60; font-family:'DM Sans',sans-serif; font-size:11px; font-weight:500; letter-spacing:1px; white-space:nowrap; cursor:pointer; transition:all .25s; flex-shrink:0; }
        .cat-pill.on { background:#1a1208; border-color:#1a1208; color:#c9a84c; }
        .cat-pill:hover:not(.on) { border-color:#c9a84c88; color:#6b5a30; }

        .qty-btn { width:28px; height:28px; border-radius:50%; border:1.5px solid #1a1208; background:transparent; color:#1a1208; font-size:16px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .2s; font-family:'DM Sans',sans-serif; }
        .qty-btn:hover, .qty-btn.filled { background:#1a1208; color:#c9a84c; border-color:#1a1208; }

        .div { height:1px; background:linear-gradient(90deg,transparent,#e8e0d0,transparent); }

        .drawer-overlay { position:fixed; inset:0; background:#00000066; z-index:100; animation:fadeIn .2s ease; }
        .drawer { position:fixed; bottom:0; left:50%; transform:translateX(-50%); width:100%; max-width:420px; background:#faf7f2; z-index:101; animation:slideUp .3s ease; border-top:2px solid #c9a84c44; }

        .spinner { width:18px; height:18px; border:2px solid #c9a84c44; border-top-color:#c9a84c; border-radius:50%; animation:spin .7s linear infinite; }
        .status-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .pulse { animation:dotPulse 1.5s infinite; }
        .success-toast { position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#1a1208; color:#c9a84c; padding:12px 24px; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:600; letter-spacing:2px; text-transform:uppercase; z-index:999; animation:fadeUp .3s ease; white-space:nowrap; box-shadow:0 8px 32px #00000044; }
      `}</style>

      <div className="phone">

        {/* ══ WELCOME SCREEN ══ */}
        {screen === "welcome" && (
          <div className="screen" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

            {/* Hero */}
            <div style={{ background: "#1a1208", padding: "64px 32px 52px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, border: "1px solid #c9a84c11", borderRadius: "50%" }} />
              <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, border: "1px solid #c9a84c18", borderRadius: "50%" }} />
              <div style={{ position: "absolute", bottom: -40, left: -40, width: 140, height: 140, border: "1px solid #c9a84c11", borderRadius: "50%" }} />
              <div style={{ position: "relative" }}>
                <div style={{ color: "#c9a84c", fontSize: 28, marginBottom: 16, letterSpacing: 4 }}>⚜</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, letterSpacing: 5, color: "#8b7355", textTransform: "uppercase", marginBottom: 12 }}>{hotelName}</div>
                <h1 style={{ fontSize: 32, fontWeight: 400, color: "#f0ead8", lineHeight: 1.2, marginBottom: 10 }}>Room Service</h1>
                <p style={{ fontStyle: "italic", color: "#8b7355", fontSize: 14, fontWeight: 300 }}>Curated dining, delivered to your door</p>
              </div>
            </div>

            {/* Gold line */}
            <div style={{ height: 3, background: "linear-gradient(90deg,transparent,#c9a84c,transparent)" }} />

            {/* Form */}
            <div style={{ flex: 1, padding: "48px 28px 32px", display: "flex", flexDirection: "column", gap: 32 }}>

              {/* Room info */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, letterSpacing: 4, color: "#aaa", textTransform: "uppercase", marginBottom: 8 }}>You are in</div>
                <div style={{ fontSize: 48, fontWeight: 500, color: "#1a1208", letterSpacing: -1, lineHeight: 1 }}>Room {roomNumber}</div>
                {roomInfo && (
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#aaa", marginTop: 8 }}>
                    {roomInfo.type} · {roomInfo.floor}
                  </div>
                )}
              </div>

              <div className="div" />

              {/* Name input */}
              <div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, letterSpacing: 3, color: "#aaa", textTransform: "uppercase", marginBottom: 20, textAlign: "center" }}>
                  What's your name?
                </div>
                <input
                  className="inp"
                  placeholder="e.g. Arjun Mehta"
                  value={guestName}
                  onChange={e => { setGuestName(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && handleEnter()}
                  autoFocus
                />
                {error && (
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#c44c4c", marginTop: 8, textAlign: "center" }}>{error}</div>
                )}
              </div>

              {/* Enter button */}
              <div style={{ marginTop: "auto" }}>
                <button className="btn-primary" disabled={!guestName.trim() || loading} onClick={handleEnter}>
                  {loading
                    ? <><div className="spinner" />Just a moment…</>
                    : "View Menu & Order →"
                  }
                </button>
                <div style={{ textAlign: "center", marginTop: 14, fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#c4b89a", fontStyle: "italic" }}>
                  Your name helps us personalise your experience
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ MAIN APP ══ */}
        {screen === "menu" && (
          <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>

            {/* Sticky header */}
            <div style={{ background: "#1a1208", padding: "20px 20px 0", position: "sticky", top: 0, zIndex: 40 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, letterSpacing: 4, color: "#8b7355", textTransform: "uppercase" }}>{hotelName}</div>
                  <div style={{ fontSize: 18, fontWeight: 400, color: "#f0ead8" }}>Room {roomNumber}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {pendingAmount > 0 ? (
                    <div style={{ background: "#c9a84c1a", border: "1px solid #c9a84c44", padding: "6px 12px" }}>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, letterSpacing: 2, color: "#8b7355", textTransform: "uppercase" }}>Pending</div>
                      <div style={{ fontSize: 16, color: "#c9a84c", fontWeight: 500 }}>₹{(pendingAmount + tax).toLocaleString()}</div>
                    </div>
                  ) : (
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#8b7355", fontStyle: "italic" }}>
                      Welcome, {guestName.split(" ")[0]} 👋
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", borderTop: "1px solid #2a2018" }}>
                {[
                  { k: "menu",   l: "Menu" },
                  { k: "orders", l: `My Orders${orders.length ? ` (${orders.length})` : ""}` },
                ].map(t => (
                  <button key={t.k} onClick={() => setActiveTab(t.k)} style={{
                    flex: 1, padding: "12px 0", background: "transparent", border: "none",
                    fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: 2,
                    textTransform: "uppercase", cursor: "pointer",
                    color: activeTab === t.k ? "#c9a84c" : "#555",
                    borderBottom: `2px solid ${activeTab === t.k ? "#c9a84c" : "transparent"}`,
                    transition: "all .25s",
                  }}>{t.l}</button>
                ))}
              </div>
            </div>

            {/* Gold line */}
            <div style={{ height: 2, background: "linear-gradient(90deg,transparent,#c9a84c,transparent)", flexShrink: 0 }} />

            {/* ── MENU TAB ── */}
            {activeTab === "menu" && (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Category pills */}
                <div style={{ padding: "14px 0 14px 16px", display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", flexShrink: 0 }}>
                  {CATEGORIES.map(cat => (
                    <button key={cat} className={`cat-pill ${activeCategory === cat ? "on" : ""}`} onClick={() => setActiveCategory(cat)}>{cat}</button>
                  ))}
                  <div style={{ width: 8, flexShrink: 0 }} />
                </div>

                {/* Items */}
                {menuLoading ? (
                  <div style={{ textAlign: "center", padding: "60px 0" }}>
                    <div className="spinner" style={{ margin: "0 auto 12px" }} />
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#aaa", letterSpacing: 2 }}>Loading menu…</div>
                  </div>
                ) : (
                  <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px", paddingBottom: totalItems > 0 ? 100 : 24 }}>
                    {filteredMenu.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa" }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }}>🍽️</div>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, letterSpacing: 2 }}>No items in this category</div>
                      </div>
                    ) : filteredMenu.map((item, idx) => (
                      <div key={item.id} className="screen" style={{ animationDelay: `${idx * 0.04}s`, marginBottom: 12 }}>
                        <div style={{ background: "#fff", border: "1px solid #ece6d8", display: "flex", gap: 14, padding: "14px", cursor: "pointer" }} onClick={() => setItemDetail(item)}>
                          <div style={{ width: 56, height: 56, background: "#faf7f2", border: "1px solid #ece6d8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{item.image}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 500, color: "#1a1208", marginBottom: 3 }}>{item.name}</div>
                            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#aaa", fontStyle: "italic", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</div>
                            <div style={{ fontSize: 15, color: "#8b6a20", fontWeight: 500 }}>₹{Number(item.price).toLocaleString()}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            {cartCount(item.id) > 0 ? (
                              <>
                                <button className="qty-btn filled" onClick={() => removeFromCart(item.id)}>−</button>
                                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: "#1a1208", minWidth: 16, textAlign: "center" }}>{cartCount(item.id)}</span>
                                <button className="qty-btn filled" onClick={() => addToCart(item.id)}>+</button>
                              </>
                            ) : (
                              <button className="qty-btn" onClick={() => addToCart(item.id)}>+</button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Cart bar */}
                {totalItems > 0 && (
                  <div style={{ position: "sticky", bottom: 0, background: "#1a1208", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 -8px 32px #00000022" }}>
                    <div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, letterSpacing: 2, color: "#8b7355", textTransform: "uppercase" }}>{totalItems} item{totalItems > 1 ? "s" : ""}</div>
                      <div style={{ fontSize: 18, color: "#f0ead8", fontWeight: 500 }}>₹{cartSubtotal.toLocaleString()}</div>
                    </div>
                    <button onClick={placeOrder} disabled={placingOrder}
                      style={{ background: "#c9a84c", border: "none", color: "#1a1208", padding: "12px 24px", fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                      {placingOrder ? <><div className="spinner" style={{ borderTopColor: "#1a1208", borderColor: "#1a120833" }} />Placing…</> : "Place Order →"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── ORDERS TAB ── */}
            {activeTab === "orders" && (
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 32px" }}>
                {orders.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "80px 0" }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🛎️</div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: "#bbb" }}>No orders yet</div>
                    <button onClick={() => setActiveTab("menu")} style={{ marginTop: 20, padding: "10px 24px", background: "transparent", border: "1px solid #c9a84c", color: "#8b6a20", fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>Browse Menu</button>
                  </div>
                ) : (
                  <>
                    {pendingAmount > 0 && (
                      <div style={{ background: "#1a1208", padding: "16px 18px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: "3px solid #c9a84c" }}>
                        <div>
                          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, letterSpacing: 3, color: "#8b7355", textTransform: "uppercase", marginBottom: 3 }}>Total Pending (incl. tax)</div>
                          <div style={{ fontSize: 24, color: "#c9a84c" }}>₹{(pendingAmount + tax).toLocaleString()}</div>
                        </div>
                        <div style={{ fontSize: 28 }}>🧾</div>
                      </div>
                    )}

                    {orders.map(order => {
                      const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                      return (
                        <div key={order.id} style={{ background: "#fff", border: "1px solid #ece6d8", marginBottom: 14, overflow: "hidden" }}>
                          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f5f0e8" }}>
                            <div>
                              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: "#aaa" }}>{order.id?.slice(-8)}</div>
                              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#aaa", marginTop: 2 }}>{elapsed(order.createdAt)}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 7, background: sc.bg, padding: "5px 10px", border: `1px solid ${sc.dot}33` }}>
                              <div className={`status-dot ${sc.pulse ? "pulse" : ""}`} style={{ background: sc.dot }} />
                              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, fontWeight: 600, color: sc.color }}>{sc.label}</span>
                            </div>
                          </div>
                          <div style={{ padding: "12px 16px" }}>
                            {order.items?.map((item, i) => (
                              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f8f5f0" }}>
                                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                  <span style={{ fontSize: 16 }}>{item.image}</span>
                                  <div>
                                    <div style={{ fontSize: 13, color: "#1a1208" }}>{item.name}</div>
                                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#aaa" }}>×{item.qty}</div>
                                  </div>
                                </div>
                                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#6b5a30", fontWeight: 500 }}>₹{item.subtotal?.toLocaleString()}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ padding: "10px 16px", background: "#faf7f2", borderTop: "1px solid #ece6d8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: 1 }}>Order Total</span>
                            <span style={{ fontSize: 16, color: "#1a1208", fontWeight: 500 }}>₹{order.total?.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Item detail drawer */}
      {itemDetail && (
        <>
          <div className="drawer-overlay" onClick={() => setItemDetail(null)} />
          <div className="drawer">
            <div style={{ padding: "24px 20px 20px" }}>
              <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <div style={{ width: 72, height: 72, background: "#faf7f2", border: "1px solid #ece6d8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, flexShrink: 0 }}>{itemDetail.image}</div>
                <div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, letterSpacing: 2, color: "#c9a84c", textTransform: "uppercase", marginBottom: 4 }}>{itemDetail.category}</div>
                  <div style={{ fontSize: 20, fontWeight: 500, color: "#1a1208", marginBottom: 4 }}>{itemDetail.name}</div>
                  <div style={{ fontSize: 17, color: "#8b6a20" }}>₹{Number(itemDetail.price).toLocaleString()}</div>
                </div>
              </div>
              <div className="div" style={{ marginBottom: 14 }} />
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#6b5a40", lineHeight: 1.6, fontStyle: "italic", marginBottom: 20 }}>{itemDetail.description}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {cartCount(itemDetail.id) > 0 ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <button className="qty-btn filled" style={{ width: 36, height: 36 }} onClick={() => removeFromCart(itemDetail.id)}>−</button>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 18, fontWeight: 600, color: "#1a1208" }}>{cartCount(itemDetail.id)}</span>
                      <button className="qty-btn filled" style={{ width: 36, height: 36 }} onClick={() => addToCart(itemDetail.id)}>+</button>
                    </div>
                    <button className="btn-primary" style={{ flex: 1 }} onClick={() => setItemDetail(null)}>Done ✓</button>
                  </>
                ) : (
                  <button className="btn-primary" onClick={() => { addToCart(itemDetail.id); setItemDetail(null); }}>Add to Order</button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {orderSuccess && <div className="success-toast">✓ &nbsp;Order Placed Successfully</div>}
    </div>
  );
}