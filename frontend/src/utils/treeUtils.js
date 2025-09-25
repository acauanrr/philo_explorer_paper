import * as d3 from 'd3';

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';
const PIPELINE_ENDPOINT = `${BACKEND_BASE_URL}/api/v1/pipeline/full`;
const TREE_RECON_ENDPOINT = `${BACKEND_BASE_URL}/api/v1/tree/reconstruct`;

const fallbackId = (value, idx) => {
  if (!value) {
    return `item-${idx + 1}`;
  }
  return value
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || `item-${idx + 1}`;
};

const normalizeLabel = (value) => (value ?? '').toString().trim();

const buildStableId = (item, index) => {
  if (!item) return `item-${index + 1}`;
  if (item.external_id) return item.external_id.toString();
  if (item.id) return item.id.toString();
  if (item.guid) return item.guid.toString();
  if (item.slug) return item.slug.toString();
  if (item.title) return fallbackId(item.title, index);
  return `item-${index + 1}`;
};

const extractItemText = (item) => {
  if (!item) return '';
  const rawParts = [
    item.content,
    item.summary,
    item.short_description,
    item.description,
    item.text,
    item.title
  ];

  const parts = rawParts.flatMap((segment) => {
    if (!segment) return [];
    if (Array.isArray(segment)) {
      return segment.filter((value) => typeof value === 'string');
    }
    if (typeof segment === 'string') {
      return [segment];
    }
    return [];
  });

  return parts
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join('\n\n');
};

const buildDatasetLookup = (dataset = []) => {
  const byId = new Map();
  dataset.forEach((item, index) => {
    const id = buildStableId(item, index);
    const normalized = normalizeLabel(id);
    if (!byId.has(normalized)) {
      byId.set(normalized, { item, index, id });
    }
  });
  return { byId };
};

export const calculateDistanceMatrix = async (dataset, options = {}) => {
  if (!Array.isArray(dataset) || dataset.length === 0) {
    return null;
  }

  const { preprocess = true, distanceMetric = 'cosine' } = options;
  const documents = dataset.map((item, index) => ({
    id: buildStableId(item, index),
    content: extractItemText(item) || (item?.title ? String(item.title) : '') || `Document ${index + 1}`,
    metadata: {
      title: item?.title ?? null,
      category: item?.category ?? item?.topic ?? null,
      published_at: item?.published_at ?? item?.date ?? null,
      source: item?.source ?? item?.url ?? null
    }
  }));

  let response;
  try {
    response = await fetch(PIPELINE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        documents,
        preprocess,
        distance_metric: distanceMetric,
        algorithm: 'neighbor_joining'
      })
    });
  } catch (error) {
    throw new Error(`Failed to reach backend pipeline at ${PIPELINE_ENDPOINT}: ${error.message}`);
  }

  if (!response.ok) {
    const message = `Failed to compute embedding distances (${response.status})`;
    throw new Error(message);
  }

  const pipeline = await response.json();

  return {
    matrix: pipeline.distance_matrix ?? [],
    labels: pipeline.labels ?? documents.map((doc) => doc.id),
    articles: dataset,
    pipeline
  };
};

export const fetchNeighborJoiningTree = async (distanceData, currentDataset = []) => {
  if (!distanceData) return null;

  const dataset = Array.isArray(currentDataset) ? currentDataset : [];
  const { byId } = buildDatasetLookup(dataset);

  let treeStructure = distanceData?.pipeline?.tree_structure;
  let statistics = distanceData?.pipeline?.statistics ?? null;
  let newick = distanceData?.pipeline?.newick ?? null;
  let labels = distanceData?.pipeline?.labels ?? distanceData?.labels ?? [];

  if (!treeStructure) {
    let response;
    try {
      response = await fetch(TREE_RECON_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          distance_matrix: distanceData.matrix,
          labels: distanceData.labels
        })
      });
    } catch (error) {
      throw new Error(`Failed to reach tree reconstruction endpoint at ${TREE_RECON_ENDPOINT}: ${error.message}`);
    }

    if (!response.ok) {
      const message = `Failed to reconstruct tree (${response.status})`;
      throw new Error(message);
    }

    const result = await response.json();
    treeStructure = result.tree_structure;
    statistics = result.statistics ?? statistics;
    newick = result.newick ?? newick;
    labels = distanceData.labels ?? labels;
  }

  if (!treeStructure) {
    throw new Error('Tree structure unavailable');
  }

  const parseNJTree = (node) => {
    const nodeLabel = node.label ?? node.id ?? null;
    const normalized = normalizeLabel(nodeLabel);
    const datasetEntry = byId.get(normalized);

    const displayName = datasetEntry?.item?.title
      ?? datasetEntry?.item?.headline
      ?? nodeLabel
      ?? datasetEntry?.id;

    const stableId = datasetEntry?.id ?? (nodeLabel ? String(nodeLabel) : displayName);
    const branchLength = node.length ?? node.distance ?? node.branch_length ?? 0;

    const d3Node = {
      name: stableId,
      id: stableId,
      displayName,
      distance: branchLength,
      length: branchLength,
      category: datasetEntry?.item?.category ?? datasetEntry?.item?.topic ?? null,
      error: 0,
      qualityScore: 0,
      article: datasetEntry?.item ?? null,
      publishedAt: datasetEntry?.item?.published_at ?? datasetEntry?.item?.date ?? null,
      source: datasetEntry?.item?.source ?? datasetEntry?.item?.url ?? null
    };

    if (node.children && node.children.length > 0) {
      d3Node.children = node.children.map(parseNJTree);
    }

    return d3Node;
  };

  const treeRoot = parseNJTree(treeStructure);

  return {
    root: treeRoot,
    statistics,
    newick,
    distanceMatrix: distanceData.matrix,
    labels,
    articles: distanceData.articles,
    pipeline: distanceData.pipeline
  };
};

const collectLeafMetadata = (root) => {
  const leaves = [];
  const leafMap = new Map();

  const traverse = (node, ancestors = [], distanceFromRoot = 0) => {
    const nodeLength = node.length ?? node.distance ?? 0;
    const currentDistance = ancestors.length === 0 ? 0 : distanceFromRoot;
    const nextAncestors = ancestors.concat([{
      node,
      distanceFromRoot: currentDistance
    }]);

    if (!node.children || node.children.length === 0) {
      const leafInfo = {
        node,
        id: node.id,
        name: node.name,
        distanceFromRoot: currentDistance,
        ancestors: nextAncestors
      };
      leaves.push(leafInfo);
      leafMap.set(normalizeLabel(node.name || node.id), leafInfo);
      return;
    }

    node.children.forEach((child) => {
      const childLength = child.length ?? child.distance ?? 0;
      traverse(child, nextAncestors, currentDistance + childLength);
    });
  };

  traverse(root, [], 0);

  return { leaves, leafMap };
};

const computeLeafPairDistance = (leafA, leafB) => {
  const ancestorsA = leafA.ancestors;
  const ancestorsB = leafB.ancestors;
  const maxDepth = Math.min(ancestorsA.length, ancestorsB.length);

  let lcaDistance = 0;
  for (let k = 0; k < maxDepth; k += 1) {
    if (ancestorsA[k].node === ancestorsB[k].node) {
      lcaDistance = ancestorsA[k].distanceFromRoot;
    } else {
      break;
    }
  }

  return Math.max(0, leafA.distanceFromRoot + leafB.distanceFromRoot - 2 * lcaDistance);
};

export const computeTreeLeafDistanceMatrix = (root, orderedLabels = null) => {
  if (!root) {
    return { matrix: [], labels: [], leaves: [] };
  }

  const { leaves, leafMap } = collectLeafMetadata(root);

  let orderedLeaves = leaves;
  let labels = leaves.map((leaf) => leaf.name);

  if (Array.isArray(orderedLabels) && orderedLabels.length) {
    const temp = [];
    orderedLabels.forEach((label) => {
      const normalized = normalizeLabel(label);
      const leaf = leafMap.get(normalized);
      if (leaf) {
        temp.push(leaf);
      }
    });
    if (temp.length === leaves.length) {
      orderedLeaves = temp;
      labels = orderedLabels.slice();
    }
  }

  const n = orderedLeaves.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));

  for (let i = 0; i < n; i += 1) {
    matrix[i][i] = 0;
    for (let j = i + 1; j < n; j += 1) {
      const distance = computeLeafPairDistance(orderedLeaves[i], orderedLeaves[j]);
      matrix[i][j] = distance;
      matrix[j][i] = distance;
    }
  }

  return { matrix, labels, leaves: orderedLeaves };
};

// Helper functions for tree visualization
export const setRadius = (d, y0, k) => {
  d.radius = (y0 += d.data.length || 0) * k;
  if (d.children) d.children.forEach(child => setRadius(child, y0, k));
};

export const maxLength = (d) => {
  return (d.data.length || 0) + (d.children ? d3.max(d.children, maxLength) : 0);
};

export const linkStep = (startAngle, startRadius, endAngle, endRadius) => {
  const c0 = Math.cos(startAngle = (startAngle - 90) / 180 * Math.PI);
  const s0 = Math.sin(startAngle);
  const c1 = Math.cos(endAngle = (endAngle - 90) / 180 * Math.PI);
  const s1 = Math.sin(endAngle);
  return "M" + startRadius * c0 + "," + startRadius * s0
      + (endAngle === startAngle ? "" : "A" + startRadius + "," + startRadius + " 0 0 " + (endAngle > startAngle ? 1 : 0) + " " + startRadius * c1 + "," + startRadius * s1)
      + "L" + endRadius * c1 + "," + endRadius * s1;
};

// Create cluster layout for tree
export const createTreeLayout = (root, width, height) => {
  const outerRadius = Math.min(width, height) / 2;
  const innerRadius = outerRadius - 170;

  const cluster = d3.cluster()
    .size([360, innerRadius])
    .separation((a, b) => 1);

  cluster(root);
  setRadius(root, root.data.length = 0, innerRadius / maxLength(root));

  return { outerRadius, innerRadius, cluster };
};

// Color scales for different visualization modes
export const createColorScales = () => {
  const categoryColor = d3.scaleOrdinal()
    .domain(["POLITICS", "WELLNESS", "TRAVEL", "BUSINESS", "TECH", "SCIENCE",
             "ENTERTAINMENT", "SPORTS", "EDUCATION", "WORLD", "FOOD & DRINK",
             "STYLE & BEAUTY", "PARENTING", "HOME & LIVING", "CRIME"])
    .range(d3.schemeTableau10);

  const errorColor = d3.scaleSequential(d3.interpolateRdYlGn)
    .domain([0.5, 0]);

  const qualityColor = d3.scaleSequential(d3.interpolateViridis)
    .domain([0, 1]);

  return { categoryColor, errorColor, qualityColor };
};
