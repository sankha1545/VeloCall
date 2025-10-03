/* client.js
   Updated WebRTC client for MedicoX Meeting
   - Best-effort window close after confirming leave
   - Robust DOM guards, screen-filling layout, sender tracking, modal, etc.
*/

(function () {
  'use strict';

  // ----- config and DOM -----
  const params = new URLSearchParams(location.search);
  const room = params.get('room') || `room-${Math.random().toString(36).slice(2,8)}`;
  const startWithVideo = params.get('video') !== 'false';
  const startWithAudio = params.get('audio') !== 'false';

  // DOM
  const roomLabel = document.getElementById('roomLabel');
  const roomShort = document.getElementById('roomShort');
  const localVideo = document.getElementById('localVideo');
  const videosDiv = document.getElementById('videos');
  const connectionStatus = document.getElementById('connectionStatus');
  const peerCountEl = document.getElementById('peerCount');
  const localBadge = document.getElementById('localBadge');
  const micStatus = document.getElementById('micStatus');

  const btnToggleAudio = document.getElementById('btnToggleAudio');
  const btnToggleAudioText = document.getElementById('btnToggleAudioText');
  const btnToggleAudioIcon = document.getElementById('btnToggleAudioIcon');
  const btnToggleVideo = document.getElementById('btnToggleVideo');
  const btnToggleVideoText = document.getElementById('btnToggleVideoText');
  const btnToggleVideoIcon = document.getElementById('btnToggleVideoIcon');
  const btnToggleScreenShare = document.getElementById('btnToggleScreenShare');
  const btnCopyLink = document.getElementById('btnCopyLink');
  const btnLeave = document.getElementById('btnLeave');
  const btnReconnect = document.getElementById('btnReconnect');
  const btnToggleStats = document.getElementById('btnToggleStats');

  const confirmModal = document.getElementById('confirmModal');
  const confirmLeave = document.getElementById('confirmLeave');
  const cancelLeave = document.getElementById('cancelLeave');

  // websocket base - include room as query so server can route if desired
  const wsBase = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?room=' + encodeURIComponent(room);

  // ----- state -----
  let ws = null;
  let myId = null;
  const peers = new Map(); // remoteId -> { pc, container, video, senders: {audio, video} }
  const pendingCandidates = new Map();

  let localStreamPromise = null;
  let localStream = null;
  let screenStream = null;

  let ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  let iceConfigFetched = false;

  // reconnect/backoff
  let reconnectAttempts = 0;
  const RECONNECT_MAX = 6;
  let reconnectTimer = null;

  // expose for debugging/testing
  window.getLocalStream = async () => await ensureLocalStream();
  window.leaveRoom = leaveRoom;

  // ----- ICE / TURN fetching -----
  async function getIceConfig(retries = 3) {
    if (iceConfigFetched) return ICE_CONFIG;
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch('/turn');
        if (!res.ok) throw new Error('no-turn');
        const body = await res.json();
        const turnServers = [];
        if (Array.isArray(body.iceServers)) turnServers.push(...body.iceServers);
        else if (body && body.urls) {
          if (Array.isArray(body.urls)) body.urls.forEach(u => turnServers.push({ urls: u }));
          else turnServers.push({ urls: body.urls, username: body.username, credential: body.credential });
        }
        ICE_CONFIG = { iceServers: [...turnServers, { urls: 'stun:stun.l.google.com:19302' }] };
        iceConfigFetched = true;
        console.log('ICE config', ICE_CONFIG);
        return ICE_CONFIG;
      } catch (e) {
        console.warn('getIceConfig attempt failed', e);
        await new Promise(r => setTimeout(r, 800));
      }
    }
    ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    iceConfigFetched = true;
    console.warn('Using fallback STUN only');
    return ICE_CONFIG;
  }

  // ----- Local media -----
  async function ensureLocalStream() {
    if (localStream) return localStream;
    if (!localStreamPromise) {
      localStreamPromise = navigator.mediaDevices.getUserMedia({ audio: startWithAudio, video: startWithVideo })
        .then(s => { localStream = s; attachLocalStreamToTile(); return s; })
        .catch(err => { localStreamPromise = null; throw err; });
    }
    return localStreamPromise;
  }

  function attachLocalStreamToTile() {
    if (!localVideo) return;
    if (!localStream) { localVideo.srcObject = null; if (localBadge) localBadge.textContent = 'You (camera off)'; return; }

    localVideo.srcObject = localStream;

    const hasVideoEnabled = localStream.getVideoTracks().some(t => t.enabled);
    if (localBadge) localBadge.textContent = `You (${hasVideoEnabled ? 'camera on' : 'camera off'})`;

    const audioOn = localStream.getAudioTracks().some(t => t.enabled);
    if (micStatus) micStatus.textContent = `Mic: ${audioOn ? 'active' : 'muted'}`;

    updateAudioButton();
    updateVideoButton();
  }

  // ----- UI helpers -----
  function updatePeerCount() {
    const count = 1 + peers.size;
    if (peerCountEl) peerCountEl.textContent = String(count);
  }

  function audioEnabled() {
    return !!(localStream && localStream.getAudioTracks().length && localStream.getAudioTracks()[0].enabled);
  }

  function videoEnabled() {
    return !!(localStream && localStream.getVideoTracks().length && localStream.getVideoTracks()[0].enabled);
  }

  function updateAudioButton() {
    const enabled = audioEnabled();
    if (btnToggleAudioText) btnToggleAudioText.textContent = enabled ? 'Mute' : 'Unmute';
    if (btnToggleAudioIcon) btnToggleAudioIcon.textContent = enabled ? '🔈' : '🔇';
    if (btnToggleAudio) btnToggleAudio.setAttribute('aria-pressed', String(!enabled));
    if (micStatus) micStatus.textContent = `Mic: ${enabled ? 'active' : 'muted'}`;
  }

  function updateVideoButton() {
    const enabled = videoEnabled();
    if (btnToggleVideoText) btnToggleVideoText.textContent = enabled ? 'Disable Video' : 'Enable Video';
    if (btnToggleVideoIcon) btnToggleVideoIcon.textContent = enabled ? '🎥' : '🚫';
    if (btnToggleVideo) btnToggleVideo.setAttribute('aria-pressed', String(!enabled));
  }

  // ----- Tile / DOM creation -----
  function createRemoteTile(id) {
    // avoid duplicate
    if (document.getElementById(`tile-${id}`)) return { container: document.getElementById(`tile-${id}`), video: document.getElementById(`video-${id}`) };

    const container = document.createElement('div');
    container.className = 'tile';
    container.id = `tile-${id}`;

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.id = `video-${id}`;
    video.muted = false;
    container.appendChild(video);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = id;
    container.appendChild(meta);

    if (videosDiv) videosDiv.appendChild(container);
    return { container, video };
  }

  // ----- Signaling: WebSocket -----
  async function connectWS() {
    await getIceConfig();
    if (connectionStatus) connectionStatus.textContent = 'Connecting...';

    try {
      ws = new WebSocket(wsBase);
    } catch (e) {
      console.error('WebSocket init failed', e);
      if (connectionStatus) connectionStatus.textContent = 'WS init failed';
      scheduleReconnect();
      return;
    }

    ws.addEventListener('open', async () => {
      console.log('ws open, joining', room);
      reconnectAttempts = 0;
      if (connectionStatus) connectionStatus.textContent = 'Connected — joining';
      safeSend({ type: 'join', room });
      try { await ensureLocalStream(); } catch (e) { console.warn('getUserMedia failed', e); if (connectionStatus) connectionStatus.textContent = 'Camera access denied/unavailable'; }
    });

    ws.addEventListener('message', async ev => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (e) { console.warn('invalid ws message', ev.data); return; }
      if (!msg || !msg.type) return;
      switch (msg.type) {
        case 'joined':
          myId = msg.id;
          if (roomLabel) roomLabel.textContent = `Room: ${room}`;
          if (roomShort) roomShort.textContent = room;
          if (connectionStatus) connectionStatus.textContent = 'Joined';
          try {
            await ensureLocalStream();
            attachLocalStreamToTile();
            (msg.others || []).forEach(otherId => createOfferToPeer(otherId));
          } catch (e) { console.warn('local stream not ready', e); }
          break;

        case 'new-peer':
          if (msg.id) {
            try { await ensureLocalStream(); createOfferToPeer(msg.id); } catch (e) { console.warn('cannot create offer - local stream missing', e); }
          }
          break;

        case 'signal':
          await handleSignal(msg.from, msg.payload);
          break;

        case 'peer-left':
          closePeer(msg.id);
          break;

        case 'error':
          console.error('server error', msg.message);
          break;

        default:
          console.warn('unknown message type', msg.type);
      }
    });

    ws.addEventListener('close', () => {
      if (connectionStatus) connectionStatus.textContent = 'Disconnected';
      console.warn('ws closed');
      scheduleReconnect();
    });

    ws.addEventListener('error', e => {
      console.error('ws error', e);
      if (connectionStatus) connectionStatus.textContent = 'WebSocket error';
    });
  }

  function scheduleReconnect() {
    reconnectAttempts = Math.min(RECONNECT_MAX, reconnectAttempts + 1);
    const base = Math.min(30000, 500 * Math.pow(2, reconnectAttempts));
    const wait = Math.floor(base * (0.85 + Math.random() * 0.3)); // add jitter
    console.log(`reconnect attempt ${reconnectAttempts} in ${wait}ms`);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => { if (!ws || ws.readyState === WebSocket.CLOSED) connectWS(); }, wait);
  }

  function safeSend(obj) {
    if (!ws || ws.readyState !== WebSocket.OPEN) { console.warn('cannot send, ws not open', obj); return; }
    try { ws.send(JSON.stringify(obj)); } catch (e) { console.warn('ws send failed', e); }
  }

  // ----- PeerConnection management -----
  async function createPeerConnection(remoteId) {
    await getIceConfig();
    const pc = new RTCPeerConnection(ICE_CONFIG);

    pc.onicecandidate = ev => { if (ev.candidate) safeSend({ type: 'signal', room, to: remoteId, from: myId, payload: { type: 'candidate', candidate: ev.candidate } }); };

    pc.ontrack = ev => { const data = peers.get(remoteId); if (data && data.video) data.video.srcObject = ev.streams[0]; };

    pc.onconnectionstatechange = () => { const state = pc.connectionState; console.log(`pc(${remoteId}) state`, state); if (state === 'failed' || state === 'disconnected' || state === 'closed') closePeer(remoteId); };

    // attach local tracks, prefer screenStream when active
    try {
      const s = screenStream || await ensureLocalStream();
      if (s) {
        // keep track of senders for later replace/remove
        const mySenders = { audio: null, video: null };
        s.getTracks().forEach(track => {
          try {
            const sender = pc.addTrack(track, s);
            if (track.kind === 'audio') mySenders.audio = sender;
            if (track.kind === 'video') mySenders.video = sender;
          } catch (e) { /* ignore */ }
        });
        const entry = peers.get(remoteId);
        if (entry) entry.senders = mySenders;
      }
    } catch (e) { /* ignore */ }

    return pc;
  }

  async function createOfferToPeer(remoteId) {
    if (peers.has(remoteId) && peers.get(remoteId).pc) return;
    const { container, video } = createRemoteTile(remoteId);
    peers.set(remoteId, { pc: null, container, video, senders: {} });
    updatePeerCount();

    const pc = await createPeerConnection(remoteId);
    peers.get(remoteId).pc = pc;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      safeSend({ type: 'signal', room, to: remoteId, from: myId, payload: { type: 'offer', sdp: offer.sdp } });
    } catch (e) { console.warn('createOffer failed', e); }
  }

  async function handleSignal(from, payload) {
    if (!from || !payload) return;
    if (!peers.has(from)) {
      const { container, video } = createRemoteTile(from);
      peers.set(from, { pc: null, container, video, senders: {} });
      updatePeerCount();
    }

    const peerData = peers.get(from);
    if (!peerData.pc) {
      const pc = await createPeerConnection(from);
      peerData.pc = pc;
    }
    const pc = peerData.pc;

    switch (payload.type) {
      case 'offer':
        try {
          await pc.setRemoteDescription({ type: 'offer', sdp: payload.sdp });
          flushPendingCandidates(from, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          safeSend({ type: 'signal', room, to: from, from: myId, payload: { type: 'answer', sdp: answer.sdp } });
        } catch (e) { console.warn('offer handling failed', e); }
        break;

      case 'answer':
        try { await pc.setRemoteDescription({ type: 'answer', sdp: payload.sdp }); flushPendingCandidates(from, pc); } catch (e) { console.warn('answer failed', e); }
        break;

      case 'candidate':
        try {
          if (pc.remoteDescription && pc.remoteDescription.type) await pc.addIceCandidate(payload.candidate);
          else { const arr = pendingCandidates.get(from) || []; arr.push(payload.candidate); pendingCandidates.set(from, arr); }
        } catch (e) { console.warn('addIceCandidate failed', e); }
        break;

      default:
        console.warn('unknown payload', payload.type);
    }
  }

  function flushPendingCandidates(id, pc) {
    const arr = pendingCandidates.get(id) || [];
    arr.forEach(async c => { try { await pc.addIceCandidate(c); } catch (e) { console.warn('queued candidate add failed', e); } });
    pendingCandidates.delete(id);
  }

  function closePeer(id) {
    const data = peers.get(id);
    if (!data) return;
    try { if (data.pc) data.pc.close(); } catch (e) { /* ignore */ }
    if (data.video && data.video.srcObject) data.video.srcObject = null;
    if (data.container && data.container.parentNode) data.container.parentNode.removeChild(data.container);
    peers.delete(id);
    pendingCandidates.delete(id);
    updatePeerCount();
  }

  // ----- Leave / cleanup -----
  async function leaveRoom() {
    try { if (ws && ws.readyState === WebSocket.OPEN) safeSend({ type: 'leave', room }); } catch (e) { }
    try { if (ws) ws.close(); } catch (e) { }

    try { if (localStream) localStream.getTracks().forEach(t => t.stop()); } catch (e) { }
    try { if (screenStream) screenStream.getTracks().forEach(t => t.stop()); } catch (e) { }

    for (const id of Array.from(peers.keys())) closePeer(id);

    myId = null;
    localStream = null;
    localStreamPromise = null;
    screenStream = null;

    if (connectionStatus) connectionStatus.textContent = 'Left';
    if (localVideo) localVideo.srcObject = null;
  }

  // Best-effort window close: will work if the window/tab was opened by JS (window.open).
  // If blocked by the browser, fall back to navigating away to about:blank.
  function tryCloseWindow() {
    try {
      // Attempt to close directly
      window.open('', '_self'); // some browsers require this before close
      window.close();
      // Give browser a moment — if still open, navigate away
      setTimeout(() => {
        try {
          window.close();
        } catch (e) { /* ignore */ }
        // If still open, redirect to an inert page as fallback
        try { window.location.href = 'about:blank'; } catch (e) { /* ignore */ }
      }, 250);
    } catch (e) {
      try { window.location.href = 'about:blank'; } catch (ignored) { /* ignore */ }
    }
  }

  // ----- screen sharing -----
  async function startScreenShare() {
    try {
      const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
      screenStream = s;
      if (btnToggleScreenShare) btnToggleScreenShare.textContent = '🛑 Stop Sharing';
      const screenTrack = s.getVideoTracks()[0];

      // replace video sender track with screen track for all peers
      for (const [id, data] of peers.entries()) {
        const pc = data.pc;
        if (!pc) continue;
        let replaced = false;
        const senders = data.senders || {};
        if (senders.video) {
          try { senders.video.replaceTrack(screenTrack); replaced = true; }
          catch (e) { /* ignore */ }
        }
        if (!replaced) {
          try { const sender = pc.addTrack(screenTrack, s); data.senders = data.senders || {}; data.senders.video = sender; }
          catch (e) { /* ignore */ }
        }
      }

      // when screen sharing stops, revert
      screenTrack.addEventListener('ended', () => { stopScreenShare(); });
    } catch (e) { console.warn('screen share failed', e); }
  }

  function stopScreenShare() {
    if (!screenStream) return;
    try { screenStream.getTracks().forEach(t => t.stop()); } catch (e) { }
    screenStream = null;
    if (btnToggleScreenShare) btnToggleScreenShare.textContent = '⬆️ Share';

    const camTrack = localStream && localStream.getVideoTracks()[0];
    if (!camTrack) return;
    for (const data of peers.values()) {
      const pc = data.pc;
      if (!pc) continue;
      const senders = data.senders || {};
      if (senders.video) {
        try { senders.video.replaceTrack(camTrack); }
        catch (e) { /* ignore */ }
      } else {
        try { const sender = pc.addTrack(camTrack, localStream); data.senders = data.senders || {}; data.senders.video = sender; }
        catch (e) { /* ignore */ }
      }
    }
  }

  // ----- UI events -----
  if (btnToggleAudio) btnToggleAudio.addEventListener('click', async () => {
    try { const s = await ensureLocalStream(); const track = s.getAudioTracks()[0]; if (!track) return; track.enabled = !track.enabled; updateAudioButton(); } catch (e) { console.warn('toggle audio failed', e); }
  });

  if (btnToggleVideo) btnToggleVideo.addEventListener('click', async () => {
    try { const s = await ensureLocalStream(); const track = s.getVideoTracks()[0]; if (!track) return; track.enabled = !track.enabled; updateVideoButton(); attachLocalStreamToTile(); } catch (e) { console.warn('toggle video failed', e); }
  });

  if (btnToggleScreenShare) btnToggleScreenShare.addEventListener('click', async () => { if (screenStream) stopScreenShare(); else startScreenShare(); });

  if (btnCopyLink) btnCopyLink.addEventListener('click', () => {
    const url = location.origin + location.pathname + '?room=' + encodeURIComponent(room);
    navigator.clipboard?.writeText(url).then(() => {
      if (btnCopyLink) btnCopyLink.textContent = 'Link Copied';
      setTimeout(() => { if (btnCopyLink) btnCopyLink.textContent = '🔗 Copy Link'; }, 1400);
    }).catch(() => alert('Copy failed — try selecting the URL manually'));
  });

  // Leave with confirmation modal
  if (btnLeave) btnLeave.addEventListener('click', () => {
    if (!confirmModal) {
      if (confirm('Are you sure you want to leave the meeting?')) {
        leaveRoom();
        tryCloseWindow();
      }
      return;
    }
    confirmModal.style.display = 'flex';
    confirmModal.setAttribute('aria-hidden', 'false');
  });

  if (cancelLeave) cancelLeave.addEventListener('click', () => { if (confirmModal) { confirmModal.style.display = 'none'; confirmModal.setAttribute('aria-hidden', 'true'); } });

  if (confirmLeave) confirmLeave.addEventListener('click', () => {
    if (confirmModal) { confirmModal.style.display = 'none'; confirmModal.setAttribute('aria-hidden', 'true'); }
    // teardown and try close
    (async () => {
      await leaveRoom();
      tryCloseWindow();
    })();
  });

  if (btnReconnect) btnReconnect.addEventListener('click', () => { try { if (ws && ws.readyState === WebSocket.OPEN) ws.close(); } catch (e) { } connectWS(); });

  if (btnToggleStats) btnToggleStats.addEventListener('click', () => {
    const lines = []; for (const [id, data] of peers.entries()) { const state = data.pc ? data.pc.connectionState : 'no-pc'; lines.push(`${id}: ${state}`); }
    alert(lines.length ? lines.join('\n') : 'No peers');
  });

  // Keyboard shortcuts: M = mute/unmute, V = toggle video, S = share
  window.addEventListener('keydown', (ev) => {
    const active = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable);
    if (active) return; // don't trigger while typing
    if (ev.key === 'm' || ev.key === 'M') { if (btnToggleAudio) btnToggleAudio.click(); }
    if (ev.key === 'v' || ev.key === 'V') { if (btnToggleVideo) btnToggleVideo.click(); }
    if (ev.key === 's' || ev.key === 'S') { if (btnToggleScreenShare) btnToggleScreenShare.click(); }
  });

  // close modal on Escape
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && confirmModal && confirmModal.style.display === 'flex') {
      confirmModal.style.display = 'none';
      confirmModal.setAttribute('aria-hidden', 'true');
    }
  });

  // beforeunload to leave room
  window.addEventListener('beforeunload', (e) => { try { leaveRoom(); } catch (err) { } });

  // poll buttons once stream available (fallback)
  (function pollButtonStates() { if (localStream) { updateAudioButton(); updateVideoButton(); } setTimeout(pollButtonStates, 800); })();

  // ----- Init -----
  (async function init() {
    if (roomLabel) roomLabel.textContent = `Room: ${room}`;
    if (roomShort) roomShort.textContent = room;
    try { await ensureLocalStream(); attachLocalStreamToTile(); } catch (e) { /* user didn't grant camera yet */ }
    connectWS();
  })();

})(); // IIFE end
