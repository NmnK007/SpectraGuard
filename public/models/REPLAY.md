# Acoustic replay detector

This is the **physical-access (PA)** LFCC–LCNN baseline released by Xin Wang / National Institute of Informatics for ASVspoof 2021, trained on ASVspoof 2019 PA. It is a separate model from the synthetic-speech detector, not a reused deepfake score or a duplicate-file heuristic.

- [Official source and training provenance](https://github.com/asvspoof-challenge/2021/tree/main/PA/Baseline-LFCC-LCNN)
- [Official PA checkpoint archive](https://www.asvspoof.org/asvspoof2021/pre_trained_PA_LFCC-LCNN.zip)
- Source license: BSD-3-Clause; retained in `REPLAY-LICENSE.txt`. Check dataset and upstream weight terms before production redistribution; this integration is a research prototype.
- Original `pa_trained_network.pt` SHA256: `1c6d6f30ed1042e584508a9adecc0e514983fff64cdfb3ae3de848064b6e91e0`.
- Converted `replay.onnx` SHA256: `9c25e59bf73b9f772e6e126c6911c984f070deb162cf75d35b854365edadc0a1`.
- Source archive used for conversion SHA256: `5e30736f83aee6f51c094ff17f25f7906090eb555fa9c6818e7620ea35a28b1b` (GitHub `asvspoof-challenge/2021`, commit `9b33f5eca887bd3bf629e3fb79428cd9bb7ac972`).

## Inference

Browser decoding/downmix and band-limited resampling to mono 16 kHz precede the model. Unlike the synthetic model, replay input is **not** standardized to zero mean/unit variance. The original frontend uses pre-emphasis 0.97; periodic Hamming windows of 320 samples; hop 160; FFT 1024; centered zero padding; bins 0 through 255; 20 linear triangular filters; log10 with float32 epsilon; orthonormal DCT; first coefficient replaced by truncated-spectrum log energy; and first/second deltas with replicated endpoints. Exact filterbank, DCT and window values are copied from the checkpoint/reference implementation.

The LCNN, two bidirectional LSTMs, residual temporal mean, and output linear layer process the **entire clip** (up to the application's 30-second limit). Export replaces max-feature-map reshape/reduction with an equivalent channel split/maximum for ONNX compatibility. No trained parameters are changed.

The original network's scalar is a **bonafide logit**: training label 1 means bonafide and 0 means replay/spoof. The UI maps it to `round(100 * sigmoid(-logit))`, so higher means stronger replay suspicion. This is an uncalibrated signal, NOT an empirically calibrated replay probability. The illustrative policy threshold of 70 has not been calibrated for this model or banking calls.

## Reproduction and verification

The small ONNX model (~1.1 MB), frontend parameters, and license are included in the repository. Python is not required to use the application. `npm test` checks JavaScript features against original PyTorch fixtures, checks converted-network logits at 2, 4 and 8 seconds, checks score direction, and checks independent branch failures. Tolerance is 0.001 for feature values and logits. These prove conversion agreement, not real-world detection accuracy.

To recreate the conversion, extract the official checkpoint archive into `.local/replay-weights` and [source archive](https://codeload.github.com/asvspoof-challenge/2021/zip/refs/heads/main) into `.local/asvspoof-source`. In an isolated Python environment with PyTorch 2.6.0 CPU, NumPy, ONNX 1.17.0 and protobuf, run `python scripts/export-replay.py` from the app directory. The script loads weights with `weights_only=True`, validates all state keys, ports the original frontend for reference, and writes the model and fixtures. Verify the input checksums above before reproduction; the upstream main branch may change.

## Test properly

Use matched pairs: a consented direct human recording and playback of that recording through a loudspeaker re-recorded by a microphone. Test several speakers, playback devices, microphones, distances, rooms, codecs, noise levels and genuine speakerphone calls. Keep training/calibration speakers, source recordings and rooms separate from final evaluation. Record false positives and misses at a fixed threshold. Artificial EQ/reverb or choosing the same file twice is not a substitute for acoustic replay evaluation.

No held-out real replay benchmark has been run for this app. Synthetic TTS fixtures are not replay-positive examples. The training corpus uses simulated replay conditions; real room/channel shifts can cause errors. A replay score does not verify the capture path, identify a virtual microphone, establish liveness, or prove fraud. Suspicious or inconclusive evidence should lead to an independent check, never automatic accusation or lockout.

### Observed smoke-test limitation

The browser upload of `test-voices/03_scam_urgency.wav` produced synthetic 66/100 and replay 100/100. That file is digital TTS, not loudspeaker playback, so the replay result is a false alarm for physical replay. It demonstrates cross-attack/domain sensitivity rather than successful replay detection. The app recommended step-up verification, not a fraud verdict. Do not tune the threshold using this single sample or advertise these smoke tests as accuracy evidence.
