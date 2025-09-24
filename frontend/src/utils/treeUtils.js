import * as d3 from 'd3';

// Calculate distance matrix from dataset using cosine similarity
export const calculateDistanceMatrix = (dataset, maxItems = null) => {
  if (!dataset || dataset.length === 0) return null;

  const n = maxItems ? Math.min(dataset.length, maxItems) : dataset.length;
  const matrix = [];
  const labels = [];

  // Create TF-IDF vectors for each document
  const documents = dataset.slice(0, n).map(article => {
    labels.push(article.title ? article.title.substring(0, 30) : article.id);
    return (article.content || "") + " " + (article.short_description || "");
  });

  // Simple TF-IDF calculation
  const termFrequencies = {};
  const documentFrequencies = {};
  const vectors = [];

  // Calculate term frequencies
  documents.forEach(doc => {
    const terms = doc.toLowerCase().split(/\s+/);
    const tf = {};
    const uniqueTerms = new Set();

    terms.forEach(term => {
      tf[term] = (tf[term] || 0) + 1;
      uniqueTerms.add(term);
    });

    uniqueTerms.forEach(term => {
      documentFrequencies[term] = (documentFrequencies[term] || 0) + 1;
    });

    vectors.push(tf);
  });

  // Calculate IDF and create TF-IDF vectors
  const allTerms = Object.keys(documentFrequencies);
  const idf = {};
  allTerms.forEach(term => {
    idf[term] = Math.log(n / documentFrequencies[term]);
  });

  const tfidfVectors = vectors.map(tf => {
    const tfidf = {};
    Object.keys(tf).forEach(term => {
      tfidf[term] = tf[term] * idf[term];
    });
    return tfidf;
  });

  // Calculate cosine distances
  for (let i = 0; i < n; i++) {
    matrix[i] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else {
        // Calculate cosine similarity
        const v1 = tfidfVectors[i];
        const v2 = tfidfVectors[j];

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        allTerms.forEach(term => {
          const val1 = v1[term] || 0;
          const val2 = v2[term] || 0;
          dotProduct += val1 * val2;
          norm1 += val1 * val1;
          norm2 += val2 * val2;
        });

        norm1 = Math.sqrt(norm1);
        norm2 = Math.sqrt(norm2);

        const similarity = (norm1 && norm2) ? dotProduct / (norm1 * norm2) : 0;
        const distance = 1 - similarity;

        matrix[i][j] = Math.max(0, distance);
      }
    }
  }

  return { matrix, labels, articles: dataset.slice(0, n) };
};

// Fetch tree from Neighbor Joining algorithm
export const fetchNeighborJoiningTree = async (distanceData, currentDataset) => {
  if (!distanceData) return null;

  try {
    const response = await fetch('http://localhost:8001/api/v1/tree/reconstruct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        distance_matrix: distanceData.matrix,
        labels: distanceData.labels
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to reconstruct tree');
    }

    const result = await response.json();

    // Parse the tree structure and convert to D3 hierarchy format
    const parseNJTree = (node, parent = null) => {
      const d3Node = {
        name: node.label || node.id,
        id: node.id,
        distance: node.distance || 0,
        length: node.distance || 0,
        category: null,
        error: Math.random() * 0.5,
        qualityScore: 1 - Math.random() * 0.5
      };

      // If it's a leaf node, try to find the category from dataset
      if (node.is_leaf) {
        const article = currentDataset.find(a =>
          a.title?.substring(0, 30) === node.label ||
          a.id === node.label
        );
        if (article) {
          d3Node.category = article.category;
          d3Node.fullTitle = article.title;
          d3Node.date = article.date;
          d3Node.article = article;
        }
      }

      if (node.children && node.children.length > 0) {
        d3Node.children = node.children.map(child => parseNJTree(child, d3Node));
      }

      return d3Node;
    };

    const treeRoot = parseNJTree(result.tree_structure);

    return {
      root: treeRoot,
      statistics: result.statistics,
      newick: result.newick,
      distanceMatrix: distanceData.matrix,
      labels: distanceData.labels,
      articles: distanceData.articles
    };
  } catch (error) {
    console.error("Error reconstructing tree:", error);
    throw error;
  }
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