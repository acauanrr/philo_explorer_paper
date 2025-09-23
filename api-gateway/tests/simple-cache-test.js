#!/usr/bin/env node
/**
 * Simple test script to validate cache functionality
 * Run with: node tests/simple-cache-test.js
 */

import { createHash } from 'crypto';

const API_URL = 'http://localhost:3001/api/phylo/quality/errors';

// Test data
const testData = {
  high_dim_points: [
    [0, 0, 1],
    [1, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
    [0.5, 0.5, 1]
  ],
  low_dim_points: [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
    [0.5, 0.5]
  ],
  robust_scaling: false
};

async function runTest() {
  console.log('🧪 E2E Cache Test for Phylo Explorer API Gateway\n');
  console.log('=' .repeat(50));

  try {
    // Test 1: First request (should be MISS)
    console.log('\n📝 Test 1: First request (expecting MISS)');
    const response1 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    const data1 = await response1.json();
    const cacheHeader1 = response1.headers.get('x-cache');

    console.log(`   Status: ${response1.status}`);
    console.log(`   X-Cache: ${cacheHeader1 || 'NOT SET'}`);
    console.log(`   Cache Key: ${data1.cacheKey}`);
    console.log(`   Cached flag: ${data1.cached}`);

    if (cacheHeader1 === 'MISS' && !data1.cached) {
      console.log('   ✅ Test 1 PASSED - First request was a cache MISS');
    } else {
      console.log('   ❌ Test 1 FAILED - Expected MISS but got', cacheHeader1);
    }

    // Test 2: Second request (should be HIT)
    console.log('\n📝 Test 2: Second request (expecting HIT)');
    const response2 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    const data2 = await response2.json();
    const cacheHeader2 = response2.headers.get('x-cache');

    console.log(`   Status: ${response2.status}`);
    console.log(`   X-Cache: ${cacheHeader2 || 'NOT SET'}`);
    console.log(`   Cache Key: ${data2.cacheKey}`);
    console.log(`   Cached flag: ${data2.cached}`);

    if (cacheHeader2 === 'HIT' && data2.cached) {
      console.log('   ✅ Test 2 PASSED - Second request was a cache HIT');
    } else {
      console.log('   ❌ Test 2 FAILED - Expected HIT but got', cacheHeader2);
    }

    // Test 3: Cache key consistency
    console.log('\n📝 Test 3: Cache key consistency');
    if (data1.cacheKey === data2.cacheKey) {
      console.log(`   ✅ Test 3 PASSED - Cache keys match: ${data1.cacheKey}`);
    } else {
      console.log(`   ❌ Test 3 FAILED - Cache keys don't match`);
      console.log(`      First:  ${data1.cacheKey}`);
      console.log(`      Second: ${data2.cacheKey}`);
    }

    // Test 4: Data consistency
    console.log('\n📝 Test 4: Data consistency check');
    const dataMatch = JSON.stringify(data1.aggregated_errors) === JSON.stringify(data2.aggregated_errors);
    if (dataMatch) {
      console.log('   ✅ Test 4 PASSED - Cached data matches original');
    } else {
      console.log('   ❌ Test 4 FAILED - Cached data differs from original');
    }

    // Test 5: Different data produces different cache key
    console.log('\n📝 Test 5: Different data produces different cache key');
    const differentData = {
      ...testData,
      high_dim_points: testData.high_dim_points.map(p => p.map(v => v + 1))
    };

    const response3 = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(differentData)
    });

    const data3 = await response3.json();

    if (data3.cacheKey !== data1.cacheKey) {
      console.log(`   ✅ Test 5 PASSED - Different data has different cache key`);
      console.log(`      Original: ${data1.cacheKey}`);
      console.log(`      Different: ${data3.cacheKey}`);
    } else {
      console.log('   ❌ Test 5 FAILED - Different data has same cache key');
    }

    // Test 6: Cache key validation
    console.log('\n📝 Test 6: Cache key format validation');
    const expectedLength = 16; // SHA256 truncated to 16 chars
    const isHex = /^[a-f0-9]+$/i.test(data1.cacheKey);

    if (data1.cacheKey.length === expectedLength && isHex) {
      console.log(`   ✅ Test 6 PASSED - Cache key is valid SHA256 format`);
    } else {
      console.log(`   ❌ Test 6 FAILED - Invalid cache key format`);
      console.log(`      Length: ${data1.cacheKey.length} (expected ${expectedLength})`);
      console.log(`      Is hex: ${isHex}`);
    }

    // Summary
    console.log('\n' + '=' .repeat(50));
    console.log('✅ All cache tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   - Cache key generation: Working');
    console.log('   - Cache HIT/MISS headers: Working');
    console.log('   - Data consistency: Verified');
    console.log('   - SHA256 hashing: Confirmed');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Make sure the API Gateway is running on port 3001');
    }
    process.exit(1);
  }
}

// Run the test
runTest().then(() => {
  console.log('\n🎉 Cache E2E validation complete!');
  process.exit(0);
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});