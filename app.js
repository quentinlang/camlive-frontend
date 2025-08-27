// ==== CONFIG ====
const BACKEND_URL = "https://camlive-backend.onrender.com"; // URL Render de ton backend

// ==== UI ====
const localVideo  = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const btnStart    = document.getElementById("start");
const btnLeave    = document.getElementById("leave");
const statusEl    = document.getElementById("status");

// Connexion Socket.io (forcer websocket pour iOS/Safari)
const socket = io(BACKEND_URL, { path: "/socket.io", transports: ["websocket"] });

// ==== STATE ====
let pc = null;
let localStream = null;
let currentRoom = null;
let joined = false;

// Helpers UI
const setStatus  = (t) => (statusEl.textContent = t ?? "");
const enableCall = (inCall) => { btnLeave.disabled = !inCall; };

// ==== MEDIA ====
async function ensureLocalStream() {
  if (localStream) return localStream;

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const constraints = {
    video: isIOS
      ? { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 }, facingMode: "user" }
      : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
  };

  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  localVideo.srcObject = localStream;
  return localStream;
}

// ==== WEBRTC ====
function createPeer() {
  if (pc) pc.close();

  pc = new RTCPeerConnection({
    iceServers: [
      // STUN public
      { urls: "stun:stun.l.google.com:19302" },
      // TURN public « gratuit » pour tests (peut être saturé ; pour la prod, prends un TURN dédié)
      {
        urls: "turn:relay1.expressturn.com:3478",
        username: "efree",
        credential: "efree"
      }
    ]
  });

  // flux distant
  pc.ontrack = (e) => {
    remoteVideo.srcObject = e.streams[0];
  };

  // envoyer nos ICE candidates
  pc.onicecandidate = (e) => {
    if (e.candidate && currentRoom) {
      socket.emit("candidate", { room: currentRoom, candidate: e.candidate });
    }
  };

  return pc;
}

// ==== SOCKET EVENTS ====
socket.on("matched", async (room) => {
  currentRoom = room;
  setStatus("Appairé • création de l’offre…");

  await ensureLocalStream();
  createPeer();

  // Ajouter nos pistes
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  const offer = await pc.createOffer({ offerToReceiveVideo: 1, offerToReceiveAudio: 1 });
  await pc.setLocalDescription(offer);
  socket.emit("offer", { room, sdp: offer });
});

socket.on("offer", async (sdp) => {
  setStatus("Réception de l’offre • création de la réponse…");

  await ensureLocalStream();
  createPeer();
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("answer", { room: currentRoom, sdp: answer });
});

socket.on("answer", async (sdp) => {
  setStatus("Réponse reçue • connexion en cours…");
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on("candidate", async (candidate) => {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error("Erreur ICE :", err);
  }
});

// ==== UI ACTIONS ====
btnStart.onclick = async () => {
  if (joined) return;
  try {
    await ensureLocalStream();             // Autoriser caméra/micro AVANT join (important pour iOS)
    socket.emit("join");
    joined = true;
    enableCall(true);
    setStatus("En file d’attente… clique Start aussi sur l’autre appareil.");
  } catch (e) {
    console.error(e);
    setStatus("Erreur accès caméra/micro. Autorise-les dans le navigateur.");
  }
};

btnLeave.onclick = () => {
  if (pc) {
    pc.getSenders().forEach((s) => { try { s.track && s.track.stop(); } catch (_) {} });
    pc.close();
    pc = null;
  }
  // garder l’aperçu local (sinon, décommente pour couper)
  // if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; localVideo.srcObject = null; }
  remoteVideo.srcObject = null;

  joined = false;
  currentRoom = null;
  enableCall(false);
  setStatus("Appel terminé. Clique Start pour recommencer.");
};

// Init
enableCall(false);
setStatus("Prêt • Ouvre la page sur 2 appareils puis clique Start des deux côtés.");
