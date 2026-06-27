import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function HotelLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    if (!email || !password) return setError("Email and password required");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const uid = cred.user.uid;

      // Check if superadmin
      const saDoc = await getDoc(doc(db, "superAdmins", uid));
      if (saDoc.exists()) {
        navigate("/superadmin");
        return;
      }

      // Check if hotel admin
      const adminDoc = await getDoc(doc(db, "hotelAdmins", uid));
      if (adminDoc.exists()) {
        const adminData = adminDoc.data();
        // Check hotel status
        const hotelDoc = await getDoc(doc(db, "hotels", adminData.hotelId));
        if (hotelDoc.exists()) {
          const hotel = hotelDoc.data();
          if (hotel.status === "pending") {
            await auth.signOut();
            setError("Your account is pending approval. Please wait for admin review.");
            setLoading(false);
            return;
          }
          if (hotel.status === "suspended") {
            await auth.signOut();
            setError("Your account has been suspended. Please contact support.");
            setLoading(false);
            return;
          }
          // Active — redirect to hotel dashboard
          navigate(`/hotel/${adminData.hotelId}`);
          return;
        }
      }

      await auth.signOut();
      setError("Account not found. Please sign up first.");
    } catch (e) {
      if (e.code === "auth/invalid-credential" || e.code === "auth/wrong-password") {
        setError("Invalid email or password");
      } else if (e.code === "auth/user-not-found") {
        setError("No account found with this email");
      } else {
        setError(e.message);
      }
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080806", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&family=Montserrat:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .M { font-family: 'Montserrat', sans-serif; }
        .inp { width:100%; background:#0a0a06; border:1px solid #252518; color:#e8e0d0; padding:13px 14px; font-family:'Cormorant Garamond',serif; font-size:16px; outline:none; transition:border-color .25s; }
        .inp:focus { border-color:#c9a84c55; }
        .inp::placeholder { color:#383828; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .spinner { width:16px; height:16px; border:2px solid #1a120833; border-top-color:#c9a84c; border-radius:50%; animation:spin .7s linear infinite; display:inline-block; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420, animation: "fadeUp .4s ease" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ color: "#c9a84c", fontSize: 32, marginBottom: 12 }}>⚜</div>
          <div className="M" style={{ fontSize: 9, letterSpacing: 5, color: "#8b7355", textTransform: "uppercase", marginBottom: 8 }}>RoomServe Platform</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 300, color: "#e8e0d0", marginBottom: 8 }}>Welcome Back</h1>
          <p className="M" style={{ fontSize: 11, color: "#555" }}>Sign in to manage your hotel</p>
        </div>

        <div style={{ background: "linear-gradient(150deg,#0f0f08,#0a0a06)", border: "1px solid #252518", padding: "36px 32px" }}>

          {/* Decorative top line */}
          <div style={{ height: 2, background: "linear-gradient(90deg,transparent,#c9a84c,transparent)", marginBottom: 28 }} />

          <div style={{ marginBottom: 16 }}>
            <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email Address</label>
            <input className="inp" type="email" placeholder="hotel@email.com" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Password</label>
            <input className="inp" type="password" placeholder="Your password" value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
          </div>

          {error && (
            <div style={{ background: "#1e0a0a", border: "1px solid #c44c4c33", padding: "10px 14px", marginBottom: 16, fontFamily: "'Montserrat',sans-serif", fontSize: 11, color: "#c47a7a" }}>
              ✕ {error}
            </div>
          )}

          <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "#333" : "linear-gradient(135deg,#c9a84c,#9a7830,#c9a84c)", backgroundSize: "200%", border: "none", color: "#0a0a06", fontFamily: "'Montserrat',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, transition: "all .3s" }}>
            {loading ? <><div className="spinner" />Signing in…</> : "Sign In →"}
          </button>

          <div style={{ textAlign: "center", marginTop: 20 }}>
            <span className="M" style={{ fontSize: 11, color: "#555" }}>New hotel? </span>
            <button onClick={() => navigate("/signup")} style={{ background: "transparent", border: "none", fontFamily: "'Montserrat',sans-serif", fontSize: 11, color: "#c9a84c", textDecoration: "underline", cursor: "pointer" }}>Register here</button>
          </div>
        </div>

        {/* Super admin hint */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <div className="M" style={{ fontSize: 9, color: "#333", letterSpacing: 1 }}>Platform powered by RoomServe · v2.0</div>
        </div>
      </div>
    </div>
  );
}