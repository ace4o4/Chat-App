package com.rog.chatapp;

import android.util.Log;
import org.webrtc.MediaConstraints;
import org.webrtc.PeerConnection;
import org.webrtc.PeerConnectionFactory;
import org.webrtc.SessionDescription;

public class WebRTCEngine {
    private static final String TAG = "WebRTCEngine";
    private PeerConnectionFactory factory;
    private PeerConnection peerConnection;

    // Strict audio constraints required by the PRD
    public MediaConstraints getAudioConstraints() {
        MediaConstraints constraints = new MediaConstraints();
        constraints.mandatory.add(new MediaConstraints.KeyValuePair("echoCancellation", "true"));
        constraints.mandatory.add(new MediaConstraints.KeyValuePair("noiseSuppression", "true"));
        constraints.mandatory.add(new MediaConstraints.KeyValuePair("autoGainControl", "true"));
        // Note: channelCount=1 is generally handled by the source, but we enforce it in SDP too.
        return constraints;
    }

    // Agent Directive: SDP Munging logic to enforce Opus 48kHz, 64kbps, FEC, and DTX
    public String mungeOpusSdp(String sdp) {
        String[] lines = sdp.split("\r\n");
        int mLineIndex = -1;
        String opusPayloadType = "";

        for (int i = 0; i < lines.length; i++) {
            if (lines[i].startsWith("m=audio ")) {
                mLineIndex = i;
            } else if (lines[i].startsWith("a=rtpmap:") && lines[i].toLowerCase().contains("opus/48000")) {
                opusPayloadType = lines[i].split(":")[1].split(" ")[0];
            }
        }

        if (mLineIndex == -1 || opusPayloadType.isEmpty()) return sdp;

        boolean modified = false;
        StringBuilder sb = new StringBuilder();
        
        for (String line : lines) {
            if (line.startsWith("a=fmtp:" + opusPayloadType + " ")) {
                String mergedParams = line.substring(line.indexOf(" ") + 1);
                if (!mergedParams.contains("maxaveragebitrate")) mergedParams += ";maxaveragebitrate=64000";
                if (!mergedParams.contains("useinbandfec")) mergedParams += ";useinbandfec=1";
                if (!mergedParams.contains("usedtx")) mergedParams += ";usedtx=1";
                if (!mergedParams.contains("stereo")) mergedParams += ";stereo=0";
                
                sb.append("a=fmtp:").append(opusPayloadType).append(" ").append(mergedParams).append("\r\n");
                modified = true;
            } else {
                sb.append(line).append("\r\n");
            }
        }

        if (!modified) {
            String targetPayload = "a=rtpmap:" + opusPayloadType + " opus/48000/2";
            int index = sb.indexOf(targetPayload);
            if (index != -1) {
                sb.insert(index + targetPayload.length() + 2, 
                    "a=fmtp:" + opusPayloadType + " maxaveragebitrate=64000;useinbandfec=1;usedtx=1;stereo=0\r\n");
            }
        }

        Log.d(TAG, "Munged SDP applied for Opus constraints.");
        return sb.toString();
    }
}
