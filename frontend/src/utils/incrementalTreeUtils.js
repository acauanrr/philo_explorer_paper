import * as d3 from 'd3';
import { calculateDistanceMatrix, fetchNeighborJoiningTree } from './treeUtils';

/**
 * Identifies differences between two datasets
 * @param {Array} dataset1 - First dataset (T1)
 * @param {Array} dataset2 - Second dataset (T2)
 * @returns {Object} Analysis of differences
 */
export const analyzeDatasetDifferences = (dataset1, dataset2) => {
  if (!dataset1 || !dataset2) {
    return {
      type: 'invalid',
      added: [],
      removed: [],
      modified: [],
      unchanged: []
    };
  }

  // Create maps for efficient lookup
  const map1 = new Map();
  const map2 = new Map();

  // Map by ID and store content hash for comparison
  dataset1.forEach(item => {
    const contentHash = generateContentHash(item);
    map1.set(item.id, { item, contentHash });
  });

  dataset2.forEach(item => {
    const contentHash = generateContentHash(item);
    map2.set(item.id, { item, contentHash });
  });

  const added = [];
  const removed = [];
  const modified = [];
  const unchanged = [];

  // Find removed and unchanged/modified nodes
  map1.forEach((value, id) => {
    if (!map2.has(id)) {
      removed.push(value.item);
    } else {
      const item2 = map2.get(id);
      if (value.contentHash === item2.contentHash) {
        unchanged.push(value.item);
      } else {
        modified.push({
          old: value.item,
          new: item2.item,
          contentChanged: true
        });
      }
    }
  });

  // Find added nodes
  map2.forEach((value, id) => {
    if (!map1.has(id)) {
      added.push(value.item);
    }
  });

  // Determine the type of change
  let type = 'same';
  if (added.length > 0 && removed.length === 0) {
    type = 'addition';
  } else if (removed.length > 0 && added.length === 0) {
    type = 'removal';
  } else if (added.length > 0 && removed.length > 0) {
    type = 'mixed';
  } else if (modified.length > 0) {
    type = 'modification';
  }

  return {
    type,
    added,
    removed,
    modified,
    unchanged,
    summary: {
      totalT1: dataset1.length,
      totalT2: dataset2.length,
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      unchangedCount: unchanged.length
    }
  };
};

/**
 * Generate a hash of the content for comparison
 */
const generateContentHash = (item) => {
  const content = `${item.content || ''}${item.short_description || ''}${item.title || ''}`;
  // Simple hash function for content comparison
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
};

/**
 * Constructs T2 tree incrementally from T1 tree based on dataset changes
 * @param {Object} treeT1 - Original tree structure
 * @param {Array} datasetT1 - Original dataset
 * @param {Array} datasetT2 - New dataset
 * @returns {Object} New tree structure (T2)
 */
export const constructIncrementalTree = async (treeT1, datasetT1, datasetT2) => {
  const differences = analyzeDatasetDifferences(datasetT1, datasetT2);

  console.log('Dataset differences:', differences);

  // Handle different types of changes
  switch (differences.type) {
    case 'same':
      // No changes, return original tree
      return {
        root: treeT1.root,
        changeType: 'none',
        changes: differences
      };

    case 'addition':
      // Add new nodes to the existing tree
      return await addNodesToTree(treeT1, datasetT1, datasetT2, differences.added);

    case 'removal':
      // Remove nodes from the existing tree
      return removeNodesFromTree(treeT1, differences.removed);

    case 'modification':
      // Update existing nodes with new content
      return await updateTreeWithModifications(treeT1, datasetT1, datasetT2, differences.modified);

    case 'mixed':
      // Handle both additions and removals
      return await handleMixedChanges(treeT1, datasetT1, datasetT2, differences);

    default:
      // Fallback: rebuild entire tree
      return await rebuildEntireTree(datasetT2);
  }
};

/**
 * Add new nodes to existing tree structure
 */
const addNodesToTree = async (treeT1, datasetT1, datasetT2, newNodes) => {
  // Clone the original tree
  const newTree = JSON.parse(JSON.stringify(treeT1.root));

  // Calculate distance matrix for the combined dataset
  const combinedDataset = [...datasetT1, ...newNodes];
  const distanceData = await calculateDistanceMatrix(combinedDataset);

  // For each new node, find its optimal position in the tree
  for (const newNode of newNodes) {
    const position = findOptimalPosition(newTree, newNode, distanceData, combinedDataset);
    insertNodeAtPosition(newTree, newNode, position);
  }

  return {
    root: newTree,
    changeType: 'addition',
    changes: {
      added: newNodes,
      removed: [],
      modified: []
    }
  };
};

/**
 * Remove nodes from tree structure
 */
const removeNodesFromTree = (treeT1, nodesToRemove) => {
  // Clone the original tree
  const newTree = JSON.parse(JSON.stringify(treeT1.root));

  // Create a set of IDs to remove for efficient lookup
  const removeIds = new Set(nodesToRemove.map(n => n.id));

  // Recursively remove nodes
  const removeFromSubtree = (node) => {
    if (!node.children) {
      // Leaf node - check if it should be removed
      return !removeIds.has(node.id);
    }

    // Internal node - filter children
    node.children = node.children.filter(child => {
      const keep = removeFromSubtree(child);
      if (!keep && child.children && child.children.length > 0) {
        // If removing an internal node, promote its children
        node.children = [...node.children, ...child.children];
        return false;
      }
      return keep;
    });

    // If internal node has no children left, remove it
    return node.children.length > 0;
  };

  removeFromSubtree(newTree);

  return {
    root: newTree,
    changeType: 'removal',
    changes: {
      added: [],
      removed: nodesToRemove,
      modified: []
    }
  };
};

/**
 * Update tree with content modifications
 */
const updateTreeWithModifications = async (treeT1, datasetT1, datasetT2, modifications) => {
  // Clone the original tree
  const newTree = JSON.parse(JSON.stringify(treeT1.root));

  // Recalculate distance matrix with updated content
  const distanceData = await calculateDistanceMatrix(datasetT2);

  // Update node positions based on new distances
  const updateNodeContent = (node) => {
    if (!node.children) {
      // Check if this node was modified
      const mod = modifications.find(m => m.old.id === node.id);
      if (mod) {
        // Update node with new content
        node.name = mod.new.title ? mod.new.title.substring(0, 30) : mod.new.id;
        node.content = mod.new.content;
        node.category = mod.new.category;
        node.modified = true;
      }
    } else {
      // Recursively update children
      node.children.forEach(updateNodeContent);
    }
  };

  updateNodeContent(newTree);

  // Recalculate tree structure based on new distances
  const treeResult = await fetchNeighborJoiningTree(distanceData, datasetT2);

  return {
    root: treeResult.root,
    changeType: 'modification',
    changes: {
      added: [],
      removed: [],
      modified: modifications
    }
  };
};

/**
 * Handle mixed changes (additions and removals)
 */
const handleMixedChanges = async (treeT1, datasetT1, datasetT2, differences) => {
  // First remove nodes
  let intermediateTree = removeNodesFromTree(treeT1, differences.removed);

  // Create intermediate dataset without removed nodes
  const removeIds = new Set(differences.removed.map(n => n.id));
  const intermediateDataset = datasetT1.filter(item => !removeIds.has(item.id));

  // Then add new nodes
  const finalTree = await addNodesToTree(
    { root: intermediateTree.root },
    intermediateDataset,
    datasetT2,
    differences.added
  );

  return {
    root: finalTree.root,
    changeType: 'mixed',
    changes: {
      added: differences.added,
      removed: differences.removed,
      modified: differences.modified
    }
  };
};

/**
 * Rebuild entire tree when changes are too complex
 */
const rebuildEntireTree = async (dataset) => {
  const distanceData = await calculateDistanceMatrix(dataset);
  const treeResult = await fetchNeighborJoiningTree(distanceData, dataset);

  return {
    root: treeResult.root,
    changeType: 'rebuild',
    changes: {
      added: [],
      removed: [],
      modified: []
    }
  };
};

/**
 * Find optimal position for a new node in the tree
 */
const findOptimalPosition = (tree, newNode, distanceMatrix, dataset) => {
  // Find the index of the new node in the dataset
  const newNodeIndex = dataset.findIndex(item => item.id === newNode.id);

  if (newNodeIndex === -1) return null;

  // Find the closest existing node based on distance matrix
  let minDistance = Infinity;
  let closestNode = null;

  const findClosest = (node) => {
    if (!node.children) {
      // Leaf node - check distance
      const nodeIndex = dataset.findIndex(item =>
        item.title?.substring(0, 30) === node.name || item.id === node.name
      );

      if (nodeIndex !== -1 && distanceMatrix[newNodeIndex] && distanceMatrix[newNodeIndex][nodeIndex] !== undefined) {
        const distance = distanceMatrix[newNodeIndex][nodeIndex];
        if (distance < minDistance) {
          minDistance = distance;
          closestNode = node;
        }
      }
    } else {
      // Internal node - check children
      node.children.forEach(findClosest);
    }
  };

  findClosest(tree);

  return {
    closestNode,
    distance: minDistance
  };
};

/**
 * Insert a node at the specified position in the tree
 */
const insertNodeAtPosition = (tree, newNode, position) => {
  if (!position || !position.closestNode) {
    // If no position found, add as a new branch at root
    if (!tree.children) {
      tree.children = [];
    }
    tree.children.push({
      name: newNode.title ? newNode.title.substring(0, 30) : newNode.id,
      id: newNode.id,
      category: newNode.category,
      distance: position ? position.distance : 0,
      added: true
    });
    return;
  }

  // Find parent of closest node and insert new node as sibling
  const findAndInsert = (node) => {
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        if (node.children[i] === position.closestNode ||
            node.children[i].id === position.closestNode.id) {
          // Found the parent, insert new node as sibling
          const newNodeObj = {
            name: newNode.title ? newNode.title.substring(0, 30) : newNode.id,
            id: newNode.id,
            category: newNode.category,
            distance: position.distance,
            added: true
          };

          // Create internal node to group closest node with new node
          const internalNode = {
            name: `internal_${Date.now()}`,
            children: [node.children[i], newNodeObj],
            distance: position.distance / 2
          };

          node.children[i] = internalNode;
          return true;
        }

        if (findAndInsert(node.children[i])) {
          return true;
        }
      }
    }
    return false;
  };

  if (!findAndInsert(tree)) {
    // If couldn't find position, add at root
    if (!tree.children) {
      tree.children = [];
    }
    tree.children.push({
      name: newNode.title ? newNode.title.substring(0, 30) : newNode.id,
      id: newNode.id,
      category: newNode.category,
      distance: position.distance,
      added: true
    });
  }
};

/**
 * Calculate similarity between two trees
 */
export const calculateTreeSimilarity = (tree1, tree2) => {
  if (!tree1 || !tree2) return 0;

  // Get all leaf nodes from both trees
  const getLeafNodes = (node) => {
    const leaves = new Set();
    const traverse = (n) => {
      if (!n.children) {
        leaves.add(n.id || n.name);
      } else {
        n.children.forEach(traverse);
      }
    };
    traverse(node);
    return leaves;
  };

  const leaves1 = getLeafNodes(tree1);
  const leaves2 = getLeafNodes(tree2);

  // Calculate Jaccard similarity
  const intersection = new Set([...leaves1].filter(x => leaves2.has(x)));
  const union = new Set([...leaves1, ...leaves2]);

  if (union.size === 0) return 0;

  const jaccardSimilarity = intersection.size / union.size;

  // Check if content is identical (100% similarity)
  if (leaves1.size === leaves2.size && intersection.size === leaves1.size) {
    // All nodes are the same, check if tree structure is also identical
    const structureIdentical = JSON.stringify(tree1) === JSON.stringify(tree2);
    return structureIdentical ? 1.0 : 0.95; // 95% if nodes same but structure different
  }

  return jaccardSimilarity;
};
