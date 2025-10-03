// routes/subroutes/meeting.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Platform,
  PermissionsAndroid,
  Alert,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { WebView } from "react-native-webview";

// dynamic router imports
let routerModule: any = null;
try {
  routerModule = require("expo-router");
} catch {}
const useRouterFn = routerModule?.useRouter;
const useSearchParamsFn = routerModule?.useSearchParams;
const useLocalSearchParamsFn = routerModule?.useLocalSearchParams;

// Attempt to require react-native-webrtc at runtime
let RNWebRTC: any = null;
let webRtcAvailable = false;
try {
  RNWebRTC = require("react-native-webrtc");
  webRtcAvailable = !!RNWebRTC && !!RNWebRTC.RTCPeerConnection;
} catch (e) {
  console.warn("react-native-webrtc require failed:", e);
}

const {
  RTCPeerConnection: _RTCPeerConnection,
  RTCIceCandidate: _RTCIceCandidate,
  RTCSessionDescription: _RTCSessionDescription,
  mediaDevices: _mediaDevices,
  RTCView: _RTCView,
} = RNWebRTC || ({} as any);

// Types
type PeerConnectionsMap = { [peerId: string]: any };
type CandidateQueueMap = { [peerId: string]: any[] };
type RemoteStreamsMap = { [peerId: string]: any };

// Defaults
const WS_RECONNECT_MAX = 6;

// Helper to parse query string (keeps compatibility with router push route)
function parseQueryFromUrl(url?: string | null): Record<string, string> {
  if (!url) return {};
  try {
    return Object.fromEntries(new URLSearchParams(url.split("?")[1] || ""));
  } catch {
    return {};
  }
}

export default function Meeting({ route }: any) {
  const router = (useRouterFn && useRouterFn()) || { back: () => {} };
  const searchParamsHook =
    (useSearchParamsFn && useSearchParamsFn()) ||
    (useLocalSearchParamsFn && useLocalSearchParamsFn());

  // WebView fallback if native WebRTC not available (Expo Go)
  if (!webRtcAvailable) {
    const meetingUrl = route?.params?.url || "http://10.0.2.2:5000/client.html";
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <WebView
          source={{ uri: meetingUrl }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
        <TouchableOpacity style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Extract route params
  const routeParams = route?.params ?? parseQueryFromUrl(route?.params?.url);
  const defaultSignaling =
    Platform.OS === "android" ? "ws://10.0.2.2:5000/ws" : "ws://127.0.0.1:5000/ws";
  const {
    room = "default-room",
    signalingUrl = defaultSignaling,
    audio = "true",
    video = "true",
    displayName = "",
  } = routeParams;

  // State
  const [localStream, setLocalStream] = useState<any | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<RemoteStreamsMap>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [connectionState, setConnectionState] = useState<string>("idle");
  const [wsStatus, setWsStatus] = useState<string>("closed");
  const [peers, setPeers] = useState<string[]>([]);

  // Refs
  const pcMap = useRef<PeerConnectionsMap>({});
  const candidateQueues = useRef<CandidateQueueMap>({});
  const wsRef = useRef<WebSocket | null>(null);
  const myId = useRef<string | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const pendingCreateOffers = useRef<Set<string>>(new Set());
  const mounted = useRef<boolean>(true);

  // WebRTC "classes" imported earlier
  const RTCPeerConnection = _RTCPeerConnection;
  const RTCIceCandidate = _RTCIceCandidate;
  const RTCSessionDescription = _RTCSessionDescription;
  const mediaDevices = _mediaDevices;
  const RTCView = _RTCView;

  // ICE servers cache (fetch /turn once and reuse)
  const iceServersRef = useRef<any[] | null>(null);
  const fetchingIceServers = useRef<boolean>(false);

  useEffect(() => {
    mounted.current = true;
    start();
    return () => {
      mounted.current = false;
      cleanup();
    };
  }, []);

  function safeSet<T>(setter: (v: T) => void, value: T) {
    if (mounted.current) setter(value);
  }

  // --- Get ICE servers (STUN + TURN) from server /turn endpoint. cached in iceServersRef ---
  async function getIceServers(): Promise<any[]> {
    if (iceServersRef.current) return iceServersRef.current;
    if (fetchingIceServers.current) {
      // wait a little until available
      let i = 0;
      while (fetchingIceServers.current && i < 50) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
        i += 1;
      }
      return iceServersRef.current ?? [{ urls: "stun:stun.l.google.com:19302" }];
    }
    fetchingIceServers.current = true;
    try {
      // derive base URL from signalingUrl (strip /ws)
      const base = signalingUrl.replace(/\/ws$/, "");
      const resp = await fetch(base + "/turn");
      if (!resp.ok) throw new Error("Failed to fetch /turn");
      const body = await resp.json();
      const turnServers =
        (body.urls || []).map((u: string) => {
          // if body includes username/credential, attach them
          if (body.username && body.credential) {
            return { urls: u, username: body.username, credential: body.credential };
          }
          return { urls: u };
        }) || [];
      // always include a public STUN as fallback
      const final = [...turnServers, { urls: "stun:stun.l.google.com:19302" }];
      iceServersRef.current = final;
      return final;
    } catch (e) {
      console.warn("getIceServers() failed, falling back to STUN only", e);
      iceServersRef.current = [{ urls: "stun:stun.l.google.com:19302" }];
      return iceServersRef.current;
    } finally {
      fetchingIceServers.current = false;
    }
  }

  // --- Permissions (Android) ---
  async function requestPermissions(): Promise<boolean> {
    if (Platform.OS !== "android") return true;
    try {
      const perms = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      return (
        perms[PermissionsAndroid.PERMISSIONS.CAMERA] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        perms[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.warn("Permissions request failed", err);
      return false;
    }
  }

  // --- Local stream acquisition ---
  async function acquireLocalStream(facingMode: "user" | "environment" = "user") {
    try {
      const wantsVideo = video !== "false";
      const wantsAudio = audio !== "false";
      const stream = await mediaDevices.getUserMedia({
        audio: wantsAudio,
        video: wantsVideo ? { facingMode } : false,
      });
      safeSet(setLocalStream, stream);
      if (isMuted) setAudioEnabled(stream, false);
      setIsCameraOff(!(stream.getVideoTracks?.()?.length > 0));
      return stream;
    } catch (err) {
      console.error("getUserMedia error", err);
      Alert.alert("Camera/Microphone error", String(err));
      throw err;
    }
  }

  function setAudioEnabled(stream: any | null, enabled: boolean) {
    stream?.getAudioTracks?.()?.forEach((t: any) => (t.enabled = enabled));
  }

  function hasVideoTrack(stream: any | null) {
    return !!stream?.getVideoTracks?.()?.length;
  }

  // --- Add local tracks to PC ---
  async function addLocalTracks(pc: any) {
    if (!localStream || !pc) return;
    localStream.getTracks()?.forEach((t: any) => pc.addTrack(t, localStream));
  }

  async function replaceLocalVideoTrack(newTrack: any) {
    Object.values(pcMap.current).forEach((pc) => {
      try {
        const senders = pc?.getSenders?.() || [];
        const videoSender = senders.find((s: any) => s.track?.kind === "video");
        if (videoSender?.replaceTrack) videoSender.replaceTrack(newTrack);
        else {
          // fallback: remove & add
          try {
            if (videoSender) pc.removeTrack?.(videoSender);
          } catch (e) {
            // ignore
          }
          pc.addTrack(newTrack, localStream);
        }
      } catch (err) {
        console.warn("replaceLocalVideoTrack error", err);
      }
    });
  }

  // --- Signaling helpers ---
  function sendSignal(to: string, payload: any) {
    if (!wsRef.current || wsRef.current.readyState !== 1 || !myId.current) return;
    wsRef.current.send(
      JSON.stringify({ type: "signal", room, to, from: myId.current, payload })
    );
  }

  function openWebSocket() {
    if (wsRef.current) return;
    safeSet(setWsStatus, "connecting");

    const ws = new WebSocket(signalingUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      safeSet(setWsStatus, "open");
      reconnectAttempts.current = 0;
      ws.send(JSON.stringify({ type: "join", room }));
    };
    ws.onmessage = async (evt) => {
      handleWsMessage(evt);
    };
    ws.onerror = (e) => {
      console.warn("WS error", e);
    };
    ws.onclose = () => {
      safeSet(setWsStatus, "closed");
      wsRef.current = null;
      if (reconnectAttempts.current < WS_RECONNECT_MAX) {
        setTimeout(() => {
          reconnectAttempts.current += 1;
          openWebSocket();
        }, 1000 * Math.pow(2, reconnectAttempts.current));
      }
    };
  }

  async function handleWsMessage(evt: any) {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === "joined") {
        myId.current = msg.id;
        await handlePeers(msg.others || []);
      } else if (msg.type === "new-peer") {
        await handlePeers([msg.id]);
      } else if (msg.type === "peer-left") {
        cleanupPeer(msg.id);
        setPeers((v) => v.filter((x) => x !== msg.id));
      } else if (msg.type === "signal") {
        await handleSignal(msg.from, msg.payload);
      }
    } catch (err) {
      console.warn("Failed parsing ws message", err);
    }
  }

  async function handlePeers(peerIds: string[]) {
    safeSet((v) => setPeers(Array.from(new Set([...(v || []), ...peerIds]))), peers as any);
    const stream = await waitForLocalStream(5000);
    peerIds.forEach((id) =>
      stream ? createPeerAndOffer(id) : pendingCreateOffers.current.add(id)
    );
  }

  function waitForLocalStream(timeoutMs = 5000): Promise<any | null> {
    return new Promise((resolve) => {
      if (localStream) return resolve(localStream);
      const start = Date.now();
      const interval = setInterval(() => {
        if (localStream) {
          clearInterval(interval);
          resolve(localStream);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval);
          resolve(null);
        }
      }, 200);
    });
  }

  // --- createPeerAndOffer --- ensure ICE servers are used
  async function createPeerAndOffer(peerId: string) {
    if (!wsRef.current || pcMap.current[peerId]) return;
    safeSet(setConnectionState, "creating");

    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });
    pcMap.current[peerId] = pc;
    candidateQueues.current[peerId] = [];

    await addLocalTracks(pc);

    pc.ontrack = (e: any) => {
      const s = e.streams?.[0];
      if (s) safeSet((rs) => setRemoteStreams({ ...rs, [peerId]: s }), remoteStreams);
    };
    pc.onicecandidate = ({ candidate }: any) => {
       console.log('[ICE] outgoing candidate for peer', peerId, candidate && candidate.candidate);
      if (candidate) sendSignal(peerId, { type: "candidate", candidate });
    };
    pc.onconnectionstatechange = () => {
      console.log('[PC] connectionState for', peerId, pc.connectionState);

      safeSet(setConnectionState, pc.connectionState);
      if (["closed", "failed"].includes(pc.connectionState)) cleanupPeer(peerId);
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal(peerId, { type: "offer", sdp: pc.localDescription });
    } catch (err) {
      console.warn("createOffer error", err);
    } finally {
      safeSet(setConnectionState, "idle");
    }
  }

  // --- handleSignal --- ensure ICE servers are used for any incoming peer connection
  async function handleSignal(from: string, payload: any) {
    let pc = pcMap.current[from];
    if (!pc) {
      const iceServers = await getIceServers();
      pc = new RTCPeerConnection({ iceServers });
      pcMap.current[from] = pc;
      candidateQueues.current[from] = [];
    }

    await addLocalTracks(pc);

    pc.ontrack = (e: any) => {
        console.log('[PC] ontrack for', peerId, 'streams:', e.streams && e.streams.length);
      const s = e.streams?.[0];
      if (s) safeSet((rs) => setRemoteStreams({ ...rs, [from]: s }), remoteStreams);
    };
    pc.onicecandidate = ({ candidate }: any) => {
      if (candidate) sendSignal(from, { type: "candidate", candidate });
    };
    pc.onconnectionstatechange = () => {
      safeSet(setConnectionState, pc.connectionState);
      if (["closed", "failed"].includes(pc.connectionState)) cleanupPeer(from);
    };

    try {
      if (payload.type === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushCandidateQueue(from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(from, { type: "answer", sdp: pc.localDescription });
      } else if (payload.type === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushCandidateQueue(from);
      } else if (payload.type === "candidate") {
        if (!pc.remoteDescription?.type) candidateQueues.current[from].push(payload.candidate);
        else await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    } catch (err) {
      console.warn("handleSignal err", err);
    }
  }

  async function flushCandidateQueue(peerId: string) {
    const pc = pcMap.current[peerId];
    const q = candidateQueues.current[peerId] || [];
    for (const c of q) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        // ignore
      }
    }
    candidateQueues.current[peerId] = [];
  }

  // Cleanup helpers
  function cleanupPeer(peerId: string) {
    try {
      pcMap.current[peerId]?.close?.();
    } catch {}
    delete pcMap.current[peerId];
    delete candidateQueues.current[peerId];
    setRemoteStreams((s) => {
      const c = { ...s };
      delete c[peerId];
      return c;
    });
  }

  function cleanup() {
    Object.values(pcMap.current).forEach((pc) => pc?.close?.());
    pcMap.current = {};
    candidateQueues.current = {};
    pendingCreateOffers.current.clear();
    localStream?.getTracks?.()?.forEach((t: any) => t.stop());
    safeSet(setLocalStream, null);
    safeSet(setRemoteStreams, {});
    setPeers([]);
    setIsMuted(false);
    setIsCameraOff(false);
    setConnectionState("closed");
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      safeSet(setWsStatus, "closed");
    }
  }

  // Start flow: request permissions, acquire local stream, open WS
  async function start() {
    safeSet(setConnectionState, "starting");
    if (!(await requestPermissions())) {
      Alert.alert("Permissions required", "Camera and microphone are required.");
      safeSet(setConnectionState, "idle");
      return;
    }
    try {
      await acquireLocalStream("user");
      openWebSocket();
    } catch {
      console.warn("start error");
    } finally {
      safeSet(setConnectionState, "idle");
    }
  }

  // UI toggles
  const toggleMute = useCallback(() => {
    if (!localStream) return;
    setIsMuted((m) => {
      setAudioEnabled(localStream, m);
      return !m;
    });
  }, [localStream]);

  const toggleCamera = useCallback(async () => {
    if (!localStream) return;
    const tracks = localStream.getVideoTracks?.() || [];
    if (tracks.length) {
      const enabled = !tracks[0].enabled;
      tracks.forEach((t) => (t.enabled = enabled));
      setIsCameraOff(!enabled);
    } else {
      const s = await acquireLocalStream("user");
      if (s) replaceLocalVideoTrack(s.getVideoTracks()?.[0]);
      setLocalStream(s);
      setIsCameraOff(false);
    }
  }, [localStream]);

  // Render UI
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, padding: 12 }}>
          <Text style={styles.infoText}>Room: {room}</Text>
          <Text style={styles.smallText}>
            WS: {wsStatus} • Conn: {connectionState}
          </Text>
          <Text style={styles.smallText}>You: {myId.current ?? "—"}</Text>

          <View style={{ flexDirection: "row", marginVertical: 12 }}>
            {localStream ? (
              <RTCView
                streamURL={localStream.toURL()}
                style={styles.localPreview}
                mirror
              />
            ) : (
              <View style={styles.localPreviewPlaceholder}>
                <Text style={{ color: "#999" }}>No local stream</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.infoText}>Remote streams:</Text>
              {Object.keys(remoteStreams).length === 0 ? (
                <Text style={styles.placeholderText}>No remote streams yet</Text>
              ) : (
                Object.entries(remoteStreams).map(([id, s]) => (
                  <RTCView key={id} streamURL={s.toURL()} style={styles.remoteStream} />
                ))
              )}
            </View>
          </View>

          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => {
                cleanup();
                router.back();
              }}
            >
              <Text style={styles.btnText}>Leave</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={toggleMute}>
              <Text style={styles.btnText}>{isMuted ? "Unmute" : "Mute"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={toggleCamera}>
              <Text style={styles.btnText}>
                {isCameraOff ? "Enable Cam" : "Disable Cam"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={styles.infoText}>Peers ({peers.length}):</Text>
            {peers.length === 0 && <Text style={styles.placeholderText}>No other peers</Text>}
            {peers.map((p) => (
              <Text key={p} style={styles.smallText}>
                • {p}
              </Text>
            ))}
          </View>

          {(connectionState === "starting" || wsStatus === "connecting") && (
            <ActivityIndicator style={{ marginTop: 14 }} />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  localPreview: { width: 120, height: 160, backgroundColor: "#000", marginRight: 8, borderRadius: 8 },
  localPreviewPlaceholder: { width: 120, height: 160, backgroundColor: "#222", marginRight: 8, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  remoteStream: { width: "100%", height: 200, backgroundColor: "#000", borderRadius: 8, marginVertical: 4 },
  btn: { backgroundColor: "#1e6fff", padding: 10, borderRadius: 8, marginHorizontal: 6, minWidth: 80, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "600" },
  controlsRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 6 },
  infoText: { color: "#fff", fontWeight: "600", marginBottom: 4 },
  smallText: { color: "#ddd", fontSize: 12 },
  placeholderText: { color: "#999" },
});
