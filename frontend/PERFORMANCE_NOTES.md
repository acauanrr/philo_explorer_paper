# Performance Notes - Phase 3 WebGL Edge Bundling

## Executive Summary
This document provides practical performance guidelines for the edge bundling visualization system, based on real-world testing and optimization experience.

---

## 🎯 Performance Targets & Limits

### Practical Limits (Standard Dev Machine)
```typescript
const PERFORMANCE_LIMITS = {
  targetFPS: 30,                    // Minimum acceptable FPS
  warningFPS: 25,                   // Trigger optimization warning

  maxEdgesWebGL: 50000,             // Hard limit for WebGL
  maxEdgesOptimal: 15000,           // Optimal for smooth interaction
  maxEdgesCanvas: 10000,            // Canvas 2D fallback limit

  batchSizeWebGL: 10000,            // WebGL buffer update batch
  batchSizeCanvas: 4000,            // Canvas 2D render batch

  workerTimeout: 5000,              // Max bundling computation time
  throttleDelay: 250,               // UI control throttle (ms)
};
```

### Auto-Sampling Strategy
```typescript
// Automatic sample rate calculation
function getOptimalSampleRate(edgeCount: number, currentFPS: number): number {
  if (edgeCount <= 15000 && currentFPS >= 30) {
    return 1.0; // Full sampling
  }

  if (edgeCount > 50000) {
    // Hard limit: sample to 50k max
    return 50000 / edgeCount;
  }

  if (currentFPS < 30) {
    // Progressive reduction based on FPS
    const fpsRatio = currentFPS / 30;
    const edgeRatio = 15000 / edgeCount;
    return Math.max(0.1, Math.min(fpsRatio, edgeRatio));
  }

  return Math.max(0.2, 15000 / edgeCount);
}
```

### UX Notifications
```typescript
// User-facing messages for performance degradation
const PERF_MESSAGES = {
  sampling: (current: number, target: number) =>
    `Reducing edge sampling to ${((target/current)*100).toFixed(0)}% for better performance`,

  fallback: 'WebGL not available, using Canvas 2D (may affect performance)',

  highLoad: 'High edge count detected. Consider filtering or zooming for better performance',

  bundlingProgress: 'Processing edge bundling... This may take a moment',
};
```

---

## 🚀 WebGL Optimization

### Buffer Management
```typescript
// Efficient buffer updates with minimal GPU transfers
class BufferManager {
  private buffers: Map<string, WebGLBuffer> = new Map();
  private pendingUpdates: Float32Array[] = [];
  private updateTimer: number | null = null;

  scheduleUpdate(data: Float32Array) {
    this.pendingUpdates.push(data);

    if (!this.updateTimer) {
      this.updateTimer = requestAnimationFrame(() => {
        this.flushUpdates();
        this.updateTimer = null;
      });
    }
  }

  private flushUpdates() {
    // Batch all updates in single GPU transfer
    const totalSize = this.pendingUpdates.reduce((sum, arr) => sum + arr.length, 0);
    const merged = new Float32Array(totalSize);

    let offset = 0;
    for (const data of this.pendingUpdates) {
      merged.set(data, offset);
      offset += data.length;
    }

    // Single GPU upload
    gl.bufferData(gl.ARRAY_BUFFER, merged, gl.DYNAMIC_DRAW);
    this.pendingUpdates = [];
  }
}
```

### Shader Optimizations
```glsl
// Optimized vertex shader with minimal branching
attribute vec2 a_src;
attribute vec2 a_tgt;
attribute float a_weight;

uniform mat3 uView;
uniform vec2 uResolution;
uniform float uWidthScale; // Pre-computed width scale

varying float v_alpha;

void main() {
  // Single matrix multiplication for transform
  vec3 transformed = uView * vec3(mix(a_src, a_tgt, 0.5), 1.0);

  // Pre-scale for resolution
  vec2 ndc = (transformed.xy / uResolution) * 2.0 - 1.0;
  gl_Position = vec4(ndc * vec2(1, -1), 0.0, 1.0);

  // Pass interpolated alpha (avoid fragment shader computation)
  v_alpha = 0.1 + a_weight * 0.8;
  gl_PointSize = uWidthScale * (0.5 + a_weight * 2.5);
}
```

---

## 👷 Web Worker Strategy

### Worker Configuration
```typescript
const WORKER_CONFIG = {
  enabled: true,              // Always prefer workers for bundling
  maxWorkers: navigator.hardwareConcurrency || 4,

  bundling: {
    batchSize: 1000,         // Edges per batch
    reportInterval: 500,     // Progress report interval (ms)
    maxDuration: 5000,       // Kill if exceeds (ms)
  }
};
```

### Efficient Worker Communication
```typescript
class BundlingWorkerPool {
  private workers: Worker[] = [];
  private taskQueue: Task[] = [];
  private activeWorkers = 0;

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      const worker = new Worker('./bundlingWorker.ts');
      worker.onmessage = this.handleMessage.bind(this, i);
      this.workers.push(worker);
    }
  }

  process(edges: Edge[], batchSize: number = 1000) {
    // Split into batches
    for (let i = 0; i < edges.length; i += batchSize) {
      this.taskQueue.push({
        edges: edges.slice(i, i + batchSize),
        batchId: Math.floor(i / batchSize)
      });
    }

    this.processNext();
  }

  private processNext() {
    if (this.taskQueue.length === 0 || this.activeWorkers >= this.workers.length) {
      return;
    }

    const task = this.taskQueue.shift()!;
    const workerIdx = this.workers.findIndex((_, i) => !this.isActive(i));

    if (workerIdx !== -1) {
      this.activeWorkers++;
      this.workers[workerIdx].postMessage({
        type: 'RUN',
        payload: task
      });
    }
  }

  private handleMessage(workerIdx: number, event: MessageEvent) {
    if (event.data.type === 'PARTIAL') {
      // Stream partial results for progressive rendering
      this.onPartialResult?.(event.data.payload);
    } else if (event.data.type === 'DONE') {
      this.activeWorkers--;
      this.processNext(); // Continue with next batch
    }
  }

  onPartialResult?: (result: any) => void;
}
```

---

## 🖱️ Pan/Zoom Implementation

### D3-Zoom Integration
```typescript
import * as d3 from 'd3-zoom';
import { select } from 'd3-selection';

function setupPanZoom(
  canvasElement: HTMLCanvasElement,
  onTransform: (transform: { translate: [number, number]; scale: number }) => void
) {
  const zoom = d3.zoom<HTMLCanvasElement, unknown>()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => {
      // Debounce for performance
      requestAnimationFrame(() => {
        onTransform({
          translate: [event.transform.x, event.transform.y],
          scale: event.transform.k
        });
      });
    });

  select(canvasElement).call(zoom);

  // Reset function
  return {
    reset: () => {
      select(canvasElement)
        .transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity);
    },

    zoomTo: (scale: number) => {
      select(canvasElement)
        .transition()
        .duration(500)
        .call(zoom.scaleTo, scale);
    }
  };
}
```

### View Matrix Updates
```typescript
// Efficient view matrix computation
class ViewMatrixManager {
  private matrix = new Float32Array(9);
  private dirty = false;

  update(translate: [number, number], scale: number) {
    // Column-major 3x3 matrix
    this.matrix[0] = scale;  // m00
    this.matrix[1] = 0;      // m10
    this.matrix[2] = 0;      // m20
    this.matrix[3] = 0;      // m01
    this.matrix[4] = scale;  // m11
    this.matrix[5] = 0;      // m21
    this.matrix[6] = translate[0]; // m02
    this.matrix[7] = translate[1]; // m12
    this.matrix[8] = 1;      // m22

    this.dirty = true;
  }

  apply(gl: WebGLRenderingContext, location: WebGLUniformLocation) {
    if (this.dirty) {
      gl.uniformMatrix3fv(location, false, this.matrix);
      this.dirty = false;
    }
  }
}
```

---

## 📱 HiDPI Support

### Device Pixel Ratio Handling
```typescript
class HiDPICanvas {
  private canvas: HTMLCanvasElement;
  private dpr: number;
  private regl: REGL.Regl;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.dpr = window.devicePixelRatio || 1;
    this.setupCanvas();
    this.setupResizeObserver();
  }

  private setupCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Set internal size accounting for DPR
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;

    // Maintain CSS size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Initialize regl with DPR
    this.regl = createREGL({
      canvas: this.canvas,
      pixelRatio: this.dpr,
      attributes: {
        antialias: this.dpr === 1, // Disable AA on retina for performance
        preserveDrawingBuffer: false
      }
    });
  }

  private setupResizeObserver() {
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;

        // Update canvas size
        this.canvas.width = width * this.dpr;
        this.canvas.height = height * this.dpr;

        // Notify regl
        this.regl.poll();

        // Trigger redraw
        this.onResize?.(width, height);
      }
    });

    resizeObserver.observe(this.canvas);
  }

  onResize?: (width: number, height: number) => void;
}
```

---

## 📊 Performance Monitoring

### Real-time Metrics Collection
```typescript
class PerformanceProfiler {
  private metrics: Map<string, number[]> = new Map();
  private marks: Map<string, number> = new Map();

  mark(name: string) {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string) {
    const start = this.marks.get(startMark);
    if (!start) return;

    const duration = performance.now() - start;

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const samples = this.metrics.get(name)!;
    samples.push(duration);

    // Keep last 60 samples
    if (samples.length > 60) {
      samples.shift();
    }

    // Log if performance degrades
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    if (avg > 16.67) { // Below 60 FPS
      console.warn(`[PERF] ${name} averaging ${avg.toFixed(2)}ms (target: 16.67ms)`);
    }
  }

  getStats(name: string) {
    const samples = this.metrics.get(name) || [];
    if (samples.length === 0) return null;

    const sorted = [...samples].sort((a, b) => a - b);
    return {
      avg: samples.reduce((a, b) => a + b, 0) / samples.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(samples.length * 0.5)],
      p95: sorted[Math.floor(samples.length * 0.95)],
      p99: sorted[Math.floor(samples.length * 0.99)],
    };
  }

  logReport() {
    console.group('[Performance Report]');
    for (const [name, samples] of this.metrics) {
      const stats = this.getStats(name);
      if (stats) {
        console.log(`${name}:`, {
          avg: `${stats.avg.toFixed(2)}ms`,
          p95: `${stats.p95.toFixed(2)}ms`,
          p99: `${stats.p99.toFixed(2)}ms`,
        });
      }
    }
    console.groupEnd();
  }
}

// Usage
const profiler = new PerformanceProfiler();

// In render loop
profiler.mark('frame-start');
renderScene();
profiler.measure('frame-time', 'frame-start');

// Periodic reporting
setInterval(() => profiler.logReport(), 5000);
```

---

## 🔧 Optimization Checklist

### Before Deployment
- [ ] Test with 50k+ edges to verify auto-sampling
- [ ] Verify WebGL fallback on Safari/older browsers
- [ ] Check memory usage with Performance Monitor
- [ ] Test on 4K/Retina displays for DPR handling
- [ ] Verify worker termination on navigation
- [ ] Test throttling with rapid slider movements
- [ ] Validate cache headers (X-Cache: HIT/MISS)
- [ ] Check bundle size (<500KB for edge bundling module)

### Performance Bottlenecks to Watch
1. **Shader Compilation**: Cache compiled programs
2. **Buffer Updates**: Batch updates, use DYNAMIC_DRAW
3. **Worker Communication**: Use Transferable objects for large arrays
4. **Canvas Redraws**: Implement dirty rectangle optimization
5. **Memory Leaks**: Dispose WebGL resources properly

### Quick Wins
- Enable `will-change: transform` on canvas CSS
- Use `contain: layout style paint` for container isolation
- Implement virtual scrolling for edge lists
- Pre-calculate static transformations
- Use ImageBitmap for texture atlases

---

## 📝 Debug Flags

```typescript
// Environment variables for debugging
process.env.NEXT_PUBLIC_RENDER_DEBUG = 'true';     // Enable render stats
process.env.NEXT_PUBLIC_CACHE_DEBUG = 'true';      // Enable cache logs
process.env.NEXT_PUBLIC_WORKER_DEBUG = 'true';     // Worker communication
process.env.NEXT_PUBLIC_PERF_OVERLAY = 'true';     // Show FPS overlay
```

---

*Last updated: Phase 3 Implementation*
*Performance baseline: MacBook Pro M1, Chrome 120+, 16GB RAM*