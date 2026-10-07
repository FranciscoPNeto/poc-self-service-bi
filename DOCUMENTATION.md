# Documentação Técnica e Regras de Negócio - Fabric Executive Studio (Self-Service BI)

## 1. Visão Geral do Projeto

O **Fabric Executive Studio** é uma plataforma corporativa web no padrão **Microsoft Fabric Apps / Power BI Studio**, projetada para permitir a criação self-service de relatórios analíticos executivos integrados a múltiplos modelos semânticos (*Semantic Models* / Datasets) em uma interface unificada.

A arquitetura opera no modelo **Live Connection**, garantindo que a aplicação consuma os metadados e medidas DAX diretamente dos modelos publicados no Microsoft Fabric sem duplicar nem extrair dados sensíveis para o cliente.

---

## 2. Regras de Negócio e Diretrizes de Arquitetura

### 2.1. Conexão Live e Isolamento de Dados
* **Sem Carga Local de Dados Pessoais/Sensíveis:** O aplicativo não faz download de tabelas de dados confidenciais de pacientes ou usuários para persistência em disco.
* **Modelo Semântico Centralizado (TMDL):** A definição do modelo (tabelas, colunas e medidas DAX) é extraída via bridge MCP utilizando a chamada nativa `get_item_definition` (TMDL) do Microsoft Fabric e cacheada localmente para alta performance.
* **Multi-Dataset no mesmo Dashboard:** Um único relatório ou página pode combinar simultaneamente medidas de diferentes modelos semânticos (ex.: *Atendimento Laboratorial* e *Infotransito Recife*), respeitando a procedência e cor institucional de cada dataset.

### 2.2. Gestão de Páginas (Multi-Page Canvas)
* O relatório suporta **n** páginas independentes.
* O estado das páginas contém:
  * Identificador único (`id`).
  * Nome customizável (`name`).
  * Lista de visuais associados (`visuals`).
* A alternância entre abas de páginas é **atômica**: não recria nem destrói desnecessariamente componentes de outras páginas e preserva os títulos e tipos configurados.
* Uma página não pode ser excluída se for a única página restante do relatório.

### 2.3. Tipos de Visualizações e Adaptação
Cada campo arrastado ou adicionado pode assumir qualquer um dos formatos suportados:
1. **KPI Card:** Indicador resumido com métrica executiva em destaque (Largura padrão: 3 colunas de 12).
2. **Gráfico de Barras (*Bar Chart*):** Para comparações e rankings dimensionais.
3. **Gráfico de Linhas (*Line Chart*):** Para séries temporais e evolução contínua.
4. **Gráfico de Rosca (*Donut Chart*):** Para visualização de proporção e distribuição.
5. **Gráfico de Área (*Area Chart*):** Para volume acumulado ou contínuo.
6. **Tabela Analítica (*Table View*):** Para listagem detalhada de registros e atributos.

### 2.4. Templates Reutilizáveis de Metadados (Export / Import)
* **Finalidade:** Permitir que layouts corporativos, visuais parametrizados e estruturas de páginas sejam compartilhados entre equipes e ambientes (Desenvolvimento, Homologação e Produção).
* **Formato do Arquivo:** Arquivo `.json` contendo apenas os metadados de layout e referências de medidas:
  * `schemaVersion`: Versão do formato do template (`1.0-fabric-metadata-template`).
  * `name`: Nome identificador do template.
  * `theme`: Tema visual (`light` ou `dark`).
  * `pages`: Estrutura hierárquica das páginas e visuais.
* **Portabilidade:** O template pode ser salvo no servidor local (`config/templates/`), baixado como arquivo no navegador (*Download*) ou importado de outro computador via upload (*Import JSON*).

### 2.5. Identidade Visual e Experiência do Usuário (Design System)
* **Padrão Corporativo Microsoft Fluent / Fabric:**
  * Tipografia: Segoe UI, fontes sem serifa corporativas.
  * Cores de destaque: Paleta Microsoft (Azul `#0078D4`, Verde `#107C41`, Roxo `#5C2D91`, etc.).
  * Sem uso de emojis em componentes corporativos; ícones vetoriais SVG limpos e profissionais.
* **Dark Mode & Light Mode Nativos:**
  * O aplicativo possui alternância completa de tema via botão de cabeçalho.
  * Gráficos (Chart.js) atualizam suas réguas, textos de eixos e gridlines automaticamente na troca de tema.
  * Preferência persistida localmente no `localStorage`.

### 2.6. Mecanismo de Atualização / Refresh (Visuais e Modelo Semântico)
* **Menu Dropdown de Atualização no Ribbon:** Disponibiliza opções segmentadas de atualização corporativa no estilo Microsoft Fabric:
  1. **Atualizar Visuais:** Redesenha e recalcula todos os visuais da página ativa sem reinicializar o estado global ou perder os visuais selecionados.
  2. **Atualizar Modelo Semântico (TMDL via Fabric):** Força uma requisição ao Microsoft Fabric para sincronizar tabelas, medidas DAX recém-criadas e colunas atualizadas, contornando o cache local com `force_refresh=True`.
  3. **Atualização Completa:** Executa sequencialmente a sincronização dos modelos semânticos e a re-renderização dos visuais do canvas.
* **Botão Rápido de Sincronização:** Disponível diretamente no cabeçalho do painel esquerdo (*Dados & Modelos*) para recarregar schemas em 1 clique.
* **Feedback Visual:** Animação de rotação com ícone SVG (`.spinning`) e notificações via toast durante o processamento.

---

## 3. Estrutura de Diretórios e Arquivos

```
poc-self-service-bi/
├── .antigravity/
│   ├── agents/
│   │   └── report_builder.py          # Agente que compila a definição PBIR final
│   └── skills/
│       └── skill_payload_generator.py # Skill que formata o payload JSON multi-páginas
├── app/
│   ├── index.html                     # Interface SPA do Fabric Executive Studio
│   ├── index.css                      # Design System Fluent/Fabric com suporte a Dark/Light
│   ├── app.js                         # Lógica do front-end, estado, Drag&Drop e Charts
│   └── server.py                      # Servidor HTTP Python com APIs REST e No-Cache
├── config/
│   ├── datasets_registry.json         # Registro dos Semantic Models conectados
│   ├── saved_dashboard_pages.json     # Persistência do estado ativo das páginas
│   ├── schemas_cache/                 # Cache dos schemas TMDL inspecionados
│   └── templates/                     # Biblioteca de templates de metadados salvos
├── reports_output/                    # Relatórios PBIR compilados para publicação
├── test_edge_cdp.py                   # Testes automatizados no Edge via CDP
├── test_edge_templates.py             # Testes específicos de templates e Dark Mode via CDP
├── test_edge_refresh.py               # Testes de atualização de visuais e modelos semânticos
└── DOCUMENTATION.md                   # Esta documentação completa do projeto
```

---

## 4. Endpoints da API REST (`server.py`)

| Método | Endpoint | Descrição |
| :--- | :--- | :--- |
| `GET` | `/api/datasets` | Retorna o catálogo de modelos semânticos registrados. |
| `POST` | `/api/datasets` | Registra um novo modelo semântico no catálogo (Workspace ID + Item ID). |
| `GET` | `/api/all-schemas` | Retorna a estrutura (tabelas, colunas, medidas) de todos os datasets (suporta `?force=true`). |
| `POST` | `/api/refresh-schemas` | Força a sincronização TMDL de modelos semânticos no Fabric MCP sem cache. |
| `GET` | `/api/pages` | Recupera as páginas e visuais salvos na sessão atual. |
| `POST` | `/api/pages` | Persiste as páginas e visuais modificados pelo usuário. |
| `GET` | `/api/templates` | Lista os templates de layout disponíveis no servidor (`config/templates/`). |
| `POST` | `/api/templates/save` | Salva o estado atual de páginas e tema como um novo arquivo de template. |
| `POST` | `/api/templates/load` | Carrega e aplica um template de layout existente. |
| `POST` | `/api/generate-mega-report`| Invoca a skill e o agente de compilação PBIR para gerar o arquivo final. |
| `GET` | `/api/reports` | Lista os relatórios PBIR prontos em `reports_output/`. |

---

## 5. Como Executar e Validar

### 5.1. Iniciar o Servidor Backend
```powershell
python "app/server.py" 8080
```
O estúdio estará disponível em: `http://localhost:8080/`.

### 5.2. Acessar com Microsoft Edge em Modo Debug (CDP)
Caso queira executar os testes automatizados com o navegador Microsoft Edge:
```powershell
msedge.exe --remote-debugging-port=9222 http://localhost:8080/
```

### 5.3. Executar a Suíte de Testes Automatizados via CDP
```powershell
python test_edge_templates.py
```
Esse teste valida:
1. Visibilidade e integridade dos botões na barra de ferramentas.
2. Salvamento e persistência de templates no servidor.
3. Sincronização dinâmica de tema Claro/Escuro (DOM + Canvas Chart.js).
4. Download do arquivo de template `.json`.
5. Carregamento e renderização de layouts a partir do arquivo de template.
