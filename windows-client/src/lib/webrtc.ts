// WebRTC Engine with strict Opus constraints and SDP Munging

export const audioConstraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1, // Mono
    sampleRate: 48000
};

export const mungeOpusSdp = (sdp: string): string => {
    const lines = sdp.split('\r\n');
    let mLineIndex = -1;
    let opusPayloadType = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('m=audio ')) {
            mLineIndex = i;
        } else if (lines[i].startsWith('a=rtpmap:')) {
            if (lines[i].toLowerCase().includes('opus/48000')) {
                opusPayloadType = parseInt(lines[i].split(':')[1].split(' ')[0], 10);
            }
        }
    }

    if (mLineIndex === -1 || opusPayloadType === -1) return sdp;

    // Look for existing fmtp line for Opus to append our constraints
    let modified = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith(`a=fmtp:${opusPayloadType} `)) {
            // Inject strictly required parameters
            const currentParams = lines[i].substring(lines[i].indexOf(' ') + 1);
            let mergedParams = currentParams;
            if (!mergedParams.includes('maxaveragebitrate')) mergedParams += ';maxaveragebitrate=64000';
            if (!mergedParams.includes('useinbandfec')) mergedParams += ';useinbandfec=1';
            if (!mergedParams.includes('usedtx')) mergedParams += ';usedtx=1';
            if (!mergedParams.includes('stereo')) mergedParams += ';stereo=0';

            lines[i] = `a=fmtp:${opusPayloadType} ${mergedParams}`;
            modified = true;
            break;
        }
    }

    // If no existing fmtp line, add it
    if (!modified) {
        let insertIndex = lines.indexOf(`a=rtpmap:${opusPayloadType} opus/48000/2`); // /2 is channel, we override it internally in browser
        if (insertIndex === -1) insertIndex = lines.indexOf(`a=rtpmap:${opusPayloadType} opus/48000`);
        if (insertIndex !== -1) {
            lines.splice(insertIndex + 1, 0, `a=fmtp:${opusPayloadType} maxaveragebitrate=64000;useinbandfec=1;usedtx=1;stereo=0`);
        }
    }

    return lines.join('\r\n');
};

export class WebRTCEngine {
   private peerConnection: RTCPeerConnection | null = null;
   private localStream: MediaStream | null = null;

   constructor(private config: RTCConfiguration) {}

   public async initializeLocalStream() {
       this.localStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
       return this.localStream;
   }

   public toggleAudio(isMuted: boolean) {
       if (this.localStream) {
           this.localStream.getAudioTracks().forEach(track => {
               track.enabled = !isMuted;
           });
       }
   }

   public createPeerConnection() {
       this.peerConnection = new RTCPeerConnection(this.config);
       
       if (this.localStream) {
           this.localStream.getTracks().forEach(track => {
               this.peerConnection?.addTrack(track, this.localStream!);
           });
       }
       return this.peerConnection;
   }

   public async createOffer(): Promise<RTCSessionDescriptionInit> {
       const offer = await this.peerConnection!.createOffer();
       if (offer.sdp) {
           offer.sdp = mungeOpusSdp(offer.sdp);
       }
       await this.peerConnection!.setLocalDescription(offer);
       return offer;
   }

   public async createAnswer(offerSdp: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
       await this.peerConnection!.setRemoteDescription(offerSdp);
       const answer = await this.peerConnection!.createAnswer();
       if (answer.sdp) {
           answer.sdp = mungeOpusSdp(answer.sdp);
       }
       await this.peerConnection!.setLocalDescription(answer);
       return answer;
   }

   public async handleAnswer(answerSdp: RTCSessionDescriptionInit) {
       await this.peerConnection!.setRemoteDescription(answerSdp);
   }

   public addIceCandidate(candidate: RTCIceCandidateInit) {
       this.peerConnection?.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error(e));
   }
   
   public close() {
       if (this.localStream) {
           this.localStream.getTracks().forEach(t => t.stop());
       }
       if (this.peerConnection) {
           this.peerConnection.close();
       }
   }
}
