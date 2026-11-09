# SpectraGuard

A voice-forensics hackathon workspace with mock payment decisions. Inspired by the operational information hierarchy of [SOCius](https://pixelean.com/case-studies/socius/), with original UI components. React, Vite, Web Audio, and a small Fetch API service; deploys as a self-contained Cloudflare Worker.

## Run

Requires Node.js 22.12+ (or a supported newer release).

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5178. `npm test` runs security, policy, and DSP checks. `npm run build` builds the frontend and `dist/server/index.js` for Sites hosting. The dev server binds to loopback only.

## What works

- Six explicitly simulated scenarios, searchable session table, separate evidence branches, policy controls, scenario checks, metadata-only activity, and redacted JSON exports.
- Explicit consent before microphone recording or local-file analysis. Recording auto-stops after 12 seconds; supported browser audio files up to 10 MB / 30 seconds. PCM downmix, Hann-windowed FFT, measured STFT, duration/RMS/clipping quality gate. Processing stays in the browser.
- Server-generated 90-second challenge, random nonce, HttpOnly SameSite cookie, one-use consumption, session and mock transaction binding, same-origin checks, request-size limit and per-instance rate limit. A new challenge invalidates the preceding challenge in that browser session.
- Manual English transcript rules for secrecy, urgency, credential requests, payment redirection, and authority claims, with limited negation suppression.
- Retry, reissue, independent verification, and normal-check outcomes. No real payment, account lockout, or actual MFA action.

## What is deliberately unverified

The supplied archive contained research and a proposal, not trained weights or a labeled evaluation corpus. Synthetic and replay scores are simulated in demo cases. Local audio always reports those models unavailable and routes usable audio to independent verification. A spectrogram is not a fraud classifier. No accuracy, EER, FPR, or model latency has been measured.

Session freshness validates a submission envelope. The supplied digest is a client assertion; it is not attestation, nor proof that audio was generated after the challenge. The spoken phrase is not ASR-verified. Browser permissions, good audio quality, and a fresh nonce do not prove a physical microphone or exclude a virtual source, client compromise, or live relay. Acoustic replay and injection are separate branches and need independent evaluation.

The challenge store is ephemeral and per process/isolate. Restarts, deployment, and cross-isolate routing can invalidate a session and require a retry. It fails closed. Rate limiting is also per instance, not a global abuse defense. Production requires an authenticated bank-owned session, atomic shared nonce storage (with TTL), reliable rate limiting, trusted capture mechanisms where available, and measured detector calibration. This prototype does not provide those production guarantees.

Audio and manual transcripts are not sent to the server. Server challenge state holds a session identifier, mock transaction fingerprint, expiry, and used marker; expired entries are removed on the next request. A digest is checked and discarded. No application-level request/audio/transcript logging exists. Browser session arrays retain local features and manual text until cleared/reloaded; raw media buffers are released after processing, without a forensic-erasure guarantee. Hosting may keep ordinary request metadata. No localStorage, analytics, or voiceprint database.

## Design choice

SOCius fits the operator workflow: calm charcoal surfaces, restrained lime accents, clear hierarchy, branch-level evidence, and actionable next steps. Cyntra is a strong marketing reference, while the second Dribbble reference is a personal cyberpunk portfolio. The UI favors operational readability, uses amber for attention and blue for uncertainty, and labels simulated inputs at the point of use.

## Next research work

1. Integrate separately trained and versioned synthetic (LA/DF) and replay (PA) models behind an authenticated inference interface. Keep absent/error states explicit.
2. Calibrate each branch on development data; hold out speakers, generators, source recordings, devices, and rooms in evaluation. Include genuine speakerphone, noisy audio, and assistive speech.
3. Measure EER, recall at fixed FPR, false step-up rates, and p50/p95 latency on named hardware. Compare individual branches with the combined policy.
4. Evaluate capture integrity separately: protocol misuse tests do not measure virtual-microphone detection. Integrate trusted platform telemetry only with a justified threat model.
5. Validate contextual rules across languages, negation, quoting, and benign urgency. Add opt-in local ASR only after privacy and performance review.

References: user-supplied research and SpectraGuard presentation in the sibling `research` directory; [Web Audio AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode); [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).

## Training and loading experimental models

The local inference adapter accepts separate synthetic and replay JSON artifacts. Train each with `node scripts/train-baseline.mjs manifest.json synthetic synthetic.json` (use `replay` for the other branch). Each manifest row contains `file` (PCM16 WAV), `label` (0 genuine/direct, 1 synthetic/replay), `split` (`train` or `test`), `speaker`, and `source`. Speaker and source identifiers cannot overlap splits. Run with properly licensed data; no dataset or trained production model is bundled. Load the resulting artifacts under Evaluation lab, then run Local audio. Imported metrics are not independently verified. The baseline uses simple acoustic features and logistic regression, not a validated spectrogram CNN. Scores are experimental model outputs, not calibrated fraud probabilities. The default policy threshold is illustrative and differs from the training report’s 50-point diagnostic threshold.
