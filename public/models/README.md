# Pretrained synthetic-speech model

`synthetic.onnx` is the INT8 conversion by pranjal-pravesh of Gustking's Wav2Vec2 Large XLSR deepfake audio classifier. Model card license: Apache-2.0.

Source: https://huggingface.co/pranjal-pravesh/wav2vec2-large-xlsr-deepfake-audio-classification

Revision: `9897e13`; file: `model_int8.onnx`; SHA256: `7af799e8443c3d030bb3ef644ffc6e74f5b6fddcd6a4286ee9abe9e828cb762e`.

Run `powershell -ExecutionPolicy Bypass -File scripts/download-model.ps1` from the app directory to restore the Git-ignored 355,336,130-byte weights. These are pretrained external weights, not models trained by SpectraGuard. No accuracy claim from the source card has been independently verified here.

Input: normalized mono 16 kHz float32 waveform. The downloaded graph requires **int32 attention_mask** (the card's int64 example is inconsistent with this graph). Output labels: 0 real, 1 fake. SpectraGuard averages softmax fake scores over up-to-four-second windows, skips near-silent windows, and displays a rounded 0–100 signal. This aggregation and the policy threshold are uncalibrated. A low score is not proof of genuine speech.

This model is NOT an acoustic replay classifier. A separate pretrained PA model now supplies the replay branch; see [REPLAY.md](REPLAY.md). A fresh session nonce does not detect acoustic replay or a virtual microphone.

The standalone embedded Worker excludes model/WASM assets and returns an explicit unavailable response for these assets. Use the local Node/Vite app for pretrained inference. A production host needs separate large-asset serving, suitable WASM policy, and end-to-end validation.
