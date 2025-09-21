# Phylo Explorer Backend - FastAPI

## 🚀 Arquitetura de Alto Desempenho

Backend Python moderno implementado com FastAPI para análise filogenética com integração superior ao ecossistema de PLN e Machine Learning.

## 📋 Características

- **FastAPI Framework**: Desempenho excepcional com validação automática via Pydantic
- **Servidor ASGI**: Uvicorn com capacidades assíncronas para tarefas intensivas
- **Documentação Automática**: Swagger UI e ReDoc gerados automaticamente
- **Type Hints**: Validação de dados e autocompletar IDE nativo
- **CORS Configurado**: Pronto para integração com frontend
- **Métricas de Sistema**: Endpoint de monitoramento com psutil

## 🛠️ Instalação

### 1. Ambiente Virtual
```bash
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# ou
venv\Scripts\activate  # Windows
```

### 2. Dependências
```bash
pip install -r requirements.txt
```

## 🏃 Execução

### Modo Desenvolvimento (com auto-reload)
```bash
./run_server.sh
# ou
uvicorn main:app --reload --port 8000
```

### Modo Produção
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 📍 Endpoints

### Documentação Interativa
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

### Endpoints Principais

#### Health Check
```bash
GET /health
```
Resposta:
```json
{
  "status": "ok",
  "service": "phylo-explorer-backend",
  "version": "1.0.0",
  "timestamp": "2024-01-20T10:00:00",
  "environment": "development",
  "python_version": "3.12.0"
}
```

#### Service Info
```bash
GET /api/info
```

#### Metrics
```bash
GET /metrics
```
Retorna métricas de CPU, memória e sistema.

## 🔧 Configuração

### Variáveis de Ambiente (.env)
```env
ENVIRONMENT=development
HOST=0.0.0.0
PORT=8000
ML_SERVICE_URL=http://localhost:7860
FRONTEND_URL=http://localhost:3000
LOG_LEVEL=DEBUG
```

## 📊 Vantagens sobre Backend Java/Tomcat

1. **Integração Superior com PLN**: Acesso direto a Hugging Face, spaCy, NLTK
2. **Performance Assíncrona**: Melhor handling de requisições concorrentes
3. **Desenvolvimento Rápido**: Hot-reload e documentação automática
4. **Ecosystem Python**: Scikit-learn, NumPy, Pandas nativamente disponíveis
5. **Type Safety**: Validação automática com Pydantic
6. **Menor Footprint**: Menos recursos comparado a JVM/Tomcat

## 🔄 Próximos Passos

- [ ] Implementar algoritmo Neighbor-Joining
- [ ] Integrar com serviço ML (HF-Space)
- [ ] Adicionar endpoints de processamento de texto
- [ ] Implementar cache com Redis
- [ ] Adicionar autenticação JWT

## 📈 Performance

FastAPI oferece:
- Latência < 10ms para endpoints simples
- Suporte a WebSockets para real-time
- Processamento assíncrono para tarefas pesadas
- Auto-scaling com múltiplos workers

## 🐛 Debug

Para debug detalhado:
```bash
LOG_LEVEL=DEBUG uvicorn main:app --reload --log-level debug
```

## 📚 Estrutura do Projeto

```
backend-python/
├── venv/              # Ambiente virtual
├── main.py            # Aplicação principal
├── requirements.txt   # Dependências
├── .env              # Configuração local
├── .gitignore        # Ignorar arquivos
├── run_server.sh     # Script de inicialização
└── README.md         # Documentação
```