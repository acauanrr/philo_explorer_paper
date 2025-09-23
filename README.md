# 🌳 Phylo Explorer - Sistema de Análise Filogenética

Sistema moderno para análise de documentos usando árvores filogenéticas, com visualizações interativas e processamento de linguagem natural.

## 📍 Arquitetura do Sistema

O projeto é composto por **3 serviços independentes** que rodam **sem Docker**:

- **Frontend (Next.js)**: http://localhost:3000 - Interface React com visualizações D3.js
- **API Gateway (Node.js)**: http://localhost:4000 - Orquestração de APIs e cache em memória
- **Backend Python (FastAPI)**: http://localhost:8001 - Processamento ML e algoritmos filogenéticos

## 🚀 Início Rápido

### Método 1: Scripts Automatizados (Recomendado)

```bash
# Terminal 1 - Frontend
./start-frontend.sh

# Terminal 2 - API Gateway
./start-api-gateway.sh

# Terminal 3 - Backend Python
cd backend-python && ./run_simple.sh
```

### Verificar Status dos Serviços

```bash
./check-status.sh
```

## 📝 Scripts Disponíveis

| Script | Descrição |
|--------|-----------|
| `./start-frontend.sh` | Inicia o frontend Next.js na porta 3000 |
| `./start-api-gateway.sh` | Inicia o API Gateway Node.js na porta 4000 |
| `./backend-python/run_simple.sh` | Inicia o backend Python FastAPI na porta 8001 |
| `./check-status.sh` | Verifica o status de todos os serviços |

### Método 2: Comandos Manuais

Se preferir controle total dos comandos:

```bash
# Frontend
cd frontend && npm install && npm run dev

# API Gateway (em outro terminal)
cd api-gateway && npm install && DISABLE_REDIS=true npm run dev

# Backend Python (em outro terminal)
cd backend-python && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt && uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

## 🔧 Funcionalidades Principais

### 🧬 Processamento Filogenético
- **Algoritmo Neighbor Joining** para reconstrução de árvores
- **Embeddings semânticos** com Sentence Transformers
- **Análise de distância** entre documentos de texto
- **Pipeline completo** de preprocessamento a visualização

### 🎨 Visualizações Interativas
- **Árvore filogenética** navegável com D3.js
- **Word cloud** com análise de frequência
- **Mapa geográfico** para dados de localização
- **Painel de inspeção** com métricas de qualidade

### ⚡ Características Técnicas
- **Cache em memória** (sem dependência Redis)
- **Auto-instalação** de dependências
- **Verificação automática** de conflitos de porta
- **Reload automático** durante desenvolvimento
- **Ambientes isolados** (venv para Python, node_modules para Node.js)

## 📊 URLs Importantes

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:4000
- **API Docs**: http://localhost:8001/docs
- **ReDoc**: http://localhost:8001/redoc
- **Health Check**: http://localhost:8001/health

## 🐛 Solução de Problemas

### Porta em uso
```bash
# Verificar qual processo está usando a porta
lsof -i :3000  # ou :4000, :8001

# Matar o processo
kill -9 <PID>
```

### Dependências
```bash
# Frontend
cd frontend && npm install

# API Gateway
cd api-gateway && npm install

# Backend Python
cd backend-python && pip install -r requirements.txt
```

### Cache/Build
```bash
# Limpar cache do Next.js
cd frontend && rm -rf .next && npm run dev

# Recriar virtual environment do Python
cd backend-python && rm -rf venv && python -m venv venv
```

## 🔄 Workflow de Desenvolvimento

1. **Primeira execução**: Execute os scripts - eles configurarão tudo automaticamente
2. **Desenvolvimento**: Cada serviço recarrega automaticamente quando você modifica o código
3. **Verificação**: Use `./check-status.sh` para verificar se tudo está funcionando
4. **Parada**: Ctrl+C em cada terminal para parar os serviços

## 📂 Estrutura do Projeto

```
phylo_explorer/
├── 📁 frontend/              # Interface React com Next.js
│   ├── app/                  # App Router do Next.js 14
│   ├── components/           # Componentes React reutilizáveis
│   ├── contexts/             # Context API para estado global
│   └── public/               # Assets estáticos e datasets
├── 📁 api-gateway/           # API Gateway Node.js
│   ├── src/                  # Código TypeScript
│   ├── api/                  # Rotas da API
│   ├── middleware/           # Middlewares Express
│   └── tests/                # Testes E2E
├── 📁 backend-python/        # Backend Python FastAPI
│   ├── algorithms/           # Algoritmos filogenéticos
│   ├── processing/           # Processamento de texto
│   ├── services/             # Serviços ML e embeddings
│   └── routes/               # Rotas da API Python
├── 📁 docs/                  # Documentação técnica
├── 🚀 start-frontend.sh      # Script para iniciar frontend
├── 🚀 start-api-gateway.sh   # Script para iniciar API Gateway
└── 📊 check-status.sh        # Script de verificação de status
```

## 🛠️ Stack Tecnológica

### Frontend
- **Next.js 14** - Framework React com App Router
- **Chakra UI** - Biblioteca de componentes
- **D3.js** - Visualizações interativas
- **Framer Motion** - Animações
- **Axios** - Cliente HTTP

### API Gateway
- **Node.js + Express** - Servidor web
- **TypeScript** - Tipagem estática
- **Cache em memória** - Substituindo Redis
- **Jest** - Testes automatizados

### Backend Python
- **FastAPI** - Framework web assíncrono
- **Sentence Transformers** - Embeddings semânticos
- **Neighbor Joining** - Algoritmo filogenético
- **NumPy/SciPy** - Computação científica

## 🔄 Workflow de Desenvolvimento

1. **Primeira execução**: Scripts configuram ambiente automaticamente
2. **Desenvolvimento**: Cada serviço recarrega quando código muda
3. **Verificação**: Use `./check-status.sh` para monitorar
4. **Parada**: Ctrl+C em cada terminal para parar serviços

---

💡 **Dica Pro**: Execute `./check-status.sh` sempre que precisar verificar se os serviços estão funcionando corretamente!