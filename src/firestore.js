// src/firestore.js
// ─── All Firestore read/write functions for the Hotel App ───

import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  getDocs, getDoc, onSnapshot, query, where, orderBy, serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

// ════════════════════════════════════════
//  MENU
// ════════════════════════════════════════

// Get all menu items (one time)
export async function getMenu() {
  const snap = await getDocs(collection(db, "menu"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Add a new menu item
export async function addMenuItem(item) {
  return await addDoc(collection(db, "menu"), {
    ...item,
    createdAt: serverTimestamp()
  });
}

// Update a menu item
export async function updateMenuItem(id, data) {
  return await updateDoc(doc(db, "menu", id), data);
}

// Delete a menu item
export async function deleteMenuItem(id) {
  return await deleteDoc(doc(db, "menu", id));
}

// Toggle availability
export async function toggleMenuAvailability(id, available) {
  return await updateDoc(doc(db, "menu", id), { available });
}

// ════════════════════════════════════════
//  ROOMS
// ════════════════════════════════════════

// Get all rooms (one time)
export async function getRooms() {
  const snap = await getDocs(collection(db, "rooms"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Add a new room
export async function addRoom(room) {
  // Use room number as document ID so it's unique
  return await setDoc(doc(db, "rooms", room.number), {
    ...room,
    createdAt: serverTimestamp()
  });
}

// Update a room
export async function updateRoom(roomNumber, data) {
  return await updateDoc(doc(db, "rooms", roomNumber), data);
}

// Delete a room
export async function deleteRoom(roomNumber) {
  return await deleteDoc(doc(db, "rooms", roomNumber));
}

// ════════════════════════════════════════
//  GUESTS / ACCOUNTS
// ════════════════════════════════════════

// Create guest account when they scan QR and verify OTP
export async function createGuestAccount(roomNumber, mobile, name) {
  return await setDoc(doc(db, "guests", roomNumber), {
    roomNumber,
    mobile,
    name,
    checkIn: serverTimestamp(),
    pendingAmount: 0,
    active: true,
  });
}

// Get guest by room number
export async function getGuest(roomNumber) {
  const snap = await getDoc(doc(db, "guests", roomNumber));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Get all active guests (for admin dashboard)
export async function getActiveGuests() {
  const q = query(collection(db, "guests"), where("active", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Listen to all active guests in real time (for admin)
export function listenToActiveGuests(callback) {
  const q = query(collection(db, "guests"), where("active", "==", true));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ════════════════════════════════════════
//  ORDERS
// ════════════════════════════════════════

// Place a new order (called from Customer App)
export async function placeOrder(roomNumber, guestName, items, total) {
  return await addDoc(collection(db, "orders"), {
    roomNumber,
    guestName,
    items,
    total,
    status: "pending",       // pending → accepted → preparing → ready → delivered
    createdAt: serverTimestamp(),
    acceptedAt: null,
    deliveredAt: null,
  });
}

// Listen to orders for a specific room in real time (Customer App)
export function listenToRoomOrders(roomNumber, callback) {
  const q = query(
    collection(db, "orders"),
    where("roomNumber", "==", roomNumber),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// Listen to ALL orders in real time (Admin Orders Dashboard)
export function listenToAllOrders(callback) {
  const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// Update order status (Admin accepts/rejects/prepares)
export async function updateOrderStatus(orderId, status) {
  const data = { status };
  if (status === "accepted")  data.acceptedAt = serverTimestamp();
  if (status === "delivered") data.deliveredAt = serverTimestamp();
  return await updateDoc(doc(db, "orders", orderId), data);
}

// ════════════════════════════════════════
//  BILLING / CHECKOUT
// ════════════════════════════════════════

// Get all orders for a room (for billing)
export async function getRoomOrders(roomNumber) {
  const q = query(
    collection(db, "orders"),
    where("roomNumber", "==", roomNumber),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Close billing for a room (checkout)
export async function closeBilling(roomNumber) {
  // Mark guest as inactive (checked out)
  await updateDoc(doc(db, "guests", roomNumber), {
    active: false,
    checkOut: serverTimestamp(),
    pendingAmount: 0,
  });

  // Mark all their orders as settled
  const orders = await getRoomOrders(roomNumber);
  const updates = orders.map(o =>
    updateDoc(doc(db, "orders", o.id), { status: "settled" })
  );
  await Promise.all(updates);
}
