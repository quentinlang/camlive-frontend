// Connexion au serveur backend
const socket = io("https://camlive-backend.onrender.com", {
  path: "/socket.io",
  transports: ["websocket"], // évite les erreurs de mixed content
});

// Création de la connexion WebRTC
const pc = new RTCPeerConnection();

// Récupération des éléments vidéo
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

// Quand on reçoit un flux distant → on l’affiche
pc.ontrack = (event) => {
  remoteVideo.srcObject = event.streams[0];
};

// Bouton "Démarrer"
document.getElementById("start").onclick = async () => {
  // Demande accès caméra et micro
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

  // Affiche notre propre vidéo
  localVideo.srcObject = stream;

  // Ajoute nos pistes (caméra + micro) à la connexion WebRTC
  stream.getTracks().forEach((track) => pc.addTrack(track, stream));

  // Création de l’offre
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Envoi de l’offre au serveur
  socket.emit("offer", offer);
};

// Quand on reçoit une "offer"
socket.on("offer", async (offer) => {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  socket.emit("answer", answer);
});

// Quand on reçoit une "answer"
socket.on("answer", async (answer) => {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
});

// Gestion des ICE Candidates (réseau)
pc.onicecandidate = (event) => {
  if (event.candidate) {
    socket.emit("candidate", event.candidate);
  }
};

socket.on("candidate", async (candidate) => {
  try {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (err) {
    console.error("Erreur ICE :", err);
  }
});