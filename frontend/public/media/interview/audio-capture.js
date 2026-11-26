// RNNoise output only; never connected audibly to speakers.
class InterviewCapture extends AudioWorkletProcessor {
  constructor() { super(); this.samples = []; }
  process(inputs, outputs) {
    const input = inputs[0]?.[0];
    if (input) {
      for (let i = 0; i < input.length; i++) this.samples.push(input[i]);
      if (this.samples.length >= sampleRate / 50) {
        this.port.postMessage(new Float32Array(this.samples)); this.samples = [];
      }
    }
    for (const channel of outputs[0] || []) channel.fill(0);
    return true;
  }
}
registerProcessor('interview-capture', InterviewCapture);
