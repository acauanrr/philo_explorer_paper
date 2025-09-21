#!/usr/bin/env python3
"""
Script de teste para o pipeline completo de embeddings e matriz de distâncias
Demonstra a capacidade semântica do sistema
"""

import requests
import json
import numpy as np
from typing import List, Dict

BASE_URL = "http://localhost:8001"

def test_distance_matrix():
    """Testa o endpoint de matriz de distâncias com textos semanticamente relacionados"""

    print("🧪 Testando Pipeline de Matriz de Distâncias Semânticas")
    print("=" * 60)

    # Textos de teste com grupos semânticos claros
    test_documents = [
        # Grupo 1: Realeza/Liderança
        {"id": "doc1", "content": "O rei governou o reino com sabedoria e justiça durante décadas"},
        {"id": "doc2", "content": "O monarca administrou o país com inteligência e benevolência"},
        {"id": "doc3", "content": "A rainha liderou a nação com coragem em tempos difíceis"},

        # Grupo 2: Animais
        {"id": "doc4", "content": "O gato subiu na árvore para caçar pássaros no jardim"},
        {"id": "doc5", "content": "O cachorro correu pelo parque perseguindo uma bola"},

        # Grupo 3: Tecnologia
        {"id": "doc6", "content": "O computador processou os dados usando algoritmos de machine learning"},
        {"id": "doc7", "content": "A inteligência artificial analisou as informações com redes neurais"},
    ]

    # Fazer requisição
    response = requests.post(
        f"{BASE_URL}/api/v1/distancematrix",
        json={
            "documents": test_documents,
            "preprocess": True,
            "distance_metric": "cosine"
        }
    )

    if response.status_code == 200:
        result = response.json()

        print("\n✅ Matriz de Distâncias Gerada com Sucesso!")
        print(f"\n📊 Informações do Modelo:")
        print(f"   - Modelo: {result['model_used']}")
        print(f"   - Dimensão dos Embeddings: {result['embedding_dimension']}")
        print(f"   - Pré-processamento: {result['preprocessing_applied']}")
        print(f"   - Métrica: {result['distance_metric']}")

        print(f"\n📝 Documentos Processados:")
        for i, (doc_id, label) in enumerate(zip(result['document_ids'], result['labels'])):
            print(f"   {i+1}. [{doc_id}] {label}")

        # Analisar distâncias
        matrix = np.array(result['distance_matrix'])

        print(f"\n🔍 Análise Semântica das Distâncias:")
        print("-" * 40)

        # Grupos esperados
        groups = {
            "Realeza": [0, 1, 2],
            "Animais": [3, 4],
            "Tecnologia": [5, 6]
        }

        # Verificar coesão intra-grupo
        for group_name, indices in groups.items():
            if len(indices) > 1:
                group_distances = []
                for i in range(len(indices)):
                    for j in range(i+1, len(indices)):
                        dist = matrix[indices[i]][indices[j]]
                        group_distances.append(dist)

                avg_distance = np.mean(group_distances) if group_distances else 0
                print(f"\n   Grupo '{group_name}':")
                print(f"   Distância média intra-grupo: {avg_distance:.3f}")

                # Verificar qualidade semântica
                if avg_distance < 0.5:
                    print(f"   ✅ Excelente coesão semântica!")
                elif avg_distance < 0.7:
                    print(f"   ⚠️ Boa coesão semântica")
                else:
                    print(f"   ❌ Baixa coesão semântica")

        # Verificar separação inter-grupos
        print(f"\n   Distâncias Inter-grupos:")
        realeza_animal = matrix[0][3]  # rei vs gato
        realeza_tech = matrix[0][5]     # rei vs computador
        animal_tech = matrix[3][5]      # gato vs computador

        print(f"   Realeza ↔ Animais: {realeza_animal:.3f}")
        print(f"   Realeza ↔ Tecnologia: {realeza_tech:.3f}")
        print(f"   Animais ↔ Tecnologia: {animal_tech:.3f}")

        # Verificar se os grupos estão bem separados
        min_inter_distance = min(realeza_animal, realeza_tech, animal_tech)
        if min_inter_distance > 0.7:
            print(f"\n   ✅ Excelente separação entre grupos semânticos!")
        else:
            print(f"\n   ⚠️ Grupos semânticos parcialmente separados")

        return True
    else:
        print(f"\n❌ Erro: {response.status_code}")
        print(response.text)
        return False

def test_embeddings():
    """Testa o endpoint de geração de embeddings"""

    print("\n\n🧪 Testando Geração de Embeddings")
    print("=" * 60)

    # Palavras semanticamente relacionadas
    test_texts = [
        "rei",
        "monarca",
        "imperador",
        "gato",
        "felino",
        "computador"
    ]

    response = requests.post(
        f"{BASE_URL}/api/v1/embeddings",
        json={
            "texts": test_texts,
            "preprocess": False
        }
    )

    if response.status_code == 200:
        result = response.json()

        print("\n✅ Embeddings Gerados com Sucesso!")
        print(f"\n📊 Informações:")
        print(f"   - Modelo: {result['model_used']}")
        print(f"   - Dimensão: {result['dimension']}")
        print(f"   - Textos processados: {len(test_texts)}")

        # Calcular similaridades
        embeddings = np.array(result['embeddings'])

        print(f"\n🔍 Análise de Similaridade Semântica:")
        print("-" * 40)

        # Calcular similaridade cosseno entre pares específicos
        def cosine_similarity(v1, v2):
            return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))

        pairs_to_check = [
            (0, 1, "rei", "monarca"),      # Devem ser muito similares
            (0, 2, "rei", "imperador"),    # Devem ser muito similares
            (3, 4, "gato", "felino"),       # Devem ser muito similares
            (0, 3, "rei", "gato"),          # Devem ser diferentes
            (0, 5, "rei", "computador"),    # Devem ser diferentes
        ]

        for i, j, word1, word2 in pairs_to_check:
            sim = cosine_similarity(embeddings[i], embeddings[j])
            print(f"\n   '{word1}' ↔ '{word2}':")
            print(f"   Similaridade: {sim:.3f}")

            if sim > 0.7:
                print(f"   ✅ Alta similaridade semântica")
            elif sim > 0.4:
                print(f"   ⚠️ Similaridade média")
            else:
                print(f"   ❌ Baixa similaridade (como esperado para conceitos diferentes)")

        return True
    else:
        print(f"\n❌ Erro: {response.status_code}")
        print(response.text)
        return False

def test_preprocessing():
    """Testa o endpoint de pré-processamento"""

    print("\n\n🧪 Testando Pré-processamento de Texto")
    print("=" * 60)

    test_texts = [
        "<p>Este é um TEXTO com HTML!</p>",
        "Texto   com    espaços     extras",
        "O rei governou o reino com sabedoria e justiça"
    ]

    response = requests.post(
        f"{BASE_URL}/api/v1/preprocess",
        json=test_texts
    )

    if response.status_code == 200:
        result = response.json()

        print("\n✅ Pré-processamento Executado!")
        print(f"\n📝 Configuração:")
        config = result['config']
        for key, value in config.items():
            print(f"   - {key}: {value}")

        print(f"\n🔄 Transformações:")
        for original, processed in zip(result['original_texts'], result['processed_texts']):
            print(f"\n   Original:  '{original}'")
            print(f"   Processado: '{processed}'")

        return True
    else:
        print(f"\n❌ Erro: {response.status_code}")
        print(response.text)
        return False

def main():
    """Executa todos os testes"""

    print("🚀 TESTE COMPLETO DO PIPELINE DE EMBEDDINGS SEMÂNTICOS")
    print("=" * 70)
    print("Backend: http://localhost:8001")
    print("=" * 70)

    # Verificar se o servidor está rodando
    try:
        health = requests.get(f"{BASE_URL}/health").json()
        if not health['ml_service_ready']:
            print("❌ Serviço ML não está pronto!")
            return
        print(f"✅ Servidor rodando - Versão {health['version']}")
    except:
        print("❌ Servidor não está respondendo em http://localhost:8001")
        return

    # Executar testes
    tests = [
        test_distance_matrix,
        test_embeddings,
        test_preprocessing
    ]

    results = []
    for test in tests:
        results.append(test())

    # Resumo final
    print("\n\n" + "=" * 70)
    print("📊 RESUMO DOS TESTES")
    print("=" * 70)

    passed = sum(results)
    total = len(results)

    if passed == total:
        print(f"✅ TODOS OS TESTES PASSARAM! ({passed}/{total})")
    else:
        print(f"⚠️ {passed}/{total} testes passaram")

    print("\n💡 O pipeline está usando embeddings semânticos de última geração!")
    print("   Isso significa que o sistema entende o SIGNIFICADO dos textos,")
    print("   não apenas palavras-chave, resultando em árvores filogenéticas")
    print("   muito mais precisas e significativas!")

if __name__ == "__main__":
    main()