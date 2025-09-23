/**
 * Color map utilities for projection quality visualization
 */

export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

/**
 * Map a value from [min, max] to [0, 1]
 */
export function mapValueToUnit(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Viridis colormap implementation
 * Based on matplotlib's viridis colormap
 * @param t - Value in [0, 1]
 * @returns RGB values in [0, 255]
 */
export function colormapViridis(t: number): RGB {
  // Clamp t to [0, 1]
  t = clamp(t, 0, 1);

  // Viridis color points (simplified for performance)
  const colors = [
    [68, 1, 84],      // 0.0 - dark purple
    [71, 13, 96],     // 0.1
    [72, 29, 111],    // 0.2
    [71, 42, 122],    // 0.3
    [65, 57, 125],    // 0.4
    [57, 71, 126],    // 0.5
    [48, 85, 123],    // 0.6
    [38, 98, 118],    // 0.7
    [29, 111, 110],   // 0.8
    [23, 125, 101],   // 0.9
    [253, 231, 37]    // 1.0 - bright yellow
  ];

  // Find the two colors to interpolate between
  const idx = t * (colors.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;

  if (i >= colors.length - 1) {
    return colors[colors.length - 1] as RGB;
  }

  // Linear interpolation between colors
  const c1 = colors[i];
  const c2 = colors[i + 1];

  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * f),
    Math.round(c1[1] + (c2[1] - c1[1]) * f),
    Math.round(c1[2] + (c2[2] - c1[2]) * f)
  ] as RGB;
}

/**
 * Turbo colormap implementation
 * High contrast colormap for better visibility
 * @param t - Value in [0, 1]
 * @returns RGB values in [0, 255]
 */
export function colormapTurbo(t: number): RGB {
  // Clamp t to [0, 1]
  t = clamp(t, 0, 1);

  // Polynomial approximations for R, G, B channels
  let r, g, b;

  if (t < 0.35) {
    r = 255 * (0.13 + (0.92 * t));
    g = 255 * (0.0 + (1.29 * t));
    b = 255 * (0.35 + (0.33 * t));
  } else if (t < 0.66) {
    const x = t - 0.35;
    r = 255 * (0.445 + (0.616 * x));
    g = 255 * (0.451 + (0.548 * x));
    b = 255 * (0.47 - (0.47 * x));
  } else if (t < 0.89) {
    const x = t - 0.66;
    r = 255 * (0.69 - (0.52 * x));
    g = 255 * (0.68 - (0.68 * x));
    b = 255 * (0.17 - (0.17 * x));
  } else {
    const x = t - 0.89;
    r = 255 * (0.58 - (0.45 * x));
    g = 255 * (0.0);
    b = 255 * (0.0);
  }

  return [
    Math.round(clamp(r, 0, 255)),
    Math.round(clamp(g, 0, 255)),
    Math.round(clamp(b, 0, 255))
  ] as RGB;
}

/**
 * Plasma colormap implementation
 * @param t - Value in [0, 1]
 * @returns RGB values in [0, 255]
 */
export function colormapPlasma(t: number): RGB {
  t = clamp(t, 0, 1);

  // Plasma color points
  const colors = [
    [13, 8, 135],     // 0.0 - dark blue
    [65, 4, 153],     // 0.1
    [106, 0, 168],    // 0.2
    [142, 1, 177],    // 0.3
    [176, 7, 179],    // 0.4
    [208, 29, 173],   // 0.5
    [234, 61, 159],   // 0.6
    [251, 97, 140],   // 0.7
    [255, 135, 118],  // 0.8
    [254, 173, 97],   // 0.9
    [240, 249, 33]    // 1.0 - yellow
  ];

  const idx = t * (colors.length - 1);
  const i = Math.floor(idx);
  const f = idx - i;

  if (i >= colors.length - 1) {
    return colors[colors.length - 1] as RGB;
  }

  const c1 = colors[i];
  const c2 = colors[i + 1];

  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * f),
    Math.round(c1[1] + (c2[1] - c1[1]) * f),
    Math.round(c1[2] + (c2[2] - c1[2]) * f)
  ] as RGB;
}

/**
 * Cool-warm diverging colormap
 * Good for showing positive/negative errors
 * @param t - Value in [0, 1]
 * @returns RGB values in [0, 255]
 */
export function colormapCoolwarm(t: number): RGB {
  t = clamp(t, 0, 1);

  let r, g, b;

  if (t < 0.5) {
    // Cool colors (blue to white)
    const x = t * 2; // Map to [0, 1]
    r = Math.round(59 + (255 - 59) * x);
    g = Math.round(76 + (255 - 76) * x);
    b = Math.round(192 + (255 - 192) * x);
  } else {
    // Warm colors (white to red)
    const x = (t - 0.5) * 2; // Map to [0, 1]
    r = 255;
    g = Math.round(255 - (255 - 59) * x);
    b = Math.round(255 - (255 - 50) * x);
  }

  return [r, g, b] as RGB;
}

/**
 * Get colormap function by name
 */
export function getColormap(name: string): (t: number) => RGB {
  switch (name) {
    case 'viridis':
      return colormapViridis;
    case 'turbo':
      return colormapTurbo;
    case 'plasma':
      return colormapPlasma;
    case 'coolwarm':
      return colormapCoolwarm;
    default:
      return colormapViridis;
  }
}

/**
 * Apply colormap to a value with alpha
 * @param value - Value to map
 * @param min - Minimum value
 * @param max - Maximum value
 * @param colormap - Colormap function or name
 * @param alpha - Alpha value [0, 255]
 */
export function applyColormap(
  value: number,
  min: number,
  max: number,
  colormap: ((t: number) => RGB) | string,
  alpha: number = 255
): RGBA {
  const t = mapValueToUnit(value, min, max);
  const colormapFn = typeof colormap === 'string' ? getColormap(colormap) : colormap;
  const [r, g, b] = colormapFn(t);
  return [r, g, b, alpha];
}

/**
 * Create a color scale legend canvas
 * @param colormap - Colormap function or name
 * @param width - Canvas width
 * @param height - Canvas height
 * @param vertical - If true, gradient is vertical
 */
export function createColorScaleLegend(
  colormap: ((t: number) => RGB) | string,
  width: number,
  height: number,
  vertical: boolean = false
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const colormapFn = typeof colormap === 'string' ? getColormap(colormap) : colormap;
  const steps = vertical ? height : width;

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const [r, g, b] = colormapFn(t);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

    if (vertical) {
      ctx.fillRect(0, height - i - 1, width, 1);
    } else {
      ctx.fillRect(i, 0, 1, height);
    }
  }

  return canvas;
}

/**
 * Interpolate between two colors
 * @param color1 - First color [R, G, B]
 * @param color2 - Second color [R, G, B]
 * @param t - Interpolation factor [0, 1]
 */
export function interpolateColors(color1: RGB, color2: RGB, t: number): RGB {
  t = clamp(t, 0, 1);
  return [
    Math.round(color1[0] + (color2[0] - color1[0]) * t),
    Math.round(color1[1] + (color2[1] - color1[1]) * t),
    Math.round(color1[2] + (color2[2] - color1[2]) * t)
  ] as RGB;
}

export default {
  mapValueToUnit,
  clamp,
  colormapViridis,
  colormapTurbo,
  colormapPlasma,
  colormapCoolwarm,
  getColormap,
  applyColormap,
  createColorScaleLegend,
  interpolateColors
};