const socket = io();

const toast = document.getElementById("toast");

function showToast(msg, type = "info", duration = 3000) {
  toast.textContent = msg;
  toast.className = `toast show ${type}`;
  setTimeout(() => { toast.className = "toast"; }, duration);
}

function validateName(name) {
  return name.trim().length >= 2;
}

// Create Room
document.getElementById("createRoomBtn").addEventListener("click", async () => {
  const userName = document.getElementById("createUserName").value.trim();
  if (!validateName(userName)) {
    showToast("Please enter your name (min 2 characters)", "error");
    return;
  }
  try {
    const res = await fetch("/create-room");
    const data = await res.json();
    const roomId = data.roomId;
    // Store userName in sessionStorage
    sessionStorage.setItem("userName", userName);
    sessionStorage.setItem("roomId", roomId);
    window.location.href = `/room/${roomId}`;
  } catch (err) {
    showToast("Failed to create room. Please try again.", "error");
  }
});

// Join Room
document.getElementById("joinRoomBtn").addEventListener("click", () => {
  const userName = document.getElementById("joinUserName").value.trim();
  const roomId = document.getElementById("roomCodeInput").value.trim().toUpperCase();
  if (!validateName(userName)) {
    showToast("Please enter your name (min 2 characters)", "error");
    return;
  }
  if (roomId.length !== 8) {
    showToast("Please enter a valid 8-character room code", "error");
    return;
  }
  sessionStorage.setItem("userName", userName);
  sessionStorage.setItem("roomId", roomId);
  window.location.href = `/room/${roomId}`;
});

// Allow Enter key on inputs
document.getElementById("createUserName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("createRoomBtn").click();
});

document.getElementById("roomCodeInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("joinRoomBtn").click();
});

document.getElementById("joinUserName").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("joinRoomBtn").click();
});

// Auto-uppercase room code
document.getElementById("roomCodeInput").addEventListener("input", function() {
  this.value = this.value.toUpperCase();
});