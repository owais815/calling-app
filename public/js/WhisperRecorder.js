'use strict';

/**
 * WhisperRecorder
 *
 * Captures mixed session audio (local mic + all remote peers) using the
 * existing MixedAudioRecorder, then POSTs the recording to the calling-app's
 * /api/v1/transcribe endpoint, which forwards it to OpenAI Whisper and saves
 * the result to the LMS database.
 *
 * Usage (from Room.js):
 *   const wr = new WhisperRecorder({ rc, lmsSessionId, lmsApiUrl, apiSecret });
 *   wr.start();      // begin recording
 *   await wr.stop(); // stop + upload + transcribe
 */
class WhisperRecorder {
    constructor({ rc, lmsSessionId, lmsApiUrl, lmsToken }) {
        this.rc = rc;                       // RoomClient instance
        this.lmsSessionId = lmsSessionId;   // LMS session ID (string)
        this.lmsApiUrl = lmsApiUrl;         // LMS backend base URL
        this.lmsToken = lmsToken;           // JWT from the LMS (sent as x-lms-token)
        this.mediaRecorder = null;
        this.mixedAudioRecorder = null;
        this.chunks = [];
        this.isRecording = false;
        this.mimeType = this._getSupportedMimeType();
    }

    _getSupportedMimeType() {
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4'];
        for (const t of types) {
            if (MediaRecorder.isTypeSupported(t)) return t;
        }
        return '';
    }

    /** Build the mixed audio stream from local mic + all remote peer audio */
    _buildMixedStream() {
        const streams = [];

        // Local microphone
        if (this.rc.localAudioStream) {
            streams.push(this.rc.localAudioStream);
        }

        // All remote peer audio elements
        const remoteStream = this.rc.getAudioStreamFromAudioElements();
        remoteStream.getAudioTracks().forEach((track) => {
            streams.push(new MediaStream([track]));
        });

        if (streams.length === 0) return null;

        this.mixedAudioRecorder = new MixedAudioRecorder();
        return this.mixedAudioRecorder.getMixedAudioStream(streams);
    }

    start() {
        if (this.isRecording) return;
        try {
            const mixedStream = this._buildMixedStream();
            if (!mixedStream) {
                userLog('warning', 'Whisper: No audio tracks found to record.', 'top-end', 4000);
                return;
            }

            const options = this.mimeType ? { mimeType: this.mimeType } : {};
            this.mediaRecorder = new MediaRecorder(mixedStream, options);
            this.chunks = [];

            this.mediaRecorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) this.chunks.push(e.data);
            };

            this.mediaRecorder.start(5000); // collect data every 5 s
            this.isRecording = true;
            userLog('info', 'Whisper transcript recording started', 'top-end', 3000);
        } catch (err) {
            console.error('[WhisperRecorder] start error:', err);
            userLog('error', `Whisper start error: ${err.message}`, 'top-end', 5000);
        }
    }

    stop() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || !this.isRecording) {
                resolve(null);
                return;
            }
            this.mediaRecorder.onstop = async () => {
                this.isRecording = false;
                if (this.mixedAudioRecorder) {
                    this.mixedAudioRecorder.stopMixedAudioStream();
                    this.mixedAudioRecorder = null;
                }
                const blob = new Blob(this.chunks, { type: this.mimeType || 'audio/webm' });
                this.chunks = [];
                if (blob.size === 0) {
                    userLog('warning', 'Whisper: No audio recorded.', 'top-end', 4000);
                    resolve(null);
                    return;
                }
                const result = await this._upload(blob);
                resolve(result);
            };
            this.mediaRecorder.stop();
        });
    }

    async _upload(blob) {
        if (!this.lmsSessionId) {
            console.warn('[WhisperRecorder] No lmsSessionId — skipping upload');
            return null;
        }

        userLog('info', 'Uploading session audio for transcription…', 'top-end', 4000);

        try {
            const params = new URLSearchParams({ lmsSessionId: this.lmsSessionId });
            if (this.lmsApiUrl) params.set('lmsApiUrl', this.lmsApiUrl);

            const resp = await fetch(`/api/v1/transcribe?${params}`, {
                method: 'POST',
                headers: {
                    'Content-Type': this.mimeType || 'audio/webm',
                    'x-lms-token': this.lmsToken || '',
                },
                body: blob,
            });

            if (!resp.ok) {
                const errText = await resp.text().catch(() => '');
                throw new Error(`Server responded ${resp.status}: ${errText}`);
            }

            const { transcriptText } = await resp.json();
            userLog('success', 'Transcript saved! Accessible in the LMS schedule.', 'top-end', 6000);
            return transcriptText;
        } catch (err) {
            console.error('[WhisperRecorder] upload error:', err);
            userLog('error', `Transcript upload failed: ${err.message}`, 'top-end', 6000);
            return null;
        }
    }

    isActive() {
        return this.isRecording;
    }

    /**
     * Synchronous-style stop for pagehide / beforeunload.
     * Flushes any buffered chunks and fires a keepalive fetch so the
     * browser keeps the request alive even after the page is gone.
     * Best-effort: keepalive is capped at ~64 KB — works for short sessions.
     */
    stopAndUploadSync() {
        if (!this.mediaRecorder || !this.isRecording) return;
        try {
            this.mediaRecorder.requestData(); // flush remaining buffered data
            this.mediaRecorder.stop();
            this.isRecording = false;

            if (this.chunks.length === 0 || !this.lmsSessionId) return;

            const blob = new Blob(this.chunks, { type: this.mimeType || 'audio/webm' });
            this.chunks = [];

            const params = new URLSearchParams({ lmsSessionId: this.lmsSessionId });
            if (this.lmsApiUrl) params.set('lmsApiUrl', this.lmsApiUrl);

            // keepalive keeps the request alive after page unload
            fetch(`/api/v1/transcribe?${params}`, {
                method: 'POST',
                headers: {
                    'Content-Type': this.mimeType || 'audio/webm',
                    'x-lms-token': this.lmsToken || '',
                },
                body: blob,
                keepalive: true,
            }).catch(() => {});
        } catch (err) {
            console.warn('[WhisperRecorder] stopAndUploadSync error:', err);
        }
    }
}
