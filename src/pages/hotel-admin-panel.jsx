import { useState, useEffect, useRef } from "react";
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase";

const CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Snacks", "Beverages", "Desserts"];
const FLOOR_OPTIONS = ["1st Floor", "2nd Floor", "3rd Floor", "4th Floor", "5th Floor", "Penthouse"];
const ROOM_TYPES = ["Standard", "Deluxe", "Suite", "Presidential Suite"];
const EMPTY_MENU_ITEM = { name: "", category: "Breakfast", price: "", description: "", available: true, image: "🍽️" };
const EMPTY_ROOM = { number: "", floor: "1st Floor", type: "Standard", occupied: false, guestName: "" };

function RoomQR({ roomNumber, hotelId, size = 80, loaded }) {
  const ref = useRef(null);
  const rendered = useRef(false);
  useEffect(() => { rendered.current = false; }, [roomNumber]);
  useEffect(() => {
    if (!loaded || !ref.current || rendered.current) return;
    rendered.current = true;
    ref.current.innerHTML = "";
    try {
      new window.QRCode(ref.current, {
        text: `${window.location.origin}/room/${hotelId}/${roomNumber}`,
        width: size, height: size,
        colorDark: "#1a1208", colorLight: "#f0ead8",
        correctLevel: window.QRCode?.CorrectLevel?.H || 1,
      });
    } catch (e) {
      ref.current.innerHTML = `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#888">QR</div>`;
    }
  }, [loaded, roomNumber, hotelId, size]);
  if (!loaded) return <div style={{ width: size, height: size, background: "#f0ead8", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ fontSize: 9, color: "#aaa" }}>loading…</span></div>;
  return <div ref={ref} style={{ width: size, height: size, overflow: "hidden", lineHeight: 0 }} />;
}

export default function HotelAdminPanel({ hotelId }) {
  const [menu, setMenu] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("rooms");

  const [activeCategory, setActiveCategory] = useState("All");
  const [menuSearch, setMenuSearch] = useState("");
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editMenuItem, setEditMenuItem] = useState(null);
  const [menuForm, setMenuForm] = useState(EMPTY_MENU_ITEM);
  const [menuSaving, setMenuSaving] = useState(false);

  const [floorFilter, setFloorFilter] = useState("All");
  const [roomSearch, setRoomSearch] = useState("");
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editRoom, setEditRoom] = useState(null);
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM);
  const [roomSaving, setRoomSaving] = useState(false);
  const [qrPreview, setQrPreview] = useState(null);
  const [qrLibLoaded, setQrLibLoaded] = useState(false);

  const [toast, setToast] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ── Firestore paths now use hotelId ──
  const menuPath   = `hotels/${hotelId}/menu`;
  const roomsPath  = `hotels/${hotelId}/rooms`;

  useEffect(() => {
    if (window.QRCode) { setQrLibLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    s.onload = () => setQrLibLoaded(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!hotelId) return;
    const unsubMenu = onSnapshot(collection(db, menuPath), snap => {
      setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => { showToast("Error loading menu: " + err.message, "error"); setLoading(false); });

    const unsubRooms = onSnapshot(collection(db, roomsPath), snap => {
      setRooms(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => { showToast("Error loading rooms: " + err.message, "error"); });

    return () => { unsubMenu(); unsubRooms(); };
  }, [hotelId]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveMenuItem = async () => {
    if (!menuForm.name || !menuForm.price) return showToast("Name and price required", "error");
    setMenuSaving(true);
    try {
      if (editMenuItem) {
        await updateDoc(doc(db, menuPath, editMenuItem.id), { ...menuForm, price: Number(menuForm.price), updatedAt: serverTimestamp() });
        showToast(`"${menuForm.name}" updated`);
      } else {
        await addDoc(collection(db, menuPath), { ...menuForm, price: Number(menuForm.price), createdAt: serverTimestamp() });
        showToast(`"${menuForm.name}" added to menu`);
      }
      setShowMenuModal(false);
    } catch (e) { showToast("Error: " + e.message, "error"); }
    setMenuSaving(false);
  };

  const toggleAvailability = async (item) => {
    try { await updateDoc(doc(db, menuPath, item.id), { available: !item.available }); }
    catch (e) { showToast("Error updating", "error"); }
  };

  const saveRoom = async () => {
    if (!roomForm.number) return showToast("Room number required", "error");
    if (!editRoom && rooms.find(r => r.number === roomForm.number)) return showToast(`Room ${roomForm.number} already exists`, "error");
    setRoomSaving(true);
    try {
      if (editRoom) {
        await updateDoc(doc(db, roomsPath, editRoom.id), { ...roomForm, updatedAt: serverTimestamp() });
        showToast(`Room ${roomForm.number} updated`);
      } else {
        await setDoc(doc(db, roomsPath, roomForm.number), { ...roomForm, createdAt: serverTimestamp() });
        showToast(`Room ${roomForm.number} added with QR`);
      }
      setShowRoomModal(false);
    } catch (e) { showToast("Error: " + e.message, "error"); }
    setRoomSaving(false);
  };

  const doDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === "menu") {
        await deleteDoc(doc(db, menuPath, deleteConfirm.id));
        showToast("Item removed");
      } else {
        await deleteDoc(doc(db, roomsPath, deleteConfirm.id));
        showToast(`Room ${deleteConfirm.label} removed`);
      }
    } catch (e) { showToast("Error: " + e.message, "error"); }
    setDeleteConfirm(null);
  };

  const downloadQR = (roomNum) => {
    const canvas = document.querySelector(`#qr-full-${roomNum} canvas`);
    if (!canvas) return showToast("QR not ready", "error");
    const link = document.createElement("a");
    link.download = `Room-${roomNum}-QR.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const filteredMenu = menu.filter(i => (activeCategory === "All" || i.category === activeCategory) && i.name.toLowerCase().includes(menuSearch.toLowerCase()));
  const filteredRooms = rooms.filter(r => (floorFilter === "All" || r.floor === floorFilter) && (r.number?.includes(roomSearch) || r.type?.toLowerCase().includes(roomSearch.toLowerCase()) || (r.guestName || "").toLowerCase().includes(roomSearch.toLowerCase())));
  const roomStats = { total: rooms.length, occupied: rooms.filter(r => r.occupied).length, vacant: rooms.filter(r => !r.occupied).length };

  return (
    <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", minHeight: "100vh", background: "#080806", color: "#e8e0d0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: #8b7355; }
        .M { font-family: 'Montserrat', sans-serif; }
        .btn-gold { background: linear-gradient(135deg,#c9a84c,#9a7830,#c9a84c); background-size:200%; color:#0a0a08; border:none; padding:10px 22px; font-family:'Montserrat',sans-serif; font-size:10px; font-weight:600; letter-spacing:2.5px; text-transform:uppercase; cursor:pointer; transition:all .3s; display:inline-flex; align-items:center; gap:8px; }
        .btn-gold:hover { background-position:right; box-shadow:0 0 18px #c9a84c55; }
        .btn-gold:disabled { background:#333; color:#555; cursor:not-allowed; box-shadow:none; }
        .btn-outline { background:transparent; color:#c9a84c; border:1px solid #c9a84c44; padding:8px 18px; font-family:'Montserrat',sans-serif; font-size:10px; letter-spacing:2px; text-transform:uppercase; cursor:pointer; transition:all .3s; }
        .btn-outline:hover { border-color:#c9a84c; background:#c9a84c0d; }
        .btn-danger { background:transparent; border:1px solid #6a2a2a44; color:#c47a7a; padding:7px 14px; font-family:'Montserrat',sans-serif; font-size:10px; letter-spacing:1.5px; text-transform:uppercase; cursor:pointer; }
        .card { background:linear-gradient(150deg,#131208,#0e0e08); border:1px solid #252518; }
        .card-hover { transition:all .35s; }
        .card-hover:hover { border-color:#303020; transform:translateY(-2px); box-shadow:0 12px 40px #00000066; }
        .pill { padding:5px 16px; font-family:'Montserrat',sans-serif; font-size:9px; font-weight:500; letter-spacing:2px; text-transform:uppercase; border:1px solid #252518; background:transparent; color:#666; cursor:pointer; transition:all .25s; }
        .pill.on { border-color:#c9a84c; color:#c9a84c; background:#c9a84c11; }
        .pill:hover:not(.on) { border-color:#383828; color:#aaa; }
        .tog { width:42px; height:22px; background:#1a1a12; border:1px solid #2a2a1a; border-radius:11px; cursor:pointer; position:relative; transition:all .3s; flex-shrink:0; }
        .tog.on { background:#c9a84c18; border-color:#c9a84c; }
        .tog::after { content:''; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#333; transition:all .3s; }
        .tog.on::after { left:22px; background:#c9a84c; }
        .inp { width:100%; background:#0a0a06; border:1px solid #252518; color:#e8e0d0; padding:10px 13px; font-family:'Cormorant Garamond',serif; font-size:15px; outline:none; transition:border-color .25s; }
        .inp:focus { border-color:#c9a84c55; }
        .inp::placeholder { color:#383828; }
        select.inp option { background:#131208; }
        .modal-bg { position:fixed; inset:0; background:#000000cc; backdrop-filter:blur(5px); display:flex; align-items:center; justify-content:center; z-index:200; }
        .modal { background:#0a0a06; border:1px solid #252518; width:90%; max-width:500px; max-height:92vh; overflow-y:auto; animation:su .28s ease; }
        .hr { height:1px; background:linear-gradient(90deg,transparent,#252518,transparent); }
        .tag { display:inline-flex; align-items:center; padding:3px 9px; font-family:'Montserrat',sans-serif; font-size:8px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; }
        .tag-gold { background:#c9a84c0e; color:#c9a84c; border:1px solid #c9a84c2a; }
        .tag-green { background:#2a4a2a22; color:#6aaa6a; border:1px solid #4a8a4a33; }
        .tag-grey { background:#33333322; color:#555; border:1px solid #33333333; }
        .toast-box { position:fixed; bottom:28px; right:28px; padding:13px 22px; font-family:'Montserrat',sans-serif; font-size:11px; font-weight:500; letter-spacing:1px; z-index:999; animation:su .3s ease; }
        .toast-ok { background:#151510; border:1px solid #c9a84c44; color:#c9a84c; }
        .toast-err { background:#150e0e; border:1px solid #c44c4c44; color:#c47a7a; }
        .qr-plate { background:#f0ead8; display:inline-flex; flex-direction:column; align-items:center; gap:8px; }
        .spinner { width:16px; height:16px; border:2px solid #c9a84c33; border-top-color:#c9a84c; border-radius:50%; animation:spin .7s linear infinite; display:inline-block; }
        @keyframes su { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 36px 0" }}>
        {/* TABS */}
        <div style={{ display: "flex", borderBottom: "1px solid #181810", marginBottom: 32 }}>
          {[{ k: "rooms", l: "🏨  Rooms" }, { k: "menu", l: "⚙  Menu" }, { k: "stats", l: "📊  Analytics" }].map(t => (
            <button key={t.k} onClick={() => setActiveTab(t.k)} className="M"
              style={{ padding: "12px 26px", fontSize: 9, fontWeight: 500, letterSpacing: 2, textTransform: "uppercase", background: "transparent", border: "none", cursor: "pointer", color: activeTab === t.k ? "#c9a84c" : "#444", borderBottom: `2px solid ${activeTab === t.k ? "#c9a84c" : "transparent"}`, transition: "all .3s" }}>
              {t.l}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: "0 auto 16px" }} />
            <div className="M" style={{ fontSize: 10, letterSpacing: 3, color: "#555" }}>LOADING FROM FIREBASE…</div>
          </div>
        )}

        {/* ROOMS TAB */}
        {!loading && activeTab === "rooms" && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 32 }}>
            {[{ l: "Total Rooms", v: roomStats.total, i: "🏨" }, { l: "Occupied", v: roomStats.occupied, i: "🔑" }, { l: "Vacant", v: roomStats.vacant, i: "🛏" }, { l: "QR Codes", v: rooms.length, i: "⬛" }].map(s => (
              <div key={s.l} className="card" style={{ padding: "18px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 20, marginBottom: 7 }}>{s.i}</div>
                <div style={{ fontSize: 26, fontWeight: 300, color: "#c9a84c" }}>{s.v}</div>
                <div className="M" style={{ fontSize: 9, letterSpacing: 2, color: "#555", marginTop: 5, textTransform: "uppercase" }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {["All", ...FLOOR_OPTIONS].map(f => <button key={f} className={`pill ${floorFilter === f ? "on" : ""}`} onClick={() => setFloorFilter(f)}>{f}</button>)}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#444", fontSize: 13 }}>🔍</span>
                <input className="inp" placeholder="Search rooms…" value={roomSearch} onChange={e => setRoomSearch(e.target.value)} style={{ width: 190, paddingLeft: 34 }} />
              </div>
              <button className="btn-gold" onClick={() => { setEditRoom(null); setRoomForm(EMPTY_ROOM); setShowRoomModal(true); }}>+ Add Room</button>
            </div>
          </div>
          {filteredRooms.length === 0
            ? <div style={{ textAlign: "center", padding: "70px 0", color: "#333" }}><div style={{ fontSize: 36, marginBottom: 12 }}>🏨</div><div className="M" style={{ fontSize: 10, letterSpacing: 3 }}>NO ROOMS YET — ADD YOUR FIRST ROOM</div></div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 18 }}>
                {filteredRooms.map(room => (
                  <div key={room.id} className="card card-hover" style={{ borderLeft: `3px solid ${room.occupied ? "#c9a84c55" : "#2a4a2a55"}` }}>
                    <div style={{ padding: "18px 18px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ width: 50, height: 50, background: room.occupied ? "#1a1408" : "#0a120a", border: `1px solid ${room.occupied ? "#c9a84c22" : "#2a4a2a33"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, position: "relative", flexShrink: 0 }}>
                          🚪
                          {room.occupied && <div style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: "50%", background: "#c9a84c" }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 500, color: "#e8e0d0", marginBottom: 3 }}>Room {room.number}</div>
                          <div className="M" style={{ fontSize: 9, color: "#8b7355", letterSpacing: 1 }}>{room.type} · {room.floor}</div>
                          {room.occupied && room.guestName && <div className="M" style={{ fontSize: 10, color: "#c9a84c", marginTop: 4 }}>👤 {room.guestName}</div>}
                        </div>
                      </div>
                      <span className={`tag ${room.occupied ? "tag-gold" : "tag-green"}`}>{room.occupied ? "Occupied" : "Vacant"}</span>
                    </div>
                    <div className="hr" />
                    <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                      <div className="qr-plate" style={{ padding: 8 }}><RoomQR roomNumber={room.number} hotelId={hotelId} size={52} loaded={qrLibLoaded} /></div>
                      <div>
                        <div className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#8b7355", textTransform: "uppercase", marginBottom: 4 }}>Scan URL</div>
                        <div className="M" style={{ fontSize: 9, color: "#555" }}>{window.location.origin}/room/{hotelId}/{room.number}</div>
                      </div>
                    </div>
                    <div className="hr" />
                    <div style={{ padding: "11px 18px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button className="btn-outline" style={{ padding: "6px 12px", fontSize: 9 }} onClick={() => setQrPreview(room)}>QR</button>
                      <button className="btn-outline" style={{ padding: "6px 12px", fontSize: 9 }} onClick={() => { setEditRoom(room); setRoomForm({ ...room }); setShowRoomModal(true); }}>Edit</button>
                      <button className="btn-danger" onClick={() => setDeleteConfirm({ type: "room", id: room.id, label: room.number })}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
          }
        </>}

        {/* MENU TAB */}
        {!loading && activeTab === "menu" && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 32 }}>
            {[{ l: "Total Items", v: menu.length, i: "📋" }, { l: "Available", v: menu.filter(i => i.available).length, i: "✅" }, { l: "Unavailable", v: menu.filter(i => !i.available).length, i: "⛔" }, { l: "Categories", v: [...new Set(menu.map(i => i.category))].length, i: "🏷" }].map(s => (
              <div key={s.l} className="card" style={{ padding: "18px 20px", textAlign: "center" }}>
                <div style={{ fontSize: 20, marginBottom: 7 }}>{s.i}</div>
                <div style={{ fontSize: 26, fontWeight: 300, color: "#c9a84c" }}>{s.v}</div>
                <div className="M" style={{ fontSize: 9, letterSpacing: 2, color: "#555", marginTop: 5, textTransform: "uppercase" }}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
              {["All", ...CATEGORIES].map(c => <button key={c} className={`pill ${activeCategory === c ? "on" : ""}`} onClick={() => setActiveCategory(c)}>{c}</button>)}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#444", fontSize: 13 }}>🔍</span>
                <input className="inp" placeholder="Search menu…" value={menuSearch} onChange={e => setMenuSearch(e.target.value)} style={{ width: 190, paddingLeft: 34 }} />
              </div>
              <button className="btn-gold" onClick={() => { setEditMenuItem(null); setMenuForm(EMPTY_MENU_ITEM); setShowMenuModal(true); }}>+ Add Item</button>
            </div>
          </div>
          {filteredMenu.length === 0
            ? <div style={{ textAlign: "center", padding: "70px 0", color: "#333" }}><div style={{ fontSize: 36, marginBottom: 12 }}>🍽️</div><div className="M" style={{ fontSize: 10, letterSpacing: 3 }}>NO ITEMS YET — CLICK "+ ADD ITEM"</div></div>
            : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 18 }}>
                {filteredMenu.map(item => (
                  <div key={item.id} className="card card-hover">
                    <div style={{ padding: "18px 18px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        <div style={{ width: 48, height: 48, background: "#131208", border: "1px solid #252518", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{item.image}</div>
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>{item.name}</div>
                          <span className="tag tag-gold">{item.category}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div className="M" style={{ fontSize: 9, color: "#555" }}>INR</div>
                        <div style={{ fontSize: 18, color: "#c9a84c" }}>₹{Number(item.price).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="hr" />
                    <div style={{ padding: "10px 18px", fontStyle: "italic", color: "#555", fontSize: 13 }}>{item.description}</div>
                    <div className="hr" />
                    <div style={{ padding: "11px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <div className={`tog ${item.available ? "on" : ""}`} onClick={() => toggleAvailability(item)} />
                        <span className={`tag ${item.available ? "tag-gold" : "tag-grey"}`}>{item.available ? "Available" : "Unavailable"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 7 }}>
                        <button className="btn-outline" style={{ padding: "6px 12px", fontSize: 9 }} onClick={() => { setEditMenuItem(item); setMenuForm({ ...item, price: String(item.price) }); setShowMenuModal(true); }}>Edit</button>
                        <button className="btn-danger" onClick={() => setDeleteConfirm({ type: "menu", id: item.id, label: item.name })}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
          }
        </>}

        {/* ANALYTICS TAB */}
        {!loading && activeTab === "stats" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 22 }}>
            <div className="card" style={{ padding: 26 }}>
              <div className="M" style={{ fontSize: 9, letterSpacing: 3, color: "#8b7355", textTransform: "uppercase", marginBottom: 18 }}>Room Occupancy by Floor</div>
              {FLOOR_OPTIONS.map(fl => {
                const total = rooms.filter(r => r.floor === fl).length;
                const occ = rooms.filter(r => r.floor === fl && r.occupied).length;
                const pct = total ? Math.round(occ / total * 100) : 0;
                return (
                  <div key={fl} style={{ marginBottom: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span className="M" style={{ fontSize: 10, color: "#aaa" }}>{fl}</span>
                      <span className="M" style={{ fontSize: 10, color: "#c9a84c" }}>{occ}/{total} occupied</span>
                    </div>
                    <div style={{ height: 3, background: "#1a1a10", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#8b7355,#c9a84c)", borderRadius: 2, transition: "width .5s" }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="card" style={{ padding: 26 }}>
              <div className="M" style={{ fontSize: 9, letterSpacing: 3, color: "#8b7355", textTransform: "uppercase", marginBottom: 18 }}>Menu by Category</div>
              {CATEGORIES.map(cat => {
                const count = menu.filter(i => i.category === cat).length;
                const pct = menu.length ? Math.round(count / menu.length * 100) : 0;
                return (
                  <div key={cat} style={{ marginBottom: 13 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span className="M" style={{ fontSize: 10, color: "#aaa" }}>{cat}</span>
                      <span className="M" style={{ fontSize: 10, color: "#c9a84c" }}>{count} items</span>
                    </div>
                    <div style={{ height: 3, background: "#1a1a10", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,#8b7355,#c9a84c)", borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ROOM MODAL */}
      {showRoomModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowRoomModal(false)}>
          <div className="modal">
            <div style={{ padding: "22px 26px", borderBottom: "1px solid #181810" }}>
              <div className="M" style={{ fontSize: 8, letterSpacing: 3, color: "#8b7355", textTransform: "uppercase", marginBottom: 4 }}>{editRoom ? "Edit Room" : "New Room"}</div>
              <div style={{ fontSize: 20, fontWeight: 300 }}>{editRoom ? `Room ${editRoom.number}` : "Add New Room"}</div>
            </div>
            <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 15 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Room Number *</label>
                  <input className="inp" placeholder="101" value={roomForm.number} disabled={!!editRoom} onChange={e => setRoomForm(f => ({ ...f, number: e.target.value }))} />
                </div>
                <div>
                  <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Floor</label>
                  <select className="inp" value={roomForm.floor} onChange={e => setRoomForm(f => ({ ...f, floor: e.target.value }))}>
                    {FLOOR_OPTIONS.map(fl => <option key={fl}>{fl}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Room Type</label>
                <select className="inp" value={roomForm.type} onChange={e => setRoomForm(f => ({ ...f, type: e.target.value }))}>
                  {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className={`tog ${roomForm.occupied ? "on" : ""}`} onClick={() => setRoomForm(f => ({ ...f, occupied: !f.occupied, guestName: "" }))} />
                <span className="M" style={{ fontSize: 10, color: "#666" }}>{roomForm.occupied ? "Currently occupied" : "Currently vacant"}</span>
              </div>
              {roomForm.occupied && (
                <div>
                  <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Guest Name</label>
                  <input className="inp" placeholder="e.g. Arjun Mehta" value={roomForm.guestName} onChange={e => setRoomForm(f => ({ ...f, guestName: e.target.value }))} />
                </div>
              )}
              {roomForm.number && (
                <div style={{ background: "#060604", border: "1px solid #1e1e10", padding: 14, display: "flex", alignItems: "center", gap: 14 }}>
                  <div className="qr-plate" style={{ padding: 8 }}><RoomQR roomNumber={roomForm.number} hotelId={hotelId} size={60} loaded={qrLibLoaded} /></div>
                  <div>
                    <div className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#8b7355", textTransform: "uppercase", marginBottom: 5 }}>QR Preview</div>
                    <div className="M" style={{ fontSize: 9, color: "#555" }}>{window.location.origin}/room/{hotelId}/{roomForm.number}</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: "14px 26px 22px", display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #181810" }}>
              <button className="btn-outline" onClick={() => setShowRoomModal(false)}>Cancel</button>
              <button className="btn-gold" disabled={roomSaving} onClick={saveRoom}>
                {roomSaving ? <><span className="spinner" />Saving…</> : editRoom ? "Update Room" : "Add Room & Generate QR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MENU MODAL */}
      {showMenuModal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setShowMenuModal(false)}>
          <div className="modal">
            <div style={{ padding: "22px 26px", borderBottom: "1px solid #181810" }}>
              <div className="M" style={{ fontSize: 8, letterSpacing: 3, color: "#8b7355", textTransform: "uppercase", marginBottom: 4 }}>{editMenuItem ? "Edit Item" : "New Item"}</div>
              <div style={{ fontSize: 20, fontWeight: 300 }}>{editMenuItem ? editMenuItem.name : "Add to Menu"}</div>
            </div>
            <div style={{ padding: "22px 26px", display: "flex", flexDirection: "column", gap: 15 }}>
              <div>
                <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 7 }}>Icon</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["🍳","🥘","🍛","🍝","🍚","🐟","🥩","🍖","🥗","🍜","🥪","🍮","🧁","🍰","🥃","🍵","☕","🥤","🧃","🍽️"].map(e => (
                    <button key={e} onClick={() => setMenuForm(f => ({ ...f, image: e }))} style={{ width: 34, height: 34, background: menuForm.image === e ? "#c9a84c1a" : "#0e0e08", border: `1px solid ${menuForm.image === e ? "#c9a84c" : "#222"}`, cursor: "pointer", fontSize: 17 }}>{e}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Item Name *</label>
                <input className="inp" placeholder="e.g. Truffle Risotto" value={menuForm.name} onChange={e => setMenuForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Category</label>
                  <select className="inp" value={menuForm.category} onChange={e => setMenuForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Price (₹) *</label>
                  <input className="inp" type="number" placeholder="0" value={menuForm.price} onChange={e => setMenuForm(f => ({ ...f, price: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="M" style={{ fontSize: 8, letterSpacing: 2, color: "#666", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Description</label>
                <textarea className="inp" rows={3} placeholder="Brief description…" value={menuForm.description} onChange={e => setMenuForm(f => ({ ...f, description: e.target.value }))} style={{ resize: "vertical" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className={`tog ${menuForm.available ? "on" : ""}`} onClick={() => setMenuForm(f => ({ ...f, available: !f.available }))} />
                <span className="M" style={{ fontSize: 10, color: "#666" }}>{menuForm.available ? "Available to order" : "Currently unavailable"}</span>
              </div>
            </div>
            <div style={{ padding: "14px 26px 22px", display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #181810" }}>
              <button className="btn-outline" onClick={() => setShowMenuModal(false)}>Cancel</button>
              <button className="btn-gold" disabled={menuSaving} onClick={saveMenuItem}>
                {menuSaving ? <><span className="spinner" />Saving…</> : editMenuItem ? "Update Item" : "Add to Menu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR MODAL */}
      {qrPreview && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setQrPreview(null)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div style={{ padding: "22px 26px", borderBottom: "1px solid #181810" }}>
              <div className="M" style={{ fontSize: 8, letterSpacing: 3, color: "#8b7355", textTransform: "uppercase", marginBottom: 4 }}>Room QR Code</div>
              <div style={{ fontSize: 20, fontWeight: 300 }}>Room {qrPreview.number} · {qrPreview.type}</div>
            </div>
            <div style={{ padding: "30px 26px", display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
              <div id={`qr-full-${qrPreview.number}`} style={{ background: "#f0ead8", padding: "20px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div className="M" style={{ fontSize: 8, letterSpacing: 4, color: "#1a1208", textTransform: "uppercase" }}>⚜ RoomServe ⚜</div>
                <RoomQR roomNumber={qrPreview.number} hotelId={hotelId} size={190} loaded={qrLibLoaded} />
                <div className="M" style={{ fontSize: 8, letterSpacing: 3, color: "#2a2008", textTransform: "uppercase" }}>Room {qrPreview.number} · Scan to Order</div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn-outline" onClick={() => setQrPreview(null)}>Close</button>
                <button className="btn-gold" onClick={() => downloadQR(qrPreview.number)}>⬇ Download QR</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRM */}
      {deleteConfirm && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 360 }}>
            <div style={{ padding: "26px 26px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 30, marginBottom: 14 }}>⚠️</div>
              <div style={{ fontSize: 17, marginBottom: 7 }}>Remove {deleteConfirm.type === "room" ? `Room ${deleteConfirm.label}` : `"${deleteConfirm.label}"`}?</div>
              <div className="M" style={{ fontSize: 10, color: "#555" }}>This cannot be undone.</div>
            </div>
            <div style={{ padding: "0 26px 22px", display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="btn-outline" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={{ background: "#1e0808", border: "1px solid #c44c4c33", color: "#c47a7a", padding: "10px 22px", fontFamily: "'Montserrat',sans-serif", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }} onClick={doDelete}>Confirm Remove</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast-box ${toast.type === "error" ? "toast-err" : "toast-ok"}`}>{toast.type === "error" ? "✕  " : "✓  "}{toast.msg}</div>}

      <div style={{ marginTop: 72, borderTop: "1px solid #141410", padding: "18px 36px", textAlign: "center" }}>
        <div className="M" style={{ fontSize: 8, letterSpacing: 3, color: "#222", textTransform: "uppercase" }}>RoomServe · Hotel ID: {hotelId}</div>
      </div>
    </div>
  );
}