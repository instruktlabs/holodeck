import { pipeline, env } from '@huggingface/transformers';
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.wasmPaths = '/runtime/';
let transcriber;
self.onmessage = async ({ data }) => {
  const started = performance.now();
  try {
    transcriber ??= pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
      device: 'wasm', dtype: 'q8', revision: '79fb389fc764e7c395bd330e9531d9d32ada7049',
      progress_callback: p => self.postMessage({ type: 'progress', status: p.status, file: p.file, progress: p.progress }),
    });
    const run = await transcriber;
    const ready = performance.now();
    const result = await run(data.audio);
    self.postMessage({ type: 'result', text: result.text, loadMs: ready - started, inferenceMs: performance.now() - ready });
  } catch (error) {
    transcriber = undefined;
    self.postMessage({ type: 'error', message: String(error) });
  }
};
