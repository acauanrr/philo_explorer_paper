const express = require('express');
const axios = require('axios');
const router = express.Router();

// Configuration
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8001';

/**
 * Process datasets for phylogenetic analysis
 */
router.post('/process-datasets', async (req, res) => {
  try {
    const { dataset_t1, dataset_t2, analysis_type } = req.body;

    if (!dataset_t1 || !dataset_t2) {
      return res.status(400).json({
        success: false,
        error: 'Both dataset_t1 and dataset_t2 are required'
      });
    }

    console.log(`Processing datasets: T1=${dataset_t1.length} items, T2=${dataset_t2.length} items`);

    // Call Python backend to process datasets
    const response = await axios.post(`${PYTHON_API_URL}/phylo/process-datasets`, {
      dataset_t1,
      dataset_t2,
      analysis_type: analysis_type || 'comparison'
    }, {
      timeout: 120000, // 2 minutes timeout
      headers: {
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      data: response.data,
      message: `Successfully processed ${dataset_t1.length} vs ${dataset_t2.length} articles`
    });

  } catch (error) {
    console.error('Error processing datasets:', error.message);

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: error.response.data?.detail || error.response.data?.error || 'Python API error'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to process datasets'
    });
  }
});

/**
 * Get quality metrics for processed datasets
 */
router.get('/quality-metrics/:cacheKey', async (req, res) => {
  try {
    const { cacheKey } = req.params;

    const response = await axios.get(`${PYTHON_API_URL}/phylo/quality-metrics/${cacheKey}`);

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Error getting quality metrics:', error.message);

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Quality metrics not found for this cache key'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get quality metrics'
    });
  }
});

/**
 * Get projection comparison data
 */
router.post('/compare-projections', async (req, res) => {
  try {
    const { cache_key_t1, cache_key_t2 } = req.body;

    if (!cache_key_t1 || !cache_key_t2) {
      return res.status(400).json({
        success: false,
        error: 'Both cache_key_t1 and cache_key_t2 are required'
      });
    }

    const response = await axios.post(`${PYTHON_API_URL}/phylo/compare-projections`, {
      cache_key_t1,
      cache_key_t2
    });

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Error comparing projections:', error.message);

    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        error: error.response.data?.detail || error.response.data?.error || 'Python API error'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to compare projections'
    });
  }
});

/**
 * Proxy requests to Python backend phylo quality routes
 */
router.all('/quality/*', async (req, res) => {
  try {
    const pythonPath = req.path.replace('/quality', '/phylo/quality');
    const pythonUrl = `${PYTHON_API_URL}${pythonPath}`;

    const response = await axios({
      method: req.method,
      url: pythonUrl,
      data: req.body,
      params: req.query,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 60000
    });

    res.json(response.data);

  } catch (error) {
    console.error('Error proxying quality request:', error.message);

    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }

    res.status(500).json({
      success: false,
      error: 'Failed to proxy request to Python backend'
    });
  }
});

module.exports = router;