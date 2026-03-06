/* =============================================
   NexMeet — Room Logic
   WebRTC + Socket.io + Recording + YT Co-watch
   ============================================= */

const socket = io();

// Debug: Check socket connection
console.log("🔌 Attempting to connect to Socket.io...");
socket.on("connect", () => {
  console.log("✅ Socket.io connected:", socket.id);
});
socket.on("disconnect", (reason) => {
  console.warn("❌ Socket.io disconnected:", reason);
});
socket.on("connect_error", (error) => {
  console.error("❌ Socket.io connection error:", error);
});

// ── State ─────────────────────────────────────
const state = {
  roomId: window.location.pathname.split("/").pop(),
  userName: sessionStorage.getItem("userName") || "Guest",
  localStream: null,
  screenStream: null,
  peers: new Map(),      // socketId → RTCPeerConnection
  peerStreams: new Map(), // socketId → MediaStream
  peerNames: new Map(),  // socketId → userName
  isAudioMuted: false,
  isVideoOff: false,
  isSharingScreen: false,
  isRecording: false,
  mediaRecorder: null,
  recordedChunks: [],
  callStartTime: null,
  timerInterval: null,
  unreadCount: 0,
  sidebarOpen: true,
  ytPlayer: null,
  ytPlayerReady: false,
  ytSyncing: false,
};

// ── ICE Servers (STUN) ─────────────────────────
const iceServers = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

// ── DOM References ─────────────────────────────
const els = {
  localVideo:         document.getElementById("localVideo"),
  localNoVideo:       document.getElementById("localNoVideo"),
  localAvatar:        document.getElementById("localAvatar"),
  localAvatarName:    document.getElementById("localAvatarName"),
  localUserLabel:     document.getElementById("localUserLabel"),
  localMicIndicator:  document.getElementById("localMicIndicator"),
  videoGrid:          document.getElementById("videoGrid"),
  roomCodeDisplay:    document.getElementById("roomCodeDisplay"),
  recordingIndicator: document.getElementById("recordingIndicator"),
  callTimer:          document.getElementById("callTimer"),
  participantCount:   document.getElementById("participantCount"),
  toggleAudioBtn:     document.getElementById("toggleAudioBtn"),
  toggleVideoBtn:     document.getElementById("toggleVideoBtn"),
  screenShareBtn:     document.getElementById("screenShareBtn"),
  youtubePanelBtn:    document.getElementById("youtubePanelBtn"),
  recordBtn:          document.getElementById("recordBtn"),
  raiseHandBtn:       document.getElementById("raiseHandBtn"),
  sidebarToggleBtn:   document.getElementById("sidebarToggleBtn"),
  leaveBtn:           document.getElementById("leaveBtn"),
  sidebar:            document.getElementById("sidebar"),
  chatMessages:       document.getElementById("chatMessages"),
  chatInput:          document.getElementById("chatInput"),
  chatSendBtn:        document.getElementById("chatSendBtn"),
  participantsList:   document.getElementById("participantsList"),
  youtubePanel:       document.getElementById("youtubePanel"),
  ytUrlInput:         document.getElementById("ytUrlInput"),
  ytLoadBtn:          document.getElementById("ytLoadBtn"),
  ytCloseBtn:         document.getElementById("ytCloseBtn"),
  ytPlaceholder:      document.getElementById("ytPlaceholder"),
  copyRoomCode:       document.getElementById("copyRoomCode"),
  modalOverlay:       document.getElementById("modalOverlay"),
  cancelLeave:        document.getElementById("cancelLeave"),
  confirmLeave:       document.getElementById("confirmLeave"),
  toast:              document.getElementById("toast"),
  raiseHandPopup:     document.getElementById("raiseHandPopup"),
  raiseHandText:      document.getElementById("raiseHandText"),
  unreadBadge:        document.getElementById("unreadBadge"),
  chatTab:            document.getElementById("chatTab"),
  participantsTab:    document.getElementById("participantsTab"),
  chatPanel:          document.getElementById("chatPanel"),
  participantsPanel:  document.getElementById("participantsPanel"),
};

// ── Init ───────────────────────────────────────
async function init() {
  if (!state.userName || state.userName === "Guest") {
    const name = prompt("Enter your display name:") || "Guest";
    state.userName = name;
    sessionStorage.setItem("userName", name);
  }

  els.roomCodeDisplay.textContent = state.roomId;
  els.localUserLabel.textContent = "You (" + state.userName + ")";
  els.localAvatar.textContent = state.userName.charAt(0).toUpperCase();
  els.localAvatarName.textContent = state.userName;

  try {
    console.log("📷 Requesting camera and microphone access...");
    state.localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    els.localVideo.srcObject = state.localStream;
    console.log("✅ Camera & microphone access granted");
    showToast("Camera & microphone ready", "success");
  } catch (err) {
    console.warn("⚠️ Media error:", err);
    showToast("Could not access camera/mic — joining audio-only", "info");
    try {
      console.log("🎤 Requesting audio-only access...");
      state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("✅ Audio-only access granted");
    } catch (e) {
      console.error("❌ No media access available:", e);
      state.localStream = new MediaStream();
    }
    setVideoOff(true);
  }

  socket.emit("join-room", { roomId: state.roomId, userName: state.userName });
  addParticipant("local", state.userName, true);
  startCallTimer();
  updateGridLayout();
}

// ── Timer ──────────────────────────────────────
function startCallTimer() {
  state.callStartTime = Date.now();
  state.timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.callStartTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    els.callTimer.textContent = `${m}:${s}`;
  }, 1000);
}

// ── Grid Layout ────────────────────────────────
function updateGridLayout() {
  const count = state.peers.size + 1; // +1 for local
  const grid = els.videoGrid;
  grid.className = "video-grid";
  if (count === 1) grid.classList.add("solo");
  else if (count === 2) grid.classList.add("duo");
  else if (count <= 4) grid.classList.add("quad");
  else grid.classList.add("many");

  els.participantCount.innerHTML = `<i class="fas fa-users"></i> ${count}`;
}

// ── WebRTC: Create Peer ─────────────────────────
function createPeer(remoteSocketId, isInitiator) {
  const pc = new RTCPeerConnection(iceServers);

  state.localStream.getTracks().forEach((track) => {
    pc.addTrack(track, state.localStream);
  });

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      socket.emit("ice-candidate", {
        to: remoteSocketId,
        from: socket.id,
        candidate,
      });
    }
  };

  pc.ontrack = ({ streams }) => {
    if (streams && streams[0]) {
      state.peerStreams.set(remoteSocketId, streams[0]);
      const tile = document.getElementById(`tile-${remoteSocketId}`);
      if (tile) {
        const video = tile.querySelector("video");
        if (video) video.srcObject = streams[0];
      }
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
      console.warn(`Peer ${remoteSocketId} disconnected`);
    }
  };

  if (isInitiator) {
    pc.onnegotiationneeded = async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", {
          to: remoteSocketId,
          from: socket.id,
          offer,
          userName: state.userName,
        });
      } catch (err) {
        console.error("Offer error:", err);
      }
    };
  }

  state.peers.set(remoteSocketId, pc);
  return pc;
}

// ── Remote Tile ─────────────────────────────────
function addRemoteTile(socketId, userName) {
  const tile = document.createElement("div");
  tile.className = "video-tile";
  tile.id = `tile-${socketId}`;

  const initial = userName.charAt(0).toUpperCase();

  tile.innerHTML = `
    <video autoplay playsinline></video>
    <div class="video-overlay">
      <div class="user-label">
        <i class="fas fa-user-circle"></i>
        <span>${userName}</span>
      </div>
      <div class="tile-indicators">
        <span class="indicator" id="mic-${socketId}" title="Mic on">
          <i class="fas fa-microphone"></i>
        </span>
      </div>
    </div>
    <div class="no-video-placeholder" id="noVideo-${socketId}" style="display:none">
      <div class="avatar-placeholder">${initial}</div>
      <span>${userName}</span>
    </div>
  `;

  els.videoGrid.appendChild(tile);
  updateGridLayout();

  if (state.peerStreams.has(socketId)) {
    tile.querySelector("video").srcObject = state.peerStreams.get(socketId);
  }
}

function removeRemoteTile(socketId) {
  const tile = document.getElementById(`tile-${socketId}`);
  if (tile) tile.remove();
  state.peers.delete(socketId);
  state.peerStreams.delete(socketId);
  state.peerNames.delete(socketId);
  updateGridLayout();
}

// ── Participant List ────────────────────────────
function addParticipant(socketId, userName, isLocal = false) {
  const item = document.createElement("div");
  item.className = "participant-item";
  item.id = `participant-${socketId}`;

  const initial = userName.charAt(0).toUpperCase();

  item.innerHTML = `
    <div class="participant-avatar">${initial}</div>
    <div class="participant-info">
      <div class="participant-name">${userName} ${isLocal ? "(You)" : ""}</div>
      <div class="participant-status">In meeting</div>
    </div>
    <div class="participant-icons">
      <span class="p-icon active" id="pmic-${socketId}"><i class="fas fa-microphone"></i></span>
      <span class="p-icon active" id="pvid-${socketId}"><i class="fas fa-video"></i></span>
    </div>
  `;
  els.participantsList.appendChild(item);
}

function removeParticipant(socketId) {
  const item = document.getElementById(`participant-${socketId}`);
  if (item) item.remove();
}

// ── Socket Events ───────────────────────────────
socket.on("existing-users", (users) => {
  users.forEach(({ socketId, userName }) => {
    state.peerNames.set(socketId, userName);
    addRemoteTile(socketId, userName);
    addParticipant(socketId, userName);
    const pc = createPeer(socketId, true);
    state.peers.set(socketId, pc);
  });
});

socket.on("user-joined", ({ socketId, userName }) => {
  state.peerNames.set(socketId, userName);
  addRemoteTile(socketId, userName);
  addParticipant(socketId, userName);
  createPeer(socketId, false);
  showToast(`${userName} joined`, "success");
  appendSystemMessage(`${userName} joined the meeting`);
});

socket.on("offer", async ({ from, offer, userName }) => {
  let pc = state.peers.get(from);
  if (!pc) {
    state.peerNames.set(from, userName);
    pc = createPeer(from, false);
    state.peers.set(from, pc);
  }
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { to: from, from: socket.id, answer });
});

socket.on("answer", async ({ from, answer }) => {
  const pc = state.peers.get(from);
  if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

socket.on("ice-candidate", async ({ from, candidate }) => {
  const pc = state.peers.get(from);
  if (pc && candidate) {
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
    catch (e) { console.warn("ICE error:", e); }
  }
});

socket.on("user-left", ({ socketId, userName }) => {
  removeRemoteTile(socketId);
  removeParticipant(socketId);
  const name = userName || state.peerNames.get(socketId) || "Someone";
  showToast(`${name} left`, "info");
  appendSystemMessage(`${name} left the meeting`);
});

socket.on("media-state", ({ socketId, video, audio }) => {
  const micEl = document.getElementById(`mic-${socketId}`);
  const pmicEl = document.getElementById(`pmic-${socketId}`);
  const pvidEl = document.getElementById(`pvid-${socketId}`);
  const noVideoEl = document.getElementById(`noVideo-${socketId}`);
  const tile = document.getElementById(`tile-${socketId}`);

  if (micEl) {
    micEl.className = `indicator ${audio ? "" : "muted"}`;
    micEl.innerHTML = `<i class="fas fa-microphone${audio ? "" : "-slash"}"></i>`;
  }
  if (pmicEl) pmicEl.className = `p-icon ${audio ? "active" : "muted"}`;
  if (pvidEl) pvidEl.className = `p-icon ${video ? "active" : "muted"}`;
  if (noVideoEl) noVideoEl.style.display = video ? "none" : "flex";
  if (tile) {
    const v = tile.querySelector("video");
    if (v) v.style.display = video ? "block" : "none";
  }
});

socket.on("screen-share-started", ({ socketId, userName }) => {
  showToast(`${userName} is sharing their screen`, "info");
  appendSystemMessage(`${userName} started screen sharing`);
});

socket.on("screen-share-stopped", ({ socketId }) => {
  const name = state.peerNames.get(socketId) || "Someone";
  showToast(`${name} stopped screen sharing`, "info");
});

socket.on("chat-message", ({ message, userName, time, id }) => {
  appendChatMessage(message, userName, time, id === socket.id);
});

socket.on("raise-hand", ({ socketId, userName }) => {
  showRaiseHand(userName);
});

socket.on("youtube-url", ({ url, from }) => {
  showYouTubePanel();
  els.ytUrlInput.value = url;
  loadYouTubeVideo(url);
  showToast(`${from} loaded a YouTube video`, "info");
});

socket.on("youtube-play", ({ time }) => {
  if (state.ytPlayer && state.ytPlayerReady) {
    state.ytSyncing = true;
    state.ytPlayer.seekTo(time, true);
    state.ytPlayer.playVideo();
    setTimeout(() => { state.ytSyncing = false; }, 1000);
  }
});

socket.on("youtube-pause", ({ time }) => {
  if (state.ytPlayer && state.ytPlayerReady) {
    state.ytSyncing = true;
    state.ytPlayer.seekTo(time, true);
    state.ytPlayer.pauseVideo();
    setTimeout(() => { state.ytSyncing = false; }, 1000);
  }
});

socket.on("youtube-seek", ({ time }) => {
  if (state.ytPlayer && state.ytPlayerReady) {
    state.ytSyncing = true;
    state.ytPlayer.seekTo(time, true);
    setTimeout(() => { state.ytSyncing = false; }, 1000);
  }
});

// ── Audio Toggle ────────────────────────────────
function toggleAudio() {
  state.isAudioMuted = !state.isAudioMuted;
  state.localStream.getAudioTracks().forEach((t) => {
    t.enabled = !state.isAudioMuted;
  });

  const btn = els.toggleAudioBtn;
  const icon = btn.querySelector("i");
  const label = btn.querySelector("span");

  if (state.isAudioMuted) {
    icon.className = "fas fa-microphone-slash";
    label.textContent = "Unmute";
    btn.classList.add("inactive");
    els.localMicIndicator.className = "indicator muted";
    els.localMicIndicator.innerHTML = `<i class="fas fa-microphone-slash"></i>`;
  } else {
    icon.className = "fas fa-microphone";
    label.textContent = "Mute";
    btn.classList.remove("inactive");
    els.localMicIndicator.className = "indicator";
    els.localMicIndicator.innerHTML = `<i class="fas fa-microphone"></i>`;
  }

  socket.emit("media-state", {
    roomId: state.roomId,
    video: !state.isVideoOff,
    audio: !state.isAudioMuted,
  });
}

// ── Video Toggle ────────────────────────────────
function setVideoOff(off) {
  state.isVideoOff = off;
  state.localStream.getVideoTracks().forEach((t) => {
    t.enabled = !off;
  });

  const btn = els.toggleVideoBtn;
  const icon = btn.querySelector("i");
  const label = btn.querySelector("span");
  els.localNoVideo.style.display = off ? "flex" : "none";
  els.localVideo.style.display = off ? "none" : "block";

  if (off) {
    icon.className = "fas fa-video-slash";
    label.textContent = "Start Video";
    btn.classList.add("inactive");
  } else {
    icon.className = "fas fa-video";
    label.textContent = "Stop Video";
    btn.classList.remove("inactive");
  }

  socket.emit("media-state", {
    roomId: state.roomId,
    video: !state.isVideoOff,
    audio: !state.isAudioMuted,
  });
}

function toggleVideo() {
  setVideoOff(!state.isVideoOff);
}

// ── Screen Share ─────────────────────────────────
async function toggleScreenShare() {
  if (state.isSharingScreen) {
    stopScreenShare();
    return;
  }

  try {
    state.screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { cursor: "always" },
      audio: true,
    });

    const videoTrack = state.screenStream.getVideoTracks()[0];

    // Replace video track in all peer connections
    state.peers.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
      if (sender) sender.replaceTrack(videoTrack);
    });

    // Show screen in local video
    const prevStream = els.localVideo.srcObject;
    els.localVideo.srcObject = state.screenStream;

    videoTrack.onended = () => {
      stopScreenShare(prevStream);
    };

    state.isSharingScreen = true;
    els.screenShareBtn.classList.add("active");
    els.screenShareBtn.querySelector("span").textContent = "Stop Share";
    socket.emit("screen-share-started", { roomId: state.roomId, userName: state.userName });
    showToast("Screen sharing started", "success");
  } catch (err) {
    if (err.name !== "NotAllowedError") {
      showToast("Could not start screen share", "error");
    }
  }
}

function stopScreenShare(prevStream) {
  if (!state.isSharingScreen) return;

  const camTrack = state.localStream.getVideoTracks()[0];

  state.peers.forEach((pc) => {
    const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
    if (sender && camTrack) sender.replaceTrack(camTrack);
  });

  els.localVideo.srcObject = state.localStream;
  if (state.screenStream) {
    state.screenStream.getTracks().forEach((t) => t.stop());
    state.screenStream = null;
  }

  state.isSharingScreen = false;
  els.screenShareBtn.classList.remove("active");
  els.screenShareBtn.querySelector("span").textContent = "Share Screen";
  socket.emit("screen-share-stopped", { roomId: state.roomId });
  showToast("Screen sharing stopped", "info");
}

// ── Recording ───────────────────────────────────
async function toggleRecording() {
  if (state.isRecording) {
    stopRecording();
    return;
  }
  await startRecording();
}

async function startRecording() {
  try {
    // Combine local stream + audio from peers
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");

    const audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();

    // Add local audio
    if (state.localStream.getAudioTracks().length > 0) {
      const src = audioCtx.createMediaStreamSource(state.localStream);
      src.connect(destination);
    }

    // Add remote audio streams
    state.peerStreams.forEach((stream) => {
      if (stream.getAudioTracks().length > 0) {
        try {
          const src = audioCtx.createMediaStreamSource(stream);
          src.connect(destination);
        } catch (e) {}
      }
    });

    // Render all video tiles to canvas
    function drawFrame() {
      if (!state.isRecording) return;

      ctx.fillStyle = "#0d0d14";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const videos = document.querySelectorAll(".video-tile video");
      const count = videos.length;
      if (count === 0) { requestAnimationFrame(drawFrame); return; }

      const cols = count === 1 ? 1 : 2;
      const rows = Math.ceil(count / cols);
      const w = canvas.width / cols;
      const h = canvas.height / rows;

      videos.forEach((v, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        try {
          ctx.drawImage(v, col * w, row * h, w, h);
        } catch (e) {}
      });

      requestAnimationFrame(drawFrame);
    }
    requestAnimationFrame(drawFrame);

    const canvasStream = canvas.captureStream(30);
    const combined = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";

    state.mediaRecorder = new MediaRecorder(combined, { mimeType });
    state.recordedChunks = [];

    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) state.recordedChunks.push(e.data);
    };

    state.mediaRecorder.onstop = () => {
      const blob = new Blob(state.recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
      a.download = `NexMeet-Recording-${dateStr}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Recording saved to your device!", "success", 4000);
      audioCtx.close();
    };

    state.mediaRecorder.start(1000); // capture in 1s chunks
    state.isRecording = true;

    els.recordBtn.classList.add("recording");
    els.recordBtn.querySelector("i").className = "fas fa-stop-circle";
    els.recordBtn.querySelector("span").textContent = "Stop Rec";
    els.recordingIndicator.style.display = "flex";
    showToast("Recording started", "success");
    appendSystemMessage("Recording started");

  } catch (err) {
    console.error("Recording error:", err);
    showToast("Failed to start recording", "error");
  }
}

function stopRecording() {
  if (state.mediaRecorder && state.isRecording) {
    state.mediaRecorder.stop();
    state.isRecording = false;
    els.recordBtn.classList.remove("recording");
    els.recordBtn.querySelector("i").className = "fas fa-record-vinyl";
    els.recordBtn.querySelector("span").textContent = "Record";
    els.recordingIndicator.style.display = "none";
    appendSystemMessage("Recording stopped");
  }
}

// ── Chat ────────────────────────────────────────
function sendMessage() {
  const text = els.chatInput.value.trim();
  if (!text) return;
  socket.emit("chat-message", { roomId: state.roomId, message: text, userName: state.userName });
  els.chatInput.value = "";
}

function appendChatMessage(message, userName, time, isOwn = false) {
  const welcomeMsg = els.chatMessages.querySelector(".chat-welcome");
  if (welcomeMsg) welcomeMsg.remove();

  const div = document.createElement("div");
  div.className = `chat-msg ${isOwn ? "own" : ""}`;
  div.innerHTML = `
    <div class="chat-msg-header">
      <span class="chat-msg-name ${isOwn ? "own" : ""}">${userName}</span>
      <span class="chat-msg-time">${time}</span>
    </div>
    <div class="chat-msg-bubble">${escapeHtml(message)}</div>
  `;
  els.chatMessages.appendChild(div);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;

  if (!isOwn && !state.sidebarOpen) {
    state.unreadCount++;
    els.unreadBadge.textContent = state.unreadCount;
    els.unreadBadge.style.display = "flex";
  }
}

function appendSystemMessage(text) {
  const div = document.createElement("div");
  div.style.cssText = "text-align:center;font-size:11px;color:rgba(255,255,255,0.3);padding:4px 0;";
  div.textContent = text;
  els.chatMessages.appendChild(div);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── Raise Hand ──────────────────────────────────
function raiseHand() {
  socket.emit("raise-hand", { roomId: state.roomId, userName: state.userName });
  showRaiseHand(state.userName + " (You)");
  els.raiseHandBtn.classList.add("active");
  setTimeout(() => els.raiseHandBtn.classList.remove("active"), 3000);
}

function showRaiseHand(userName) {
  els.raiseHandText.textContent = `${userName} raised their hand ✋`;
  els.raiseHandPopup.style.display = "flex";
  setTimeout(() => { els.raiseHandPopup.style.display = "none"; }, 4000);
}

// ── YouTube Panel ────────────────────────────────
function showYouTubePanel() {
  els.youtubePanel.style.display = "flex";
  els.youtubePanelBtn.classList.add("active");
}

function hideYouTubePanel() {
  els.youtubePanel.style.display = "none";
  els.youtubePanelBtn.classList.remove("active");
}

function extractYouTubeId(url) {
  const match = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/
  );
  return match ? match[1] : null;
}

function loadYouTubeVideo(url) {
  const videoId = extractYouTubeId(url);
  if (!videoId) {
    showToast("Invalid YouTube URL", "error");
    return;
  }

  els.ytPlaceholder.style.display = "none";

  if (state.ytPlayer && state.ytPlayerReady) {
    state.ytPlayer.loadVideoById(videoId);
  } else {
    state.ytPlayer = new YT.Player("ytPlayer", {
      videoId,
      playerVars: { autoplay: 0, modestbranding: 1, rel: 0 },
      events: {
        onReady: () => {
          state.ytPlayerReady = true;
          showToast("YouTube video loaded", "success");
        },
        onStateChange: (event) => {
          if (state.ytSyncing) return;
          if (event.data === YT.PlayerState.PLAYING) {
            socket.emit("youtube-play", { roomId: state.roomId, time: state.ytPlayer.getCurrentTime() });
          } else if (event.data === YT.PlayerState.PAUSED) {
            socket.emit("youtube-pause", { roomId: state.roomId, time: state.ytPlayer.getCurrentTime() });
          }
        },
      },
    });
  }
}

// ── Sidebar ─────────────────────────────────────
function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  els.sidebar.classList.toggle("collapsed", !state.sidebarOpen);

  if (state.sidebarOpen) {
    state.unreadCount = 0;
    els.unreadBadge.style.display = "none";
    els.sidebarToggleBtn.classList.add("active");
  } else {
    els.sidebarToggleBtn.classList.remove("active");
  }
}

function switchTab(tab) {
  document.querySelectorAll(".sidebar-tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".sidebar-content").forEach((p) => p.classList.remove("active"));

  if (tab === "chat") {
    els.chatTab.classList.add("active");
    els.chatPanel.classList.add("active");
    state.unreadCount = 0;
    els.unreadBadge.style.display = "none";
  } else {
    els.participantsTab.classList.add("active");
    els.participantsPanel.classList.add("active");
  }
}

// ── Leave Room ───────────────────────────────────
function leaveRoom() {
  stopRecording();
  if (state.screenStream) state.screenStream.getTracks().forEach((t) => t.stop());
  if (state.localStream) state.localStream.getTracks().forEach((t) => t.stop());
  clearInterval(state.timerInterval);
  state.peers.forEach((pc) => pc.close());
  socket.disconnect();
  window.location.href = "/";
}

// ── Toast ────────────────────────────────────────
function showToast(msg, type = "info", duration = 3000) {
  els.toast.textContent = msg;
  els.toast.className = `toast show ${type}`;
  setTimeout(() => { els.toast.className = "toast"; }, duration);
}

// ── Copy Room Code ───────────────────────────────
els.copyRoomCode.addEventListener("click", () => {
  navigator.clipboard.writeText(state.roomId).then(() => {
    showToast("Room code copied!", "success");
  });
});

// ── Event Listeners ──────────────────────────────
els.toggleAudioBtn.addEventListener("click", toggleAudio);
els.toggleVideoBtn.addEventListener("click", toggleVideo);
els.screenShareBtn.addEventListener("click", toggleScreenShare);
els.youtubePanelBtn.addEventListener("click", () => {
  if (els.youtubePanel.style.display === "none") showYouTubePanel();
  else hideYouTubePanel();
});
els.recordBtn.addEventListener("click", toggleRecording);
els.raiseHandBtn.addEventListener("click", raiseHand);
els.sidebarToggleBtn.addEventListener("click", toggleSidebar);
els.leaveBtn.addEventListener("click", () => {
  els.modalOverlay.style.display = "flex";
});
els.cancelLeave.addEventListener("click", () => {
  els.modalOverlay.style.display = "none";
});
els.confirmLeave.addEventListener("click", leaveRoom);

els.chatSendBtn.addEventListener("click", sendMessage);
els.chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

els.ytLoadBtn.addEventListener("click", () => {
  const url = els.ytUrlInput.value.trim();
  if (!url) { showToast("Please enter a YouTube URL", "error"); return; }
  loadYouTubeVideo(url);
  socket.emit("youtube-url", { roomId: state.roomId, url });
});

els.ytCloseBtn.addEventListener("click", hideYouTubePanel);

els.chatTab.addEventListener("click", () => switchTab("chat"));
els.participantsTab.addEventListener("click", () => switchTab("participants"));

// ── YouTube iframe API Callback ──────────────────
window.onYouTubeIframeAPIReady = () => {
  // API is ready; player will be created when a video is loaded
};

// ── Start ─────────────────────────────────────────
init();