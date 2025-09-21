#!/usr/bin/env python3
"""
Test script for Neighbor-Joining algorithm implementation
"""

import requests
import json
import numpy as np
from time import time

# Test configuration
BASE_URL = "http://localhost:8001"

def test_health_check():
    """Test if the service is running"""
    print("\n1. Testing Health Check...")
    response = requests.get(f"{BASE_URL}/health")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Health check passed: {data['status']}")
        print(f"      ML Service Ready: {data['ml_service_ready']}")
        return True
    else:
        print(f"   ❌ Health check failed: {response.status_code}")
        return False

def test_tree_reconstruction():
    """Test tree reconstruction with a simple distance matrix"""
    print("\n2. Testing Tree Reconstruction Endpoint...")

    # Simple 4x4 distance matrix (symmetric)
    distance_matrix = [
        [0.0, 0.2, 0.4, 0.6],
        [0.2, 0.0, 0.5, 0.7],
        [0.4, 0.5, 0.0, 0.3],
        [0.6, 0.7, 0.3, 0.0]
    ]

    labels = ["Species_A", "Species_B", "Species_C", "Species_D"]

    payload = {
        "distance_matrix": distance_matrix,
        "labels": labels
    }

    print(f"   Sending {len(labels)}x{len(labels)} distance matrix...")
    start_time = time()

    response = requests.post(
        f"{BASE_URL}/api/v1/tree/reconstruct",
        json=payload,
        headers={"Content-Type": "application/json"}
    )

    elapsed = time() - start_time

    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Tree reconstruction successful (took {elapsed:.2f}s)")
        print(f"      Newick tree: {data['newick']}")
        print(f"      Statistics: {json.dumps(data['statistics'], indent=8)}")
        return True
    else:
        print(f"   ❌ Tree reconstruction failed: {response.status_code}")
        print(f"      Error: {response.text}")
        return False

def test_full_pipeline():
    """Test the full pipeline from documents to tree"""
    print("\n3. Testing Full Pipeline (Documents → Tree)...")

    documents = [
        {
            "id": "doc1",
            "content": "The quick brown fox jumps over the lazy dog. This is a test document about animals."
        },
        {
            "id": "doc2",
            "content": "The fast red fox leaps over the sleeping canine. Similar content about creatures."
        },
        {
            "id": "doc3",
            "content": "Python programming is great for data science and machine learning applications."
        },
        {
            "id": "doc4",
            "content": "JavaScript is widely used for web development and creating interactive websites."
        }
    ]

    payload = {
        "documents": documents,
        "preprocess": True,
        "distance_metric": "cosine",
        "algorithm": "neighbor_joining"
    }

    print(f"   Processing {len(documents)} documents through full pipeline...")
    start_time = time()

    response = requests.post(
        f"{BASE_URL}/api/v1/pipeline/full",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=60  # Allow more time for embedding generation
    )

    elapsed = time() - start_time

    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Full pipeline successful (took {elapsed:.2f}s)")
        print(f"      Newick tree: {data['newick'][:100]}...")  # Show first 100 chars
        print(f"      Labels: {data['labels']}")
        print(f"      Statistics:")
        for key, value in data['statistics'].items():
            print(f"         {key}: {value}")
        return True
    else:
        print(f"   ❌ Full pipeline failed: {response.status_code}")
        print(f"      Error: {response.text}")
        return False

def test_embeddings():
    """Test embedding generation"""
    print("\n4. Testing Embedding Generation...")

    texts = [
        "Machine learning is transforming technology",
        "Deep learning requires large datasets",
        "Cats are popular pets worldwide"
    ]

    payload = {
        "texts": texts,
        "preprocess": True
    }

    print(f"   Generating embeddings for {len(texts)} texts...")
    start_time = time()

    response = requests.post(
        f"{BASE_URL}/api/v1/embeddings",
        json=payload,
        headers={"Content-Type": "application/json"}
    )

    elapsed = time() - start_time

    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Embedding generation successful (took {elapsed:.2f}s)")
        print(f"      Model: {data['model_used']}")
        print(f"      Dimension: {data['dimension']}")
        print(f"      Generated {len(data['embeddings'])} embeddings")
        return True
    else:
        print(f"   ❌ Embedding generation failed: {response.status_code}")
        print(f"      Error: {response.text}")
        return False

def test_large_matrix():
    """Test with a larger distance matrix to verify performance"""
    print("\n5. Testing Larger Matrix (Performance Test)...")

    # Generate a larger random distance matrix
    n = 20  # 20x20 matrix
    np.random.seed(42)
    matrix = np.random.rand(n, n)
    # Make it symmetric
    matrix = (matrix + matrix.T) / 2
    np.fill_diagonal(matrix, 0)

    distance_matrix = matrix.tolist()
    labels = [f"Taxa_{i+1}" for i in range(n)]

    payload = {
        "distance_matrix": distance_matrix,
        "labels": labels
    }

    print(f"   Sending {n}x{n} distance matrix...")
    start_time = time()

    response = requests.post(
        f"{BASE_URL}/api/v1/tree/reconstruct",
        json=payload,
        headers={"Content-Type": "application/json"}
    )

    elapsed = time() - start_time

    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Large matrix reconstruction successful (took {elapsed:.2f}s)")
        print(f"      Tree length: {len(data['newick'])} characters")
        print(f"      Iterations: {data['statistics']['iterations']}")
        print(f"      Total operations: {data['statistics']['total_operations']}")
        print(f"      Complexity: {data['statistics']['complexity']}")
        return True
    else:
        print(f"   ❌ Large matrix reconstruction failed: {response.status_code}")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("NEIGHBOR-JOINING ALGORITHM TEST SUITE")
    print("=" * 60)

    results = []

    # Run tests
    results.append(("Health Check", test_health_check()))
    results.append(("Tree Reconstruction", test_tree_reconstruction()))
    results.append(("Embeddings", test_embeddings()))
    results.append(("Full Pipeline", test_full_pipeline()))
    results.append(("Large Matrix Performance", test_large_matrix()))

    # Summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    for test_name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"   {test_name}: {status}")

    total_passed = sum(1 for _, passed in results if passed)
    total_tests = len(results)

    print(f"\n   Total: {total_passed}/{total_tests} tests passed")

    if total_passed == total_tests:
        print("\n🎉 All tests passed successfully!")
        return 0
    else:
        print(f"\n⚠️  {total_tests - total_passed} test(s) failed")
        return 1

if __name__ == "__main__":
    exit(main())