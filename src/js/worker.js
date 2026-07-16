// Web Worker entry: generates puzzles off the main thread so the UI never
// freezes on 8×8 / 10×10. Posts progress updates and the finished puzzle.
import { generate } from './generator.js';

self.onmessage = (e) => {
  const { id, opts } = e.data;
  try {
    const puzzle = generate({
      ...opts,
      onProgress: (frac) => self.postMessage({ id, type: 'progress', frac }),
    });
    self.postMessage({ id, type: 'done', puzzle });
  } catch (err) {
    self.postMessage({ id, type: 'error', message: String(err?.message ?? err) });
  }
};
