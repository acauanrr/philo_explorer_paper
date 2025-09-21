# 🌳 Phylo Explorer Paper - Sistema de Análise Filogenética de Documentos

Sistema web interativo para análise filogenética de coleções de documentos, permitindo visualização de relações evolutivas entre textos através de árvores filogenéticas, word clouds e análises temporais.

## 📊 Arquitetura do Sistema

```
┌─────────────────────────────────────────┐
│           Frontend (Next.js)            │
│   - Interface de usuário responsiva     │
│   - Visualizações D3.js interativas     │
│   - Upload e gerenciamento de arquivos  │
└─────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────┐
│         Backend (Node.js/Express)       │
│   - API REST para processamento         │
│   - Integração com serviços ML          │
│   - Geração de árvores filogenéticas    │
└─────────────────────────────────────────┘
```

## 🚀 Componentes do Sistema

### Frontend (Next.js)
- **Porta**: 3000
- **Tecnologias**: React 18, Next.js 14, Chakra UI 2.0, D3.js v7
- **Principais Funcionalidades**:
  - Visualização interativa de árvores filogenéticas
  - Word cloud dinâmico dos termos mais frequentes
  - Timeline/River chart para análise temporal
  - Upload e processamento de arquivos CSV/JSON
  - Interface responsiva e moderna

### Backend (Node.js/Express)
- **Porta**: 4000
- **Tecnologias**: Node.js 18+, Express 4, Axios
- **Principais Funcionalidades**:
  - API RESTful para comunicação frontend-backend
  - Processamento de dados e geração de árvores Newick
  - Integração com serviços de ML (Gradio/HuggingFace)
  - Análise de similaridade textual
  - Geolocalização e busca web integrada

## 📁 Estrutura do Projeto

```
philo_explorer_paper/
│
├── frontend/                  # Aplicação Frontend
│   ├── app/                  # App directory (Next.js 14)
│   │   ├── layout.jsx       # Layout principal
│   │   ├── page.jsx         # Página inicial
│   │   └── providers.jsx    # Providers React
│   ├── components/          # Componentes React
│   │   ├── layout/         # Componentes de layout
│   │   ├── visualizations/ # Visualizações D3.js
│   │   └── _ui/           # Componentes UI reutilizáveis
│   ├── public/             # Assets públicos
│   │   └── datasets/       # Datasets de exemplo
│   └── package.json        # Dependências frontend
│
├── backend/                  # Aplicação Backend
│   ├── src/                 # Código fonte
│   │   ├── routes/         # Rotas da API
│   │   └── services/       # Serviços de negócio
│   ├── config/             # Configurações
│   ├── middleware/         # Middlewares Express
│   └── package.json        # Dependências backend
│
├── .gitignore              # Arquivos ignorados pelo Git
├── .env.example            # Exemplo de variáveis de ambiente
└── README.md               # Este arquivo
```

## 🚀 Instalação e Execução

### Pré-requisitos
- Node.js 18+ e npm
- Git

### Instalação

1. **Clone o repositório**
```bash
git clone https://github.com/acauanrr/philo_explorer_paper.git
cd philo_explorer_paper
```

2. **Instale as dependências do Backend**
```bash
cd backend
npm install
```

3. **Instale as dependências do Frontend**
```bash
cd ../frontend
npm install
```

### Execução

1. **Inicie o Backend** (em um terminal)
```bash
cd backend
npm run dev
# Backend rodando em http://localhost:4000
```

2. **Inicie o Frontend** (em outro terminal)
```bash
cd frontend
npm run dev
# Frontend rodando em http://localhost:3000
```

3. **Acesse a aplicação**
   - Abra o navegador em http://localhost:3000

## 🔄 Funcionalidades Principais

### Visualizações Interativas
- **Árvore Filogenética**: Visualização hierárquica de relações entre documentos
- **Word Cloud**: Nuvem de palavras com termos mais frequentes
- **Timeline/River**: Análise temporal da evolução dos documentos
- **Coordenação**: Todas as visualizações se atualizam sincronizadamente

### Processamento de Dados
- Upload de arquivos CSV e JSON
- Análise de similaridade textual usando TF-IDF
- Geração de árvores filogenéticas com algoritmo Neighbor-Joining
- Processamento de linguagem natural para extração de features

## 📡 API Endpoints

### Backend (Porto 4000)
- `GET /health` - Verificação de saúde do serviço
- `POST /api/phylo/generate-tree` - Gerar árvore filogenética
- `POST /api/phylo/analyze` - Analisar documentos
- `GET /api/phylo/search-node` - Buscar informações de nós
- `POST /api/phylo/ml-service` - Integração com serviços ML

## 🛠️ Tecnologias Utilizadas

### Frontend
- **Next.js 14**: Framework React com App Router
- **React 18**: Biblioteca UI com hooks modernos
- **Chakra UI 2.0**: Sistema de design components
- **D3.js v7**: Visualizações de dados interativas
- **Axios**: Cliente HTTP para API calls

### Backend
- **Node.js**: Runtime JavaScript server-side
- **Express 4**: Framework web minimalista
- **Gradio Client**: Integração com modelos ML
- **Cors**: Habilitação de CORS
- **Dotenv**: Gerenciamento de variáveis de ambiente

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto backend:

```env
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:3000
ML_SERVICE_URL=https://your-ml-service.hf.space
```

Crie um arquivo `.env.local` na raiz do projeto frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## 📊 Uso da Aplicação

1. **Acesse a aplicação** em http://localhost:3000

2. **Faça upload de um arquivo**:
   - Use os datasets de exemplo em `frontend/public/datasets/`
   - Formatos suportados: CSV, JSON

3. **Explore as visualizações**:
   - Navegue pela árvore filogenética
   - Clique nos nós para ver detalhes
   - Use o word cloud para análise de termos
   - Visualize a evolução temporal no timeline

4. **Interaja com os controles**:
   - Ajuste o zoom e rotação da árvore
   - Filtre por período temporal
   - Selecione diferentes métricas de análise

## 🐛 Troubleshooting

### Problemas com Submódulos Git

Se você teve problemas com submódulos não inicializados:

1. **Remova configurações de submódulo antigas**:
```bash
git rm --cached backend frontend
rm -rf backend/.git frontend/.git
```

2. **Adicione os diretórios como parte normal do repositório**:
```bash
git add .
git commit -m "Converter submódulos em diretórios normais"
git push
```

### Porta já em uso

Se a porta estiver ocupada:
```bash
# Verificar processo usando a porta
lsof -i :4000  # ou :3000
# Finalizar o processo
kill -9 PID
```

### Erro de CORS

Se houver erro de CORS entre frontend e backend:
1. Verifique se o backend está rodando na porta correta (4000)
2. Confirme as variáveis de ambiente no `.env`
3. Reinicie ambos os serviços

### Dependências não instaladas

Se houver erro de módulos não encontrados:
```bash
# Para o backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Para o frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```


## 📚 Datasets de Exemplo

A aplicação inclui datasets de exemplo para teste:

- `frontend/public/datasets/csv/`: Arquivos CSV de exemplo
  - `bbc_news_sample.csv`: Amostra de notícias da BBC
  - `fake_news_sample.csv`: Dataset de detecção de fake news

- `frontend/public/datasets/json/`: Arquivos JSON de exemplo
  - `News_Category_Dataset_sample.json`: Categorias de notícias

- `frontend/public/datasets/newicks/`: Árvores Newick pré-processadas
  - `articles_n_25.txt`: Árvore de 25 artigos
  - `news.txt`: Árvore de notícias

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para:

1. Fazer fork do projeto
2. Criar uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abrir um Pull Request

## 📝 Licença

Este projeto está licenciado sob a Licença MIT - veja o arquivo LICENSE para detalhes.

## 👤 Autor

**Acauan R. Ribeiro**
- GitHub: [@acauanrr](https://github.com/acauanrr)

## 🙏 Agradecimentos

- Universidade Federal do Amazonas (UFAM)
- Programa de Pós-Graduação em Informática

---

**Versão**: 1.0.0
**Status**: ✅ Em Desenvolvimento
**Última Atualização**: Dezembro 2024