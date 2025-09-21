import * as d3 from "d3";
import * as d3ScaleChromatic from "d3-scale-chromatic";

/**
 * Calculate color contrast ratio for accessibility (WCAG 2.1 compliant)
 * @param {string} color1 - First color
 * @param {string} color2 - Second color
 * @returns {number} - Contrast ratio (1-21)
 */
function getColorContrast(color1, color2) {
  try {
    const rgb1 = d3.rgb(color1);
    const rgb2 = d3.rgb(color2);

    // Calculate relative luminance according to WCAG
    const getLuminance = (rgb) => {
      const rs = rgb.r / 255;
      const gs = rgb.g / 255;
      const bs = rgb.b / 255;

      const r = rs <= 0.03928 ? rs / 12.92 : Math.pow((rs + 0.055) / 1.055, 2.4);
      const g = gs <= 0.03928 ? gs / 12.92 : Math.pow((gs + 0.055) / 1.055, 2.4);
      const b = bs <= 0.03928 ? bs / 12.92 : Math.pow((bs + 0.055) / 1.055, 2.4);

      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const lum1 = getLuminance(rgb1);
    const lum2 = getLuminance(rgb2);

    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);

    return (brightest + 0.05) / (darkest + 0.05);
  } catch (error) {
    console.warn('Color contrast calculation failed:', error);
    return 1; // Worst case scenario
  }
}

/**
 * Check if a color is too light for white background visibility
 * @param {string} color - Color to test
 * @param {number} minContrast - Minimum contrast ratio (default: 3.0 for AA)
 * @returns {boolean} - True if color is too light
 */
function isColorTooLight(color, minContrast = 3.0) {
  try {
    const contrast = getColorContrast(color, '#ffffff');
    return contrast < minContrast;
  } catch (error) {
    return false; // If we can't calculate, assume it's OK
  }
}

/**
 * Filter out colors that are too light for white background
 * @param {Array} colorArray - Array of colors to filter
 * @param {number} minContrast - Minimum contrast ratio
 * @returns {Array} - Filtered array with only visible colors
 */
function filterLightColors(colorArray, minContrast = 3.0) {
  return colorArray.filter(color => {
    const tooLight = isColorTooLight(color, minContrast);
    if (tooLight) {
      console.warn(`🚫 Removed light color from palette: ${color} (contrast: ${getColorContrast(color, '#ffffff').toFixed(2)})`);
    }
    return !tooLight;
  });
}

/**
 * Create high-contrast versions of palettes for white backgrounds
 * @param {Array} originalPalette - Original color palette
 * @param {number} minContrast - Minimum contrast requirement
 * @returns {Array} - High-contrast palette
 */
function createHighContrastPalette(originalPalette, minContrast = 3.0) {
  const filtered = filterLightColors(originalPalette, minContrast);

  // If we filtered out too many colors, darken the light ones instead of removing
  if (filtered.length < originalPalette.length * 0.7) {
    console.log('📝 Too many colors filtered, darkening light colors instead');

    return originalPalette.map(color => {
      if (isColorTooLight(color, minContrast)) {
        try {
          // Darken the color until it meets contrast requirements
          let hsl = d3.hsl(color);
          let iterations = 0;

          while (getColorContrast(hsl.toString(), '#ffffff') < minContrast && iterations < 10) {
            hsl.l = Math.max(0.1, hsl.l - 0.1); // Darken by 10% each iteration
            iterations++;
          }

          console.log(`🔧 Darkened color: ${color} → ${hsl.toString()}`);
          return hsl.toString();
        } catch (error) {
          // If darkening fails, use a safe dark color
          return '#2d3748'; // Dark gray fallback
        }
      }
      return color;
    });
  }

  return filtered;
}

// Modern Color Palettes for Group-Based Coloring (White Background Optimized)
const MODERN_PALETTES = {
  // Primary palette - filtered for white background visibility
  primary: createHighContrastPalette(d3ScaleChromatic.schemeTableau10),

  // Alternative palettes - all optimized for white backgrounds
  vibrant: createHighContrastPalette(d3ScaleChromatic.schemeSet2),
  soft: createHighContrastPalette(d3ScaleChromatic.schemePastel1, 4.0), // Higher contrast for pastels
  qualitative: createHighContrastPalette(d3ScaleChromatic.schemeSet3),
  categorical: createHighContrastPalette(d3ScaleChromatic.schemeCategory10),

  // For larger datasets, use only high-contrast colors
  extended: createHighContrastPalette([
    ...d3ScaleChromatic.schemeTableau10,
    ...d3ScaleChromatic.schemeSet2,
    ...d3ScaleChromatic.schemeSet3.slice(0, 8) // Avoid the lightest pastels
  ], 3.5) // Slightly higher contrast for extended palette
};

// Current active palette (can be changed dynamically)
let ACTIVE_PALETTE = MODERN_PALETTES.primary;

/**
 * Create a modern group-based color scale
 * @param {Array} groupIds - Array of unique group IDs
 * @param {string} paletteName - Name of palette to use ('primary', 'vibrant', etc.)
 * @returns {Function} - D3 ordinal scale function
 */
export function createGroupColorScale(groupIds, paletteName = 'primary') {
  const palette = MODERN_PALETTES[paletteName] || MODERN_PALETTES.primary;

  // For large number of groups, use extended palette
  const effectivePalette = groupIds.length > palette.length
    ? MODERN_PALETTES.extended
    : palette;

  return d3.scaleOrdinal()
    .domain(groupIds)
    .range(effectivePalette)
    .unknown('#999999'); // Fallback color for unknown groups
}

/**
 * Get color for a node based on its groupId (modern approach)
 * @param {Object} node - Tree node with data.groupId property
 * @param {Function} groupColorScale - Color scale function
 * @returns {string} - Hex color code
 */
export function getGroupColor(node, groupColorScale) {
  if (!node.data || !node.data.groupId) {
    return '#999999'; // Default gray for nodes without groupId
  }

  return groupColorScale(node.data.groupId);
}

/**
 * Change the active palette dynamically
 * @param {string} paletteName - Name of palette to switch to
 */
export function setActivePalette(paletteName) {
  if (MODERN_PALETTES[paletteName]) {
    ACTIVE_PALETTE = MODERN_PALETTES[paletteName];
    console.log(`🎨 Switched to palette: ${paletteName}`);
  } else {
    console.warn(`⚠️ Palette '${paletteName}' not found, keeping current palette`);
  }
}

/**
 * Find the root node (shallowest) of a specific group
 * @param {d3.HierarchyNode} root - The tree root
 * @param {string} groupId - The group ID to find
 * @returns {d3.HierarchyNode|null} - The group root node or null
 */
function findGroupRoot(root, groupId) {
  let groupRoot = null;
  let minDepth = Infinity;

  root.each(node => {
    if (node.data.groupId === groupId && node.depth < minDepth) {
      minDepth = node.depth;
      groupRoot = node;
    }
  });

  return groupRoot;
}

/**
 * Detect if a node represents mixed categories/groups
 * @param {Object} node - Tree node
 * @returns {Object|null} - Mixed node info or null
 */
function detectMixedNode(node) {
  if (!node.data?.name) return null;

  const name = node.data.name;

  // Check for explicit "_mixed" in the name
  if (name.includes('_mixed')) {
    const categories = name.split('_').filter(part =>
      part !== 'mixed' && part !== 'cluster' && !part.match(/^\d+$/) && TAXONOMIC_COLORS[part]
    );

    if (categories.length > 1) {
      return {
        type: 'mixed',
        categories: categories,
        primaryCategory: categories[0], // Use first as primary
        secondaryCategory: categories[1] || null
      };
    }
  }

  return null;
}

/**
 * Handle mixed nodes with improved visual strategy
 * @param {Object} node - Tree node
 * @param {Function} groupColorScale - Color scale function
 * @param {d3.HierarchyNode} root - Tree root
 * @returns {Object} - Color and pattern information
 */
function handleMixedNode(node, groupColorScale, root) {
  const mixedInfo = detectMixedNode(node);

  if (!mixedInfo) {
    return { color: null, isPattern: false };
  }

  // Strategy A: Use primary category color (cleaner approach)
  const primaryCategory = mixedInfo.primaryCategory;

  // Try to find the groupId for the primary category
  let primaryColor = null;
  if (node.data.groupId && groupColorScale) {
    // Use group-based color if available
    primaryColor = groupColorScale(node.data.groupId);
  } else if (TAXONOMIC_COLORS[primaryCategory]) {
    // Fallback to legacy color
    primaryColor = TAXONOMIC_COLORS[primaryCategory];
  }

  if (primaryColor) {
    // Add metadata for potential pattern rendering
    return {
      color: primaryColor,
      isPattern: true,
      patternInfo: {
        primary: primaryColor,
        secondary: TAXONOMIC_COLORS[mixedInfo.secondaryCategory] || null,
        categories: mixedInfo.categories
      }
    };
  }

  return { color: null, isPattern: false };
}

/**
 * Get color for a node with subtle within-group variation (Modern Approach)
 * @param {Object} node - Tree node with data.groupId property
 * @param {Function} groupColorScale - Color scale function
 * @param {d3.HierarchyNode} root - Tree root for group calculations
 * @returns {string} - Hex color code with subtle variation
 */
export function getNodeColorWithVariation(node, groupColorScale, root) {
  if (!node.data || !node.data.groupId) {
    return '#999999'; // Default gray for nodes without groupId
  }

  // Check for mixed nodes first
  const mixedResult = handleMixedNode(node, groupColorScale, root);
  if (mixedResult.color) {
    // Store pattern info on the node for potential SVG pattern use
    if (mixedResult.isPattern) {
      node.patternInfo = mixedResult.patternInfo;
    }

    // Apply depth variation to the primary color
    const groupRoot = findGroupRoot(root, node.data.groupId);
    if (groupRoot) {
      const relativeDepth = node.depth - groupRoot.depth;
      const lighteningFactor = relativeDepth * 0.15;

      try {
        return d3.color(mixedResult.color).brighter(lighteningFactor).toString();
      } catch (error) {
        return mixedResult.color;
      }
    }

    return mixedResult.color;
  }

  // 1. Get the base color for the group
  const baseColor = groupColorScale(node.data.groupId);

  // 2. Find the root of this group to calculate relative depth
  const groupRoot = findGroupRoot(root, node.data.groupId);

  if (!groupRoot) {
    // Fallback: use the base color if group root not found
    return baseColor;
  }

  // 3. Calculate relative depth within the group
  const relativeDepth = node.depth - groupRoot.depth;

  // 4. Apply subtle lightness variation
  // Use d3.color().brighter() for controlled lightening
  // Factor 0.15 per level gives subtle but noticeable variation
  const lighteningFactor = relativeDepth * 0.15;

  try {
    const finalColor = d3.color(baseColor).brighter(lighteningFactor);
    return finalColor.toString();
  } catch (error) {
    // Fallback to base color if d3.color fails
    console.warn('Color variation failed, using base color:', error);
    return baseColor;
  }
}

/**
 * Identify major clades/groups in the tree dynamically
 * @param {d3.HierarchyNode} root - The root node of the tree
 * @param {number} maxDepth - Maximum depth to consider for major clades (default: 2)
 * @returns {d3.HierarchyNode} - The tree with groupId assigned to each node
 */
export function identifyMajorClades(root, maxDepth = 2) {
  let groupIdCounter = 0;

  // First pass: traverse the tree and assign groupIds
  root.each(node => {
    // Root node gets no group (or could be group 0)
    if (node.depth === 0) {
      node.data.groupId = 'root';
      return;
    }

    // Nodes at depth 1 to maxDepth define new major groups
    if (node.depth >= 1 && node.depth <= maxDepth) {
      // Only create a new group if this node doesn't already have one
      if (!node.data.groupId) {
        groupIdCounter++;
        node.data.groupId = `group-${groupIdCounter}`;
      }
    }

    // All other nodes inherit the groupId from their nearest major clade ancestor
    if (!node.data.groupId && node.parent) {
      // Find the nearest ancestor with a groupId
      let ancestor = node.parent;
      while (ancestor && !ancestor.data.groupId) {
        ancestor = ancestor.parent;
      }

      if (ancestor && ancestor.data.groupId) {
        node.data.groupId = ancestor.data.groupId;
      } else {
        // Fallback: create a new group if no ancestor has one
        groupIdCounter++;
        node.data.groupId = `group-${groupIdCounter}`;
      }
    }
  });

  // Second pass: ensure all nodes have a groupId and collect group statistics
  const groupStats = new Map();

  root.each(node => {
    // Ensure every node has a groupId
    if (!node.data.groupId) {
      groupIdCounter++;
      node.data.groupId = `group-${groupIdCounter}`;
    }

    // Collect statistics about each group
    const groupId = node.data.groupId;
    if (!groupStats.has(groupId)) {
      groupStats.set(groupId, {
        id: groupId,
        count: 0,
        depth: node.depth,
        representative: node.data.name
      });
    }

    const stats = groupStats.get(groupId);
    stats.count++;

    // Keep the shallowest node as the representative
    if (node.depth < stats.depth) {
      stats.depth = node.depth;
      stats.representative = node.data.name;
    }
  });

  // Store group statistics on the root for reference
  root.groupStats = Array.from(groupStats.values())
    .sort((a, b) => b.count - a.count); // Sort by size (largest groups first)

  console.log('📊 Identified', groupStats.size, 'major clades:', root.groupStats);

  // Debug: Log a sample of nodes with their groupIds
  const sampleNodes = [];
  root.each(node => {
    if (sampleNodes.length < 10) {
      sampleNodes.push({
        name: node.data.name,
        depth: node.depth,
        groupId: node.data.groupId
      });
    }
  });
  console.log('🔍 Sample nodes with groupIds:', sampleNodes);

  return root;
}

// Taxonomic color scheme based on major domains and kingdoms
const TAXONOMIC_COLORS = {
  // Domains
  "Bacteria": "#e41a1c",
  "Archaea": "#984ea3",
  "Eukaryota": "#4daf4a",

  // Bacterial phyla
  "Proteobacteria": "#ff7f00",
  "Firmicutes": "#ffff33",
  "Actinobacteria": "#a65628",
  "Bacteroidetes": "#f781bf",
  "Cyanobacteria": "#377eb8",
  "Spirochaetes": "#999999",
  "Chlamydiae": "#66c2a5",
  "Planctomycetes": "#fc8d62",
  "Acidobacteria": "#8da0cb",
  "Chloroflexi": "#e78ac3",
  "Deinococcus": "#a6d854",
  "Thermus": "#ffd92f",

  // Archaeal phyla
  "Euryarchaeota": "#8b4789",
  "Crenarchaeota": "#d8b2d8",
  "Thaumarchaeota": "#9370db",

  // Eukaryotic kingdoms
  "Animalia": "#2ca02c",
  "Plantae": "#98df8a",
  "Fungi": "#aec7e8",
  "Protista": "#17becf",

  // Animal phyla
  "Chordata": "#1f77b4",
  "Arthropoda": "#ff9896",
  "Mollusca": "#9467bd",
  "Nematoda": "#c5b0d5",

  // Vertebrate classes
  "Mammalia": "#8c564b",
  "Aves": "#c49c94",
  "Reptilia": "#e377c2",
  "Amphibia": "#f7b6d2",
  "Actinopterygii": "#7f7f7f",

  // News categories - vibrant, distinct colors
  "POLITICS": "#e41a1c",
  "POLITICS_cluster": "#e41a1c",
  "ENTERTAINMENT": "#377eb8",
  "ENTERTAINMENT_cluster": "#377eb8",
  "WELLNESS": "#4daf4a",
  "WELLNESS_cluster": "#4daf4a",
  "HEALTHY": "#98df8a",
  "HEALTHY_cluster": "#98df8a",
  "TRAVEL": "#ff7f00",
  "TRAVEL_cluster": "#ff7f00",
  "STYLE": "#984ea3",
  "STYLE_cluster": "#984ea3",
  "PARENTING": "#ffff33",
  "PARENTING_cluster": "#ffff33",
  "PARENTS": "#ffd92f",
  "PARENTS_cluster": "#ffd92f",
  "FOOD": "#a65628",
  "FOOD_cluster": "#a65628",
  "BUSINESS": "#f781bf",
  "BUSINESS_cluster": "#f781bf",
  "QUEER": "#17becf",
  "QUEER_cluster": "#17becf",
  "SPORTS": "#66c2a5",
  "SPORTS_cluster": "#66c2a5",
  "BLACK": "#fc8d62",
  "BLACK_cluster": "#fc8d62",
  "SCIENCE": "#8da0cb",
  "SCIENCE_cluster": "#8da0cb",
  "TECH": "#e78ac3",
  "TECH_cluster": "#e78ac3",
  "MONEY": "#a6d854",
  "MONEY_cluster": "#a6d854",
  "WEDDINGS": "#ff9896",
  "WEDDINGS_cluster": "#ff9896",
  "DIVORCE": "#9467bd",
  "DIVORCE_cluster": "#9467bd",
  "CRIME": "#c5b0d5",
  "CRIME_cluster": "#c5b0d5",
  "MEDIA": "#8c564b",
  "MEDIA_cluster": "#8c564b",
  "WEIRD": "#c49c94",
  "WEIRD_cluster": "#c49c94",
  "GREEN": "#2ca02c",
  "GREEN_cluster": "#2ca02c",
  "RELIGION": "#e377c2",
  "RELIGION_cluster": "#e377c2",
  "WORLDPOST": "#f7b6d2",
  "WORLDPOST_cluster": "#f7b6d2",
  "WORLD": "#7f7f7f",
  "WORLD_cluster": "#7f7f7f",
  "IMPACT": "#bcbd22",
  "IMPACT_cluster": "#bcbd22",
  "ARTS": "#aec7e8",
  "ARTS_cluster": "#aec7e8",
  "CULTURE": "#dbdb8d",
  "CULTURE_cluster": "#dbdb8d",
  "COMEDY": "#ff6347",
  "COMEDY_cluster": "#ff6347",
  "FIFTY": "#9edae5",
  "FIFTY_cluster": "#9edae5",
  "COLLEGE": "#ad494a",
  "COLLEGE_cluster": "#ad494a",
  "EDUCATION": "#8b4513",
  "EDUCATION_cluster": "#8b4513",
  "ENVIRONMENT": "#006400",
  "ENVIRONMENT_cluster": "#006400",
  "GOOD": "#ffa500",
  "GOOD_cluster": "#ffa500",
  "HOME": "#4b0082",
  "HOME_cluster": "#4b0082",
  "LATINO": "#ff1493",
  "LATINO_cluster": "#ff1493",
  "TASTE": "#daa520",
  "TASTE_cluster": "#daa520",
  "THE": "#b22222",
  "THE_cluster": "#b22222",
  "U.S.": "#191970",
  "U.S._cluster": "#191970",
  "WOMEN": "#ff69b4",
  "WOMEN_cluster": "#ff69b4",

  // Default colors for unlisted groups
  "_default": "#cccccc"
};

// Hierarchical color assignment based on taxonomic classification
export function assignTaxonomicColor(node) {
  if (!node.data || !node.data.name) return TAXONOMIC_COLORS._default;

  const name = node.data.name;

  // Check direct match first (exact match takes precedence)
  if (TAXONOMIC_COLORS[name]) {
    return TAXONOMIC_COLORS[name];
  }

  // For news categories, extract the primary category from the name
  // e.g., "POLITICS_WORLD_mixed" -> "POLITICS"
  // e.g., "WELLNESS_cluster_2" -> "WELLNESS"
  const newsMatch = name.match(/^([A-Z]+(?:_&_[A-Z]+)?)/);
  if (newsMatch) {
    const primaryCategory = newsMatch[1];
    if (TAXONOMIC_COLORS[primaryCategory]) {
      // For mixed nodes, use primary category (cleaner approach)
      if (name.includes('_mixed')) {
        return TAXONOMIC_COLORS[primaryCategory];
      }
      return TAXONOMIC_COLORS[primaryCategory];
    }
  }

  // Check for biological taxonomy patterns
  for (const [taxon, color] of Object.entries(TAXONOMIC_COLORS)) {
    if (name.toLowerCase().includes(taxon.toLowerCase()) ||
        taxon.toLowerCase().includes(name.toLowerCase())) {
      return color;
    }
  }

  // Check parent lineage for color inheritance
  let current = node;
  while (current.parent) {
    current = current.parent;
    if (current.data && current.data.name) {
      const parentName = current.data.name;
      // Try to get color from parent's primary category
      const parentMatch = parentName.match(/^([A-Z]+(?:_&_[A-Z]+)?)/);
      if (parentMatch && TAXONOMIC_COLORS[parentMatch[1]]) {
        return TAXONOMIC_COLORS[parentMatch[1]];
      }
      // Check biological taxonomy
      for (const [taxon, color] of Object.entries(TAXONOMIC_COLORS)) {
        if (parentName.toLowerCase().includes(taxon.toLowerCase()) ||
            taxon.toLowerCase().includes(parentName.toLowerCase())) {
          return color;
        }
      }
    }
  }

  // Modern fallback using beautiful categorical palettes
  return MODERN_PALETTES.extended[node.depth % MODERN_PALETTES.extended.length];
}

/**
 * Enhanced accessibility validation for modern color system
 * @param {d3.HierarchyNode} root - Tree root
 * @param {number} minContrast - Minimum contrast ratio (default: 3.0 for AA compliance)
 * @returns {Object} - Accessibility report
 */
export function validateAccessibility(root, minContrast = 3.0) {
  const issues = [];
  const validNodes = [];
  let totalNodes = 0;

  root.each(node => {
    totalNodes++;

    if (!node.color) {
      issues.push({
        node: node.data?.name || 'unknown',
        issue: 'missing_color',
        severity: 'high'
      });
      return;
    }

    // Check contrast with parent
    if (node.parent && node.parent.color) {
      const contrast = getColorContrast(node.color, node.parent.color);

      if (contrast < minContrast) {
        issues.push({
          node: node.data?.name || 'unknown',
          parent: node.parent.data?.name || 'unknown',
          issue: 'low_contrast',
          contrast: contrast.toFixed(2),
          required: minContrast,
          severity: contrast < 2.0 ? 'high' : 'medium'
        });
      } else {
        validNodes.push({
          node: node.data?.name || 'unknown',
          contrast: contrast.toFixed(2)
        });
      }
    }

    // Check contrast with white background (for text)
    const bgContrast = getColorContrast(node.color, '#ffffff');
    if (bgContrast < minContrast) {
      issues.push({
        node: node.data?.name || 'unknown',
        issue: 'low_bg_contrast',
        contrast: bgContrast.toFixed(2),
        required: minContrast,
        severity: bgContrast < 2.0 ? 'high' : 'medium'
      });
    }
  });

  const report = {
    totalNodes,
    validNodes: validNodes.length,
    issues: issues.length,
    compliance: issues.length === 0 ? 'AA' : issues.filter(i => i.severity === 'high').length === 0 ? 'Partial' : 'Non-compliant',
    details: {
      highSeverity: issues.filter(i => i.severity === 'high').length,
      mediumSeverity: issues.filter(i => i.severity === 'medium').length,
      averageContrast: validNodes.length > 0
        ? (validNodes.reduce((sum, n) => sum + parseFloat(n.contrast), 0) / validNodes.length).toFixed(2)
        : 0
    },
    issues: issues.slice(0, 10), // Top 10 issues for performance
    recommendations: generateAccessibilityRecommendations(issues)
  };

  console.log('♿ Accessibility Report:', report);
  return report;
}

/**
 * Generate accessibility recommendations based on issues
 * @param {Array} issues - Array of accessibility issues
 * @returns {Array} - Array of recommendations
 */
function generateAccessibilityRecommendations(issues) {
  const recommendations = [];

  const contrastIssues = issues.filter(i => i.issue === 'low_contrast').length;
  const bgIssues = issues.filter(i => i.issue === 'low_bg_contrast').length;

  if (contrastIssues > 0) {
    recommendations.push({
      type: 'contrast',
      message: `${contrastIssues} nodes have low contrast with their parents. Consider using a different palette or increasing color variation.`,
      action: 'switch_palette'
    });
  }

  if (bgIssues > 0) {
    recommendations.push({
      type: 'background',
      message: `${bgIssues} nodes have low contrast with white background. Consider adding text stroke or using darker colors.`,
      action: 'add_text_stroke'
    });
  }

  if (issues.filter(i => i.severity === 'high').length > 0) {
    recommendations.push({
      type: 'critical',
      message: 'Critical accessibility issues detected. Consider using high-contrast palettes like "vibrant" or custom adjustments.',
      action: 'use_high_contrast'
    });
  }

  return recommendations;
}

/**
 * Ensure sufficient color contrast between related nodes (Enhanced)
 * @param {Object} node - Tree node
 * @param {number} minContrast - Minimum contrast ratio
 * @param {boolean} autoFix - Whether to automatically fix issues
 */
function ensureColorContrast(node, minContrast = 3.0, autoFix = false) {
  if (!node.parent || !node.color || !node.parent.color) return;

  const contrast = getColorContrast(node.color, node.parent.color);

  if (contrast < minContrast && autoFix) {
    try {
      // More sophisticated contrast adjustment
      const hsl = d3.hsl(node.color);
      const parentHsl = d3.hsl(node.parent.color);

      // Calculate required lightness adjustment
      const targetContrast = minContrast * 1.1; // 10% buffer
      let adjustmentFactor = 0.1;

      // Iterative approach to find optimal contrast
      for (let i = 0; i < 10; i++) {
        if (parentHsl.l > 0.5) {
          // Parent is light, make child darker
          hsl.l = Math.max(0.15, hsl.l - adjustmentFactor);
        } else {
          // Parent is dark, make child lighter
          hsl.l = Math.min(0.85, hsl.l + adjustmentFactor);
        }

        const newContrast = getColorContrast(hsl.toString(), node.parent.color);
        if (newContrast >= targetContrast) {
          break;
        }

        adjustmentFactor += 0.05;
      }

      node.color = hsl.toString();
    } catch (error) {
      console.warn('Contrast adjustment failed for node:', node.data?.name, error);
    }
  }
}

// Assign colors to entire tree (Modern Group-Based Approach)
export function assignColorsToTree(root, paletteName = 'primary') {
  // Step 1: Identify major clades dynamically (generalized approach)
  identifyMajorClades(root, 2); // maxDepth = 2 for major groups

  // Step 2: Create modern group-based color scale
  const uniqueGroupIds = [...new Set([])];
  root.each(node => {
    if (node.data.groupId && !uniqueGroupIds.includes(node.data.groupId)) {
      uniqueGroupIds.push(node.data.groupId);
    }
  });

  console.log('🎨 Creating color scale for', uniqueGroupIds.length, 'groups:', uniqueGroupIds);

  // Create the modern color scale
  const groupColorScale = createGroupColorScale(uniqueGroupIds, paletteName);

  // Step 3: Assign colors with subtle within-group variation (Modern Approach)
  root.each(node => {
    // Use the new approach with subtle lightness variation
    if (node.data.groupId) {
      node.color = getNodeColorWithVariation(node, groupColorScale, root);
    } else {
      // Fallback to legacy system for backward compatibility
      node.color = assignTaxonomicColor(node);
    }
  });

  // Third pass: final contrast validation for all nodes
  root.each(node => {
    if (node.parent) {
      ensureColorContrast(node);
    }
  });

  return root;
}

// Generate color scale for specific dataset
export function createColorScale(root) {
  const domains = [];
  const ranges = [];

  // Collect unique taxonomic groups and their colors
  const colorMap = new Map();

  root.each(node => {
    if (node.data && node.data.name && node.color) {
      const name = node.data.name.split("_")[0]; // Get genus/family level
      if (!colorMap.has(name)) {
        colorMap.set(name, node.color);
        domains.push(name);
        ranges.push(node.color);
      }
    }
  });

  // Create ordinal scale
  return d3.scaleOrdinal()
    .domain(domains)
    .range(ranges)
    .unknown(TAXONOMIC_COLORS._default);
}

// Get color for a specific node (Enhanced with Modern Group-Based Approach)
export function getNodeColor(node, depthColorGroups = 3, groupColorScale = null, root = null) {
  // Use pre-assigned color if available (highest priority)
  if (node.color) return node.color;

  // Try modern group-based approach if scale and root are provided
  if (groupColorScale && root && node.data?.groupId) {
    return getNodeColorWithVariation(node, groupColorScale, root);
  }

  // Fallback to legacy depth-based approach
  if (node.depth > depthColorGroups) {
    let ancestor = node;
    while (ancestor.depth > depthColorGroups && ancestor.parent) {
      ancestor = ancestor.parent;
    }
    return ancestor.color || assignTaxonomicColor(ancestor);
  }

  return assignTaxonomicColor(node);
}

// Create legend data (Modern Group-Based)
export function createLegendData(root) {
  const legendItems = new Map();

  root.each(node => {
    if (node.depth <= 2 && node.data) {
      // Use groupId for modern approach, fallback to name-based for legacy
      const key = node.data.groupId || node.data.name?.split("_")[0] || 'unknown';

      if (!legendItems.has(key) && node.color) {
        // For group-based, use representative name or stats
        const displayName = root.groupStats?.find(g => g.id === key)?.representative
                           || node.data.name?.split("_")[0]
                           || key;

        legendItems.set(key, {
          name: displayName,
          groupId: node.data.groupId,
          color: node.color,
          count: 0
        });
      }
      if (legendItems.has(key)) {
        legendItems.get(key).count++;
      }
    }
  });

  // Sort by count and return top items
  return Array.from(legendItems.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 15); // Top 15 groups
}

// Export palette information for UI controls
export function getAvailablePalettes() {
  return {
    palettes: Object.keys(MODERN_PALETTES),
    current: 'primary',
    preview: Object.fromEntries(
      Object.entries(MODERN_PALETTES).map(([name, colors]) => [
        name,
        Array.isArray(colors) ? colors.slice(0, 5) : []
      ])
    )
  };
}

/**
 * Test and report palette visibility against white background
 * @param {string} paletteName - Name of palette to test
 * @returns {Object} - Visibility report
 */
export function testPaletteVisibility(paletteName = 'primary') {
  const palette = MODERN_PALETTES[paletteName];
  if (!palette) {
    return { error: `Palette '${paletteName}' not found` };
  }

  const results = palette.map((color, index) => {
    const contrast = getColorContrast(color, '#ffffff');
    const isVisible = contrast >= 3.0;

    return {
      index,
      color,
      contrast: contrast.toFixed(2),
      isVisible,
      rating: contrast >= 4.5 ? 'AAA' : contrast >= 3.0 ? 'AA' : 'FAIL'
    };
  });

  const summary = {
    paletteName,
    totalColors: results.length,
    visibleColors: results.filter(r => r.isVisible).length,
    failedColors: results.filter(r => !r.isVisible).length,
    averageContrast: (results.reduce((sum, r) => sum + parseFloat(r.contrast), 0) / results.length).toFixed(2),
    rating: results.every(r => r.contrast >= 4.5) ? 'AAA' :
            results.every(r => r.contrast >= 3.0) ? 'AA' : 'Partial'
  };

  console.log(`🔍 Palette Visibility Test: ${paletteName}`);
  console.log(`📊 Results: ${summary.visibleColors}/${summary.totalColors} colors visible (${summary.rating})`);
  console.log(`📈 Average contrast: ${summary.averageContrast}`);

  if (summary.failedColors > 0) {
    const failed = results.filter(r => !r.isVisible);
    console.warn(`⚠️ Failed colors:`, failed.map(f => `${f.color} (${f.contrast})`));
  }

  return {
    summary,
    details: results,
    recommendations: summary.failedColors > 0 ?
      ['Consider using "vibrant" or "qualitative" palette for better visibility'] :
      ['Palette meets visibility requirements']
  };
}

/**
 * Create SVG pattern definitions for mixed nodes
 * @param {Object} svg - D3 SVG selection
 * @param {Array} mixedNodes - Array of nodes with pattern info
 * @returns {Object} - Pattern definitions and utilities
 */
export function createSVGPatterns(svg, mixedNodes) {
  if (!svg || !mixedNodes || mixedNodes.length === 0) {
    return { patterns: [], getPatternId: () => null };
  }

  // Create a defs section if it doesn't exist
  let defs = svg.select('defs');
  if (defs.empty()) {
    defs = svg.append('defs');
  }

  const patterns = [];
  const patternMap = new Map();

  mixedNodes.forEach((node, index) => {
    if (!node.patternInfo) return;

    const { primary, secondary, categories } = node.patternInfo;
    const patternId = `mixed-pattern-${categories.join('-')}-${index}`;

    // Avoid duplicate patterns
    if (patternMap.has(patternId)) return;

    // Create striped pattern
    const pattern = defs.append('pattern')
      .attr('id', patternId)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 8)
      .attr('height', 8)
      .attr('patternTransform', 'rotate(45)');

    // Primary color background
    pattern.append('rect')
      .attr('width', 8)
      .attr('height', 8)
      .attr('fill', primary);

    // Secondary color stripes
    if (secondary) {
      pattern.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 4)
        .attr('height', 8)
        .attr('fill', secondary);
    }

    patternMap.set(patternId, {
      id: patternId,
      primary,
      secondary,
      categories
    });

    patterns.push({
      id: patternId,
      primary,
      secondary,
      categories,
      node
    });
  });

  return {
    patterns,
    getPatternId: (node) => {
      if (!node.patternInfo) return null;
      const key = Array.from(patternMap.keys()).find(k =>
        k.includes(node.patternInfo.categories.join('-'))
      );
      return key ? `url(#${key})` : null;
    },
    patternMap
  };
}

/**
 * Enhanced node color function with pattern support
 * @param {Object} node - Tree node
 * @param {Function} groupColorScale - Color scale
 * @param {d3.HierarchyNode} root - Tree root
 * @param {Object} patternSystem - Pattern system from createSVGPatterns
 * @returns {Object} - Color and pattern information
 */
export function getNodeColorAndPattern(node, groupColorScale, root, patternSystem = null) {
  const color = getNodeColorWithVariation(node, groupColorScale, root);

  // Check if this node should use a pattern
  if (patternSystem && node.patternInfo) {
    const patternId = patternSystem.getPatternId(node);
    if (patternId) {
      return {
        fill: patternId,
        solidColor: color,
        isPattern: true,
        patternInfo: node.patternInfo
      };
    }
  }

  return {
    fill: color,
    solidColor: color,
    isPattern: false,
    patternInfo: null
  };
}

/**
 * Utility function to create a complete color system for a tree
 * Combines all the modern approaches: group identification + modern palettes + subtle variation
 * @param {d3.HierarchyNode} root - The tree root
 * @param {string} paletteName - Palette to use ('primary', 'vibrant', etc.)
 * @param {number} maxDepth - Max depth for group identification
 * @returns {Object} - Complete color system with scales and utilities
 */
export function createTreeColorSystem(root, paletteName = 'primary', maxDepth = 2) {
  // Step 1: Identify groups
  identifyMajorClades(root, maxDepth);

  // Step 2: Create color scale
  const uniqueGroupIds = [...new Set([])];
  root.each(node => {
    if (node.data.groupId && !uniqueGroupIds.includes(node.data.groupId)) {
      uniqueGroupIds.push(node.data.groupId);
    }
  });

  const groupColorScale = createGroupColorScale(uniqueGroupIds, paletteName);

  // Step 3: Apply colors to all nodes
  root.each(node => {
    if (node.data.groupId) {
      node.color = getNodeColorWithVariation(node, groupColorScale, root);
    } else {
      node.color = assignTaxonomicColor(node);
    }
  });

  console.log(`🎨 Created complete color system: ${uniqueGroupIds.length} groups with '${paletteName}' palette`);

  // Test palette visibility
  const visibilityReport = testPaletteVisibility(paletteName);
  console.log(`👁️ Visibility: ${visibilityReport.summary.visibleColors}/${visibilityReport.summary.totalColors} colors visible (${visibilityReport.summary.rating})`);

  // Collect mixed nodes for pattern system
  const mixedNodes = [];
  root.each(node => {
    if (node.patternInfo) {
      mixedNodes.push(node);
    }
  });

  // Validate accessibility
  const accessibilityReport = validateAccessibility(root, 3.0);

  console.log(`♿ Accessibility: ${accessibilityReport.compliance} (${accessibilityReport.validNodes}/${accessibilityReport.totalNodes} nodes pass)`);

  // Return the complete system for external use
  return {
    groupColorScale,
    uniqueGroupIds,
    paletteName,
    mixedNodes,
    accessibilityReport,
    getColor: (node) => getNodeColorWithVariation(node, groupColorScale, root),
    getColorAndPattern: (node, patternSystem) => getNodeColorAndPattern(node, groupColorScale, root, patternSystem),
    createPatterns: (svg) => createSVGPatterns(svg, mixedNodes),
    validateAccessibility: () => validateAccessibility(root, 3.0),
    legendData: createLegendData(root),
    groupStats: root.groupStats
  };
}

/**
 * Enhanced selection and highlight system compatible with new color approach
 * @param {Object} node - Selected node
 * @param {Array} pathNodes - Nodes in the path to root
 * @param {string} selectionColor - Color for selected elements
 * @returns {Object} - Selection styling information
 */
export function createSelectionStyles(node, pathNodes = [], selectionColor = '#dc2626') {
  const pathNodeIds = new Set(pathNodes.map(n => n.data?.name || n.id));

  return {
    // Selection styles
    selectedNode: {
      stroke: selectionColor,
      strokeWidth: 3,
      strokeOpacity: 1
    },

    // Path highlighting
    pathNode: {
      opacity: 1,
      stroke: selectionColor,
      strokeWidth: 1.5,
      strokeOpacity: 0.6
    },

    // Non-selected elements
    nonSelectedNode: {
      opacity: 0.3,
      stroke: '#ffffff',
      strokeWidth: 1,
      strokeOpacity: 0.8
    },

    nonSelectedLink: {
      opacity: 0.2,
      strokeOpacity: 0.2
    },

    // Helper function to get appropriate style
    getNodeStyle: (targetNode) => {
      const nodeId = targetNode.data?.name || targetNode.id;

      if (nodeId === (node.data?.name || node.id)) {
        return 'selectedNode';
      }

      if (pathNodeIds.has(nodeId)) {
        return 'pathNode';
      }

      return 'nonSelectedNode';
    },

    // Check if node is in selection context
    isInSelection: (targetNode) => {
      const nodeId = targetNode.data?.name || targetNode.id;
      return nodeId === (node.data?.name || node.id) || pathNodeIds.has(nodeId);
    }
  };
}

/**
 * Apply modern selection styles to D3 selections
 * @param {Object} nodeSelection - D3 selection of nodes
 * @param {Object} linkSelection - D3 selection of links
 * @param {Object} selectionStyles - Styles from createSelectionStyles
 */
export function applySelectionStyles(nodeSelection, linkSelection, selectionStyles) {
  if (!nodeSelection || !selectionStyles) return;

  // Apply node styles
  nodeSelection.each(function(d) {
    const element = d3.select(this);
    const styleType = selectionStyles.getNodeStyle(d);
    const style = selectionStyles[styleType];

    // Apply the appropriate style
    Object.entries(style).forEach(([attr, value]) => {
      element.attr(attr, value);
    });
  });

  // Apply link styles
  if (linkSelection) {
    linkSelection.each(function(d) {
      const element = d3.select(this);
      const isInSelection = selectionStyles.isInSelection(d.target);

      if (isInSelection) {
        element.attr('opacity', 1);
      } else {
        element.attr('opacity', selectionStyles.nonSelectedLink.opacity);
      }
    });
  }
}