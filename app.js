// ----- Connexion au serveur de signalisation (Render) -----
const socket = io("https://camlive-backend.onrender.com", {
  path: "/socket.io",
  transports: ["websocket"]
});

// ----- RTCPeerConnection avec serveurs STUN publics -----
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478?transport=udp" }
  ]
});

// Références aux éléments vidéo
const localVideo  = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

// Debug utile dans la console
pc.oniceconnectionstatechange = () => console.log("ICE state:", pc.iceConnectionState);
pc.onconnectionstatechange   = () => console.log("PC state:", pc.connectionState);

// Quand on reçoit la vidéo distante
pc.ontrack = (event) => {
  remoteVideo.srcObject = event.streams[0];
};

// Bouton "Démarrer"
document.getElementById("start").onclick = async () => {
  // Demander caméra + micro
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  stream.getTracks().forEach(track => pc.addTrack(track, stream));
  localVideo.srcObject = stream;

  // Créer et envoyer l'offre
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit("offer", offer);
};

// Quand on reçoit une offre : répondre
socket.on("offer", async (offer) => {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", answer);
});

// Quand on reçoit une réponse : la poser
socket.on("answer", async (answer) => {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

// Échanger les candidats ICE
pc.onicecandidate = (event) => {
  if (event.candidate) socket.emit("candidate", event.candidate);
};

socket.on("candidate", async (candidate) => {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error("Error adding candidate", err);
  }
});
 
