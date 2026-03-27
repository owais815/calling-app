'use strict';

/**
 * WhisperRecorder (Google Web Speech API mode)
 *
 * Uses the existing Transcription object (Web Speech API / Google) to collect
 * speech text from the session, then POSTs the accumulated text to the calling-app
 * proxy endpoint (/api/v1/save-transcript), which forwards it to the LMS backend.
 *
 * The Transcription class already broadcasts each participant's recognised text
 * via Socket.IO, so ALL participants' speech ends up in transcription.transcripts[].
 *
 * OpenAI Whisper implementation is commented out in Server.js — to switch back,
 * uncomment that block and replace this file with the audio-recording version.
 *
 * Interface is identical to the original WhisperRecorder so Room.js needs no changes:
 *   start()              — begin capturing (starts persistent Web Speech recognition)
 *   stop()               — stop + upload transcript text to LMS (async)
 *   stopAndUploadSync()  — best-effort pagehide upload via sendBeacon
 *   isActive()           — returns true while recording
 */
class WhisperRecorder {
    constructor({ lmsSessionId, lmsApiUrl, lmsToken }) {
        this.lmsSessionId = lmsSessionId;
        this.lmsApiUrl    = lmsApiUrl || '';
        this.lmsToken     = lmsToken  || '';
        this.isRecording  = false;
    }

    /** Start persistent Web Speech recognition */
    start() {
        if (this.isRecording) return;
        if (typeof transcription === 'undefined' || !transcription.isSupported()) {
            console.warn('[WhisperRecorder] Speech recognition not supported in this browser.');
            return;
        }
        // Enable persistent mode so recognition auto-restarts on silence
        transcription.isPersistentMode = true;
        // Force-hide the transcription panel — it must never be visible in background mode
        if (typeof transcriptionRoom !== 'undefined') {
            transcriptionRoom.style.display = 'none';
            transcription.isHidden = true;
        }
        transcription.start();
        this.isRecording = true;
        console.log('[WhisperRecorder] Session transcription started (Google Speech)');
    }

    /** Stop recognition and upload collected text to LMS */
    async stop() {
        if (!this.isRecording) return;
        this.isRecording = false;
        if (typeof transcription !== 'undefined') {
            transcription.isPersistentMode = false;
            transcription.stop();
        }
        await this._upload();
    }

    /** Format collected transcripts and POST to calling-app proxy */
    async _upload() {
        if (!this.lmsSessionId) return;
        if (typeof transcription === 'undefined' || !transcription.transcripts || transcription.transcripts.length === 0) {
            console.log('[WhisperRecorder] No transcript text collected for this session.');
            return;
        }

        const transcriptText = transcription.transcripts
            .map(t => `[${t.time}] ${t.name}: ${t.caption}`)
            .join('\n');

        console.log('[WhisperRecorder] Saving session transcript…');

        try {
            const resp = await fetch('/api/v1/save-transcript', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-lms-token': this.lmsToken,
                },
                body: JSON.stringify({
                    lmsSessionId: this.lmsSessionId,
                    transcriptText,
                    lmsApiUrl: this.lmsApiUrl,
                }),
            });

            if (!resp.ok) {
                throw new Error(`Server responded ${resp.status}`);
            }
            console.log('[WhisperRecorder] Transcript saved successfully.');
        } catch (err) {
            console.error('[WhisperRecorder] upload error:', err);
        }
    }

    isActive() {
        return this.isRecording;
    }

    /**
     * Best-effort pagehide upload via sendBeacon.
     * sendBeacon survives page unload but doesn't support custom headers,
     * so we embed the lmsToken in the JSON body instead.
     */
    stopAndUploadSync() {
        if (!this.isRecording || !this.lmsSessionId) return;
        this.isRecording = false;

        if (typeof transcription === 'undefined' || !transcription.transcripts || transcription.transcripts.length === 0) return;

        const transcriptText = transcription.transcripts
            .map(t => `[${t.time}] ${t.name}: ${t.caption}`)
            .join('\n');

        const blob = new Blob(
            [JSON.stringify({ lmsSessionId: this.lmsSessionId, transcriptText, lmsApiUrl: this.lmsApiUrl, lmsToken: this.lmsToken })],
            { type: 'application/json' },
        );
        navigator.sendBeacon('/api/v1/save-transcript-beacon', blob);
    }
}
