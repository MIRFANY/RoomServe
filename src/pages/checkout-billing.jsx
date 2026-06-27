import { useState, useEffect } from "react";
import { collection, doc, updateDoc, onSnapshot, query, where, orderBy, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

const TAX_RATE = 0.18;

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function formatTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function calcTotal(orders) {
  return orders.reduce((s, o) => s + (o.total || 0), 0);
}

function BillReceipt({ guest, orders, hotelId, onBack, onConfirm, confirming }) {
  const subtotal = calcTotal(orders);
  const tax = Math.round(subtotal * TAX_RATE);
  const grandTotal = subtotal + tax;
  return (
    <div style={{ animation: "fadeUp .4s ease" }}>
      <div style={{ background: "#fdfaf5", border: "1px solid #e8e0cc", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ height: 12, background: "repeating-linear-gradient(90deg,#fdfaf5 0px,#fdfaf5 8px,#f0ead8 8px,#f0ead8 12px,#fdfaf5 12px,#fdfaf5 20px)", borderBottom: "1px dashed #e0d8c8" }} />
        <div style={{ padding: "24px 32px 20px", textAlign: "center", borderBottom: "1px dashed #e0d8c8" }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 10, letterSpacing: 5, color: "#c9a84c", textTransform: "uppercase", marginBottom: 6 }}>⚜ RoomServe ⚜</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "#1a1208", marginBottom: 4 }}>Room Service Bill</div>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, color: "#aaa", letterSpacing: 2 }}>{formatDate({ toDate: () => new Date() })} · {formatTime({ toDate: () => new Date() })}</div>
        </div>
        <div style={{ padding: "16px 32px", borderBottom: "1px dashed #e0d8c8", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[["Room", guest.roomNumber || guest.id], ["Guest", guest.name || guest.guestName || "—"], ["Mobile", guest.mobile || "—"], ["Check-in", formatDate(guest.checkIn)], ["Orders", orders.length]].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 8, letterSpacing: 2, color: "#aaa", textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
              <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 11, color: "#1a1208", fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "16px 32px", borderBottom: "1px dashed #e0d8c8" }}>
          <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 8, letterSpacing: 3, color: "#aaa", textTransform: "uppercase", marginBottom: 12 }}>Order Details</div>
          {orders.map(order => (
            <div key={order.id} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, color: "#888" }}>{order.id?.slice(-8)} · {formatTime(order.createdAt)}</span>
                <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 10, color: "#6b5a30", fontWeight: 600 }}>₹{(order.total||0).toLocaleString()}</span>
              </div>
              {order.items?.map((item, ii) => (
                <div key={ii} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0 3px 10px" }}>
                  <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 10, color: "#555" }}>{item.image} {item.name} ×{item.qty}</span>
                  <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 10, color: "#888" }}>₹{item.subtotal?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div style={{ padding: "16px 32px", borderBottom: "1px dashed #e0d8c8" }}>
          {[["Subtotal", `₹${subtotal.toLocaleString()}`], ["GST & Service (18%)", `₹${tax.toLocaleString()}`]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 10, color: "#888" }}>{k}</span>
              <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 10, color: "#555" }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: "18px 32px", background: "#1a1208", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 11, letterSpacing: 3, color: "#8b7355", textTransform: "uppercase" }}>Grand Total</span>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: "#c9a84c" }}>₹{grandTotal.toLocaleString()}</span>
        </div>
        <div style={{ height: 12, background: "repeating-linear-gradient(90deg,#fdfaf5 0px,#fdfaf5 8px,#f0ead8 8px,#f0ead8 12px,#fdfaf5 12px,#fdfaf5 20px)", borderTop: "1px dashed #e0d8c8" }} />
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 20, justifyContent: "center" }}>
        <button onClick={onBack} style={{ padding: "11px 24px", background: "transparent", border: "1px solid #2a2a18", color: "#666", fontFamily: "'Montserrat',sans-serif", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>← Back</button>
        <button onClick={onConfirm} disabled={confirming} style={{ padding: "11px 32px", background: confirming ? "#555" : "linear-gradient(135deg,#c9a84c,#9a7830)", border: "none", color: "#0a0a06", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: confirming ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          {confirming ? "Closing…" : "✓ Confirm & Close Billing"}
        </button>
      </div>
    </div>
  );
}

function CheckoutSuccess({ guest, grandTotal, onDone }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let val = 0; const step = grandTotal / 40;
    const t = setInterval(() => { val += step; if (val >= grandTotal) { setCount(grandTotal); clearInterval(t); } else setCount(Math.floor(val)); }, 30);
    return () => clearInterval(t);
  }, [grandTotal]);
  return (
    <div style={{ textAlign: "center", animation: "fadeUp .5s ease", padding: "40px 0" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#0a1808", border: "2px solid #4caf82", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", fontSize: 36 }}>✓</div>
      <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 10, letterSpacing: 4, color: "#4caf82", textTransform: "uppercase", marginBottom: 10 }}>Billing Closed</div>
      <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 28, color: "#e8e0d0", marginBottom: 6 }}>Room {guest.roomNumber || guest.id} Checked Out</div>
      <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 12, color: "#8b7355", fontStyle: "italic", marginBottom: 36 }}>{guest.name || guest.guestName}'s account settled</div>
      <div style={{ background: "linear-gradient(135deg,#131208,#0e0e08)", border: "1px solid #c9a84c33", padding: "28px 48px", display: "inline-block", marginBottom: 36 }}>
        <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, letterSpacing: 3, color: "#8b7355", textTransform: "uppercase", marginBottom: 8 }}>Amount Settled</div>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 42, color: "#c9a84c", lineHeight: 1 }}>₹{count.toLocaleString()}</div>
        <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 9, color: "#4caf82", marginTop: 10, letterSpacing: 2 }}>✓ WALLET CLEARED · BALANCE: ₹0</div>
      </div>
      <div><button onClick={onDone} style={{ padding: "12px 32px", background: "linear-gradient(135deg,#c9a84c,#9a7830)", border: "none", color: "#0a0a06", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>← Back to Dashboard</button></div>
    </div>
  );
}

export default function CheckoutBilling({ hotelId }) {
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [view, setView] = useState("dashboard");
  const [confirming, setConfirming] = useState(false);
  const [settledGuest, setSettledGuest] = useState(null);
  const [settledTotal, setSettledTotal] = useState(0);
  const [toast, setToast] = useState(null);

  // ── Firestore paths use hotelId ──
  const guestsPath = `hotels/${hotelId}/guests`;
  const ordersPath = `hotels/${hotelId}/orders`;

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  useEffect(() => {
    if (!hotelId) return;
    const q = query(collection(db, guestsPath), where("active", "==", true));
    const unsub = onSnapshot(q, snap => {
      setGuests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [hotelId]);

  const loadGuestOrders = async (roomNumber) => {
    const q = query(collection(db, ordersPath), where("roomNumber", "==", roomNumber), where("status", "!=", "rejected"), orderBy("status"), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  };

  const openBill = async (guest) => {
    const orders = await loadGuestOrders(guest.roomNumber || guest.id);
    setSelectedGuest(guest);
    setSelectedOrders(orders);
    setView("bill");
  };

  const confirmClose = async () => {
    if (!selectedGuest) return;
    setConfirming(true);
    const subtotal = calcTotal(selectedOrders);
    const grandTotal = subtotal + Math.round(subtotal * TAX_RATE);
    try {
      await updateDoc(doc(db, guestsPath, selectedGuest.id), { active: false, checkOut: serverTimestamp(), pendingAmount: 0 });
      await Promise.all(selectedOrders.map(o => updateDoc(doc(db, ordersPath, o.id), { status: "settled" })));
      setSettledGuest(selectedGuest);
      setSettledTotal(grandTotal);
      setView("success");
    } catch (e) { showToast("Error: " + e.message); }
    setConfirming(false);
  };

  const handleDone = () => {
    setView("dashboard"); setSelectedGuest(null); setSelectedOrders([]);
    showToast(`Room ${settledGuest?.roomNumber || settledGuest?.id} billing closed ✓`);
  };

  return (
    <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", minHeight: "100vh", background: "#080806", color: "#e8e0d0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500&family=Playfair+Display:wght@400;500&family=Montserrat:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .M { font-family: 'Montserrat', sans-serif; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .guest-row { background:linear-gradient(150deg,#111008,#0d0d06); border:1px solid #252518; cursor:pointer; transition:all .3s; }
        .guest-row:hover { border-color:#3a3828; box-shadow:0 8px 32px #00000055; }
        .spinner { width:24px; height:24px; border:2px solid #c9a84c22; border-top-color:#c9a84c; border-radius:50%; animation:spin .8s linear infinite; }
        .toast-box { position:fixed; bottom:28px; right:28px; padding:13px 22px; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:500; letter-spacing:1px; z-index:999; animation:fadeUp .3s ease; background:#151510; border:1px solid #c9a84c44; color:#c9a84c; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 36px" }}>

        {view === "dashboard" && (
          <div style={{ animation: "fadeUp .4s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 32 }}>
              {[{ l: "Active Guests", v: guests.length, i: "🏨", c: "#c9a84c" }, { l: "Rooms Occupied", v: guests.length, i: "🔑", c: "#5b9bd5" }, { l: "Pending Bills", v: guests.length, i: "💳", c: "#d4a017" }].map(s => (
                <div key={s.l} style={{ background: "linear-gradient(150deg,#131208,#0e0e08)", border: "1px solid #252518", padding: "18px 20px" }}>
                  <div style={{ fontSize: 22, marginBottom: 8 }}>{s.i}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 26, color: s.c, lineHeight: 1, marginBottom: 5 }}>{s.v}</div>
                  <div className="M" style={{ fontSize: 9, letterSpacing: 2, color: "#555", textTransform: "uppercase" }}>{s.l}</div>
                </div>
              ))}
            </div>

            <div className="M" style={{ fontSize: 9, letterSpacing: 3, color: "#8b7355", textTransform: "uppercase", marginBottom: 16 }}>Active Guests — Click to View Bill & Checkout</div>

            {loading ? (
              <div style={{ textAlign: "center", padding: "80px 0" }}><div className="spinner" style={{ margin: "0 auto 16px" }} /><div className="M" style={{ fontSize: 10, letterSpacing: 3, color: "#555" }}>LOADING…</div></div>
            ) : guests.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 0" }}>
                <div style={{ fontSize: 40, marginBottom: 14 }}>🏨</div>
                <div className="M" style={{ fontSize: 10, letterSpacing: 3, color: "#383828", textTransform: "uppercase" }}>No active guests right now</div>
                <div className="M" style={{ fontSize: 11, color: "#333", marginTop: 8 }}>Guests appear here after scanning room QR and logging in</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {guests.map((guest, i) => (
                  <div key={guest.id} className="guest-row" style={{ animation: `fadeUp .4s ${i * 0.08}s ease both` }} onClick={() => openBill(guest)}>
                    <div style={{ padding: "20px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                        <div style={{ background: "#1a1408", border: "1px solid #c9a84c22", padding: "10px 14px", textAlign: "center", minWidth: 64 }}>
                          <div className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#555", textTransform: "uppercase" }}>Room</div>
                          <div style={{ fontSize: 24, color: "#c9a84c" }}>{guest.roomNumber || guest.id}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 18, color: "#e8e0d0", marginBottom: 3 }}>{guest.name || guest.guestName || "Guest"}</div>
                          <div className="M" style={{ fontSize: 10, color: "#555", marginBottom: 4 }}>{guest.mobile || "—"}</div>
                          <div className="M" style={{ fontSize: 9, color: "#444" }}>📅 Check-in: {formatDate(guest.checkIn)}</div>
                        </div>
                      </div>
                      <div style={{ padding: "10px 20px", background: "#1a1208", border: "1px solid #c9a84c33", color: "#c9a84c", fontFamily: "'Montserrat',sans-serif", fontSize: 9, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>
                        View Bill →
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "bill" && selectedGuest && (
          <BillReceipt guest={selectedGuest} orders={selectedOrders} hotelId={hotelId} onBack={() => setView("dashboard")} onConfirm={confirmClose} confirming={confirming} />
        )}

        {view === "success" && settledGuest && (
          <CheckoutSuccess guest={settledGuest} grandTotal={settledTotal} onDone={handleDone} />
        )}
      </div>

      {toast && <div className="toast-box">✓ &nbsp;{toast}</div>}
    </div>
  );
}