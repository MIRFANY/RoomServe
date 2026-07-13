import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";

export default function HotelSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    hotelName: "", ownerName: "", email: "", phone: "", city: "", password: "", confirm: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // handle signup

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSignup = async () => {
    setError("");
    if (!form.hotelName || !form.ownerName || !form.email || !form.phone || !form.city || !form.password) {
      return setError("All fields are required");
    }
    if (form.password !== form.confirm) return setError("Passwords do not match");
    if (form.password.length < 6) return setError("Password must be at least 6 characters");

    setLoading(true);
    try {
      // Create Firebase Auth user
      const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
      const uid = cred.user.uid;

      // Generate hotel ID from hotel name
      const hotelId = form.hotelName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + uid.slice(0, 6);

      // Save hotel registration (pending approval)
      await setDoc(doc(db, "hotels", hotelId), {
        hotelId,
        hotelName: form.hotelName,
        ownerName: form.ownerName,
        email: form.email,
        phone: form.phone,
        city: form.city,
        status: "pending", // pending | active | suspended
        createdAt: serverTimestamp(),
        revenue: 0,
      });

      // Save hotel admin record
      await setDoc(doc(db, "hotelAdmins", uid), {
        uid,
        hotelId,
        hotelName: form.hotelName,
        email: form.email,
        role: "hotelAdmin",
        createdAt: serverTimestamp(),
      });

      //  hotel signup

      await auth.signOut(); // Sign out until approved
      setSuccess(true);
    } catch (e) {
      if (e.code === "auth/email-already-in-use") setError("This email is already registered");
      else setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080806", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400&family=Montserrat:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .M { font-family: 'Montserrat', sans-serif; }
        .inp { width:100%; background:#0a0a06; border:1px solid #252518; color:#e8e0d0; padding:12px 14px; font-family:'Cormorant Garamond',serif; font-size:15px; outline:none; transition:border-color .25s; }
        .inp:focus { border-color:#c9a84c55; }
        .inp::placeholder { color:#383828; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .spinner { width:16px; height:16px; border:2px solid #1a120833; border-top-color:#1a1208; border-radius:50%; animation:spin .7s linear infinite; display:inline-block; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 520, animation: "fadeUp .4s ease" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ color: "#c9a84c", fontSize: 28, marginBottom: 12 }}>⚜</div>
          <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 9, letterSpacing: 5, color: "#8b7355", textTransform: "uppercase", marginBottom: 8 }}>RoomServe Platform</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 300, color: "#e8e0d0", marginBottom: 8 }}>Register Your Hotel</h1>
          <p style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#555" }}>Your account will be reviewed and activated within 24 hours</p>
        </div>

        {success ? (
          // Success state
          <div style={{ background: "#0a1808", border: "1px solid #4caf8233", padding: "40px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>✅</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, letterSpacing: 3, color: "#4caf82", textTransform: "uppercase", marginBottom: 12 }}>Registration Submitted!</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: "#e8e0d0", marginBottom: 8 }}>{form.hotelName}</div>
            <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: 11, color: "#666", marginBottom: 28, lineHeight: 1.6 }}>
              Your registration is pending approval.<br />
              You'll be able to login once the admin approves your account.
            </div>
            <button onClick={() => navigate("/login")} style={{ padding: "12px 32px", background: "linear-gradient(135deg,#c9a84c,#9a7830)", border: "none", color: "#0a0a06", fontFamily: "'Montserrat',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
              Go to Login →
            </button>
          </div>
        ) : (
          // Form
          <div style={{ background: "linear-gradient(150deg,#0f0f08,#0a0a06)", border: "1px solid #252518", padding: "36px 32px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Hotel Name *</label>
                <input className="inp" placeholder="e.g. Grand Palace Hotel" value={form.hotelName} onChange={e => update("hotelName", e.target.value)} />
              </div>
              <div>
                <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Owner Name *</label>
                <input className="inp" placeholder="e.g. Rajiv Sharma" value={form.ownerName} onChange={e => update("ownerName", e.target.value)} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email *</label>
                <input className="inp" type="email" placeholder="hotel@email.com" value={form.email} onChange={e => update("email", e.target.value)} />
              </div>
              <div>
                <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Phone *</label>
                <input className="inp" placeholder="+91 98765 43210" value={form.phone} onChange={e => update("phone", e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>City *</label>
              <input className="inp" placeholder="e.g. Mumbai, Delhi, Bangalore" value={form.city} onChange={e => update("city", e.target.value)} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Password *</label>
                <input className="inp" type="password" placeholder="Min 6 characters" value={form.password} onChange={e => update("password", e.target.value)} />
              </div>
              <div>
                <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Confirm Password *</label>
                <input className="inp" type="password" placeholder="Repeat password" value={form.confirm} onChange={e => update("confirm", e.target.value)} />
              </div>
            </div>

            {error && (
              <div style={{ background: "#1e0a0a", border: "1px solid #c44c4c33", padding: "10px 14px", marginBottom: 16, fontFamily: "'Montserrat',sans-serif", fontSize: 11, color: "#c47a7a" }}>
                ✕ {error}
              </div>
            )}

            <button onClick={handleSignup} disabled={loading} style={{ width: "100%", padding: "14px", background: loading ? "#333" : "linear-gradient(135deg,#c9a84c,#9a7830,#c9a84c)", backgroundSize: "200%", border: "none", color: "#0a0a06", fontFamily: "'Montserrat',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              {loading ? <><div className="spinner" />Registering…</> : "Register Hotel →"}
            </button>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <span style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 11, color: "#555" }}>Already have an account? </span>
              <button onClick={() => navigate("/login")} style={{ background: "transparent", border: "none", fontFamily: "'Montserrat',sans-serif", fontSize: 11, color: "#c9a84c", textDecoration: "underline", cursor: "pointer" }}>Login here</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
