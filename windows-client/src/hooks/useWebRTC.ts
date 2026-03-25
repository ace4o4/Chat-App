import { useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useAppStore } from '../store/useAppStore';

export const useWebRTC = (socket: Socket | null | undefined, currentRoom: string | null) => {
    const { user, isMuted, addRoomParticipant, removeRoomParticipant, setRoomParticipants } = useAppStore();
    const localStreamRef = useRef<MediaStream | null>(null);
    const peersRef = useRef<Record<string, RTCPeerConnection>>({});
    const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

    // Mute/Unmute local audio track
    useEffect(() => {
        if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach(track => {
                track.enabled = !isMuted;
            });
            // Tell others we muted
            if (socket && currentRoom) {
                socket.emit('mute-status', { roomCode: currentRoom, isMuted });
            }
        }
    }, [isMuted, socket, currentRoom]);

    useEffect(() => {
        if (!socket || !currentRoom || !user) return;

        const userTag = `${user.username}#${user.discriminator}`;
        let mounted = true;

        const initAudio = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true,
                        channelCount: 1
                    }
                });
                if (!mounted) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                stream.getAudioTracks().forEach(t => t.enabled = !isMuted);
                localStreamRef.current = stream;
                
                // Tell server we are ready in the room (we already emitted join-room, but we can fetch current participants if needed, or rely on them sending offers)
                socket.emit('webrtc-ready', currentRoom);
            } catch (err) {
                console.error("Failed to get microphone access", err);
                alert("Could not access microphone.");
            }
        };

        const createPeer = (targetSocketId: string, targetTag: string, caller: boolean) => {
            const peer = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });

            peersRef.current[targetSocketId] = peer;

            // Add local tracks
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    peer.addTrack(track, localStreamRef.current!);
                });
            }

            peer.ontrack = (event) => {
                const stream = event.streams[0];
                setRemoteStreams(prev => ({ ...prev, [targetSocketId]: stream }));
            };

            peer.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('ice-candidate', {
                        target: targetSocketId,
                        sender: socket.id,
                        candidate: event.candidate
                    });
                }
            };

            if (caller) {
                peer.createOffer().then(offer => {
                    return peer.setLocalDescription(offer);
                }).then(() => {
                    socket.emit('offer', {
                        target: targetSocketId,
                        caller: socket.id,
                        callerTag: userTag,
                        sdp: peer.localDescription
                    });
                });
            }

            addRoomParticipant({ socketId: targetSocketId, userTag: targetTag, isMuted: false });
            return peer;
        };

        // --- Socket Listeners ---

        // When someone joins AFTER us, they emit webrtc-ready. The server should broadcast 'user-ready' so we can call them.
        socket.on('user-connected', ({ socketId, userTag: targetTag }: { socketId: string, userTag: string }) => {
            // Wait for them to be ready, or just call immediately if we assume they set up their stream fast enough.
            // Better to just call immediately and let ICE buffering handle it, or use a 'ready' event.
            console.log("Someone joined, creating offer for", targetTag);
            createPeer(socketId, targetTag, true);
        });

        socket.on('offer', async (data: { caller: string, callerTag: string, sdp: RTCSessionDescriptionInit }) => {
            console.log("Received offer from", data.callerTag);
            const peer = createPeer(data.caller, data.callerTag, false);
            await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit('answer', {
                target: data.caller,
                responder: socket.id,
                responderTag: userTag,
                sdp: peer.localDescription
            });
        });

        socket.on('answer', async (data: { responder: string, responderTag: string, sdp: RTCSessionDescriptionInit }) => {
            console.log("Received answer from", data.responderTag);
            const peer = peersRef.current[data.responder];
            if (peer) {
                await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
            }
        });

        socket.on('ice-candidate', async (data: { sender: string, candidate: RTCIceCandidateInit }) => {
            const peer = peersRef.current[data.sender];
            if (peer) {
                try {
                    await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                    console.error("Error adding ice candidate", e);
                }
            }
        });

        socket.on('user-disconnected', ({ socketId }: { socketId: string, userTag: string }) => {
            if (peersRef.current[socketId]) {
                peersRef.current[socketId].close();
                delete peersRef.current[socketId];
            }
            setRemoteStreams(prev => {
                const next = { ...prev };
                delete next[socketId];
                return next;
            });
            removeRoomParticipant(socketId);
        });

        socket.on('mute-status', ({ senderId, isMuted }: { senderId: string, isMuted: boolean }) => {
            // Update the peer's mute status
            const store = useAppStore.getState();
            store.setRoomParticipants(
                store.roomParticipants.map(p => p.socketId === senderId ? { ...p, isMuted } : p)
            );
        });

        // Fetch existing participants in the room when we join
        socket.emit('get-room-participants', currentRoom, (participants: { socketId: string, userTag: string, isMuted: boolean }[]) => {
            setRoomParticipants(participants.filter(p => p.socketId !== socket.id));
        });

        initAudio();

        return () => {
            mounted = false;
            // Cleanup peers
            Object.values(peersRef.current).forEach(peer => peer.close());
            peersRef.current = {};
            // Cleanup stream
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(t => t.stop());
                localStreamRef.current = null;
            }
            // Clear state
            setRemoteStreams({});
            setRoomParticipants([]);
            
            socket.off('user-connected');
            socket.off('offer');
            socket.off('answer');
            socket.off('ice-candidate');
            socket.off('user-disconnected');
            socket.off('mute-status');
        };
    }, [socket, currentRoom, user?.username, user?.discriminator, addRoomParticipant, removeRoomParticipant, setRoomParticipants]);

    return { remoteStreams };
};
