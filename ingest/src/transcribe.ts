export function requestTranscription(): { skipped: true; reason: string } {
    return {
        skipped: true,
        reason: 'Phase 1 ingest is document-only; no ElevenLabs/pyannote/Mux keys',
    };
}
