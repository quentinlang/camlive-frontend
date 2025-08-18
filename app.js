// ----- Connexion au serveur de signalisation (Render) -----
const socket = io("https://camlive-backend.onrender.com", {
  path: "/socket.io",
  transports: ["websocket"]
});

// ----- RTCPeerConnection + serveurs STUN publics -----
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478?transport=udp" }
  ]
});

const localVideo  = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream;

// Ouvre caméra/micro si pas déjà fait et lie à la vidéo locale
async function ensureLocalStream() {
  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    localVideo.srcObject = localStream;
  }
}

// Debug utile (voir F12 → Console)
pc.oniceconnectionstatechange = () => console.log("ICE:", pc.iceConnectionState);
pc.onconnectionstatechange   = () => console.log("PC:", pc.connectionState);

// Quand on reçoit la piste distante
pc.ontrack = (e) => {
  remoteVideo.srcObject = e.streams[0];
};

// Bouton "Démarrer" → on devient l'appelant : on envoie une offer
document.getElementById("start").onclick = async () => {
  await ensureLocalStream();                 // important avant de créer l'offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", offer);
};

// Quand on reçoit une offer → on devient le répondant : on ouvre la cam puis on répond
socket.on("offer", async (offer) => {
  await ensureLocalStream();                 // important pour renvoyer son flux
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", answer);
});

// Quand on reçoit une answer → on la pose
socket.on("answer", async (answer) => {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

// Échange des candidats ICE
pc.onicecandidate = (e) => { if (e.candidate) socket.emit("candidate", e.candidate); };
socket.on("candidate", async (c) => {
  try { await pc.addIceCandidate(new RTCIceCandidate(c)); }
  catch (err) { console.error("ICE add error", err); }
});