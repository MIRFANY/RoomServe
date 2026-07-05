import { BrowserRouter, Routes, Route, useNavigate, useLocation, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// firebase and other pages import

import HotelSignup from "./pages/HotelSignup";
import HotelLogin from "./pages/HotelLogin";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import HotelAdminPanel from "./pages/hotel-admin-panel";
import AdminOrdersDashboard from "./pages/admin-orders-dashboard";
import CheckoutBilling from "./pages/checkout-billing";
import CustomerApp from "./pages/customer-app";

// ─── Wrappers that pull hotelId from URL ──────────────────────
// wrappers that pull
function AdminPanelPage() {
  const { hid } = useParams();
  return <HotelAdminPanel hotelId={hid} />;
}
function OrdersPage() {
  const { hid } = useParams();
  return <AdminOrdersDashboard hotelId={hid} />;
}
function CheckoutPage() {
  const { hid } = useParams();
  return <CheckoutBilling hotelId={hid} />;
}

// ─── Hotel Admin Nav Shell ────────────────────────────────────
function HotelAdminShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hid } = useParams();

  const tabs = [
    { path: `/hotel/${hid}`,          label: "⚙  Admin Panel"  },
    { path: `/hotel/${hid}/orders`,   label: "🔔  Live Orders"  },
    { path: `/hotel/${hid}/checkout`, label: "💳  Checkout"     },
  ];

  const handleLogout = async () => {
    await auth.signOut();
    navigate("/login");
  };

  return (
    <div style={{ fontFamily: "'Montserrat', sans-serif", minHeight: "100vh", background: "#060604" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600&family=Cormorant+Garamond:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060604; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: "#06060499", backdropFilter: "blur(12px)",
        borderBottom: "1px solid #1a1a10",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 32px", height: 56,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#c9a84c", fontSize: 16 }}>⚜</span>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, color: "#e8e0d0" }}>Grand Palace</span>
          <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#444", letterSpacing: 3, textTransform: "uppercase", marginLeft: 4 }}>Hotel Suite</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {tabs.map(t => {
            const isActive = location.pathname === t.path;
            return (
              <button key={t.path} onClick={() => navigate(t.path)} style={{
                padding: "8px 18px",
                background: isActive ? "#c9a84c0a" : "transparent",
                border: "none",
                borderBottom: `2px solid ${isActive ? "#c9a84c" : "transparent"}`,
                color: isActive ? "#c9a84c" : "#555",
                fontFamily: "'Montserrat', sans-serif",
                fontSize: 10, fontWeight: 500, letterSpacing: 1.5,
                textTransform: "uppercase", cursor: "pointer", transition: "all .25s",
              }}>{t.label}</button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4caf82", animation: "pulse 2s infinite" }} />
            <span style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, color: "#4caf82", letterSpacing: 2 }}>LIVE</span>
          </div>
          <button onClick={handleLogout} style={{ padding: "6px 14px", background: "transparent", border: "1px solid #2a2a18", color: "#666", fontFamily: "'Montserrat', sans-serif", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
            Logout
          </button>
        </div>
      </nav>

      <div style={{ paddingTop: 56 }}>
        <Routes>
          <Route path="/"          element={<AdminPanelPage />} />
          <Route path="/orders"    element={<OrdersPage />} />
          <Route path="/checkout"  element={<CheckoutPage />} />
        </Routes>
      </div>
    </div>
  );
}

// ─── Auth Gate ────────────────────────────────────────────────
function AuthGate() {
  const [user, setUser]     = useState(null);
  const [role, setRole]     = useState(null);
  const [hotelId, setHotelId] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        // Check superadmin
        const saDoc = await getDoc(doc(db, "superAdmins", u.uid));
        if (saDoc.exists()) {
          setRole("superadmin");
          setLoading(false);
          return;
        }
        // Check hotel admin
        const hotelDoc = await getDoc(doc(db, "hotelAdmins", u.uid));
        if (hotelDoc.exists()) {
          const data = hotelDoc.data();
          setRole("hotel");
          setHotelId(data.hotelId);
          setLoading(false);
          return;
        }
        setRole(null);
      } else {
        setUser(null);
        setRole(null);
        setHotelId(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Auto redirect after login
  useEffect(() => {
    if (loading) return;
    const path = window.location.pathname;
    if (role === "superadmin" && path === "/login") navigate("/superadmin");
    if (role === "hotel" && hotelId && (path === "/login" || path === "/")) navigate(`/hotel/${hotelId}`);
  }, [role, hotelId, loading]);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#060604", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ color: "#c9a84c", fontSize: 32, marginBottom: 16 }}>⚜</div>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 10, letterSpacing: 3, color: "#555" }}>LOADING…</div>
      </div>
    </div>
  );

  return (
    <Routes>
      {/* Public */}
      <Route path="/"       element={<HotelLogin />} />
      <Route path="/login"  element={<HotelLogin />} />
      <Route path="/signup" element={<HotelSignup />} />

      {/* Guest — no auth needed */}
      <Route path="/room/:hotelId/:roomNumber" element={<CustomerApp />} />

      {/* Super admin */}
      <Route path="/superadmin" element={
        role === "superadmin" ? <SuperAdminDashboard /> : <HotelLogin />
      } />

      {/* Hotel admin — shell handles nested routes */}
      <Route path="/hotel/:hid/*" element={
        role === "hotel" ? <HotelAdminShell /> : <HotelLogin />
      } />
    </Routes>
  );
}

// ─── Root ─────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthGate />
    </BrowserRouter>
  );
}
