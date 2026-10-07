# Fabric Executive Studio - Self-Service BI (Multi-Dataset)

Aplicação corporativa inspirada no **Microsoft Fabric / Power BI Desktop** para criação visual de relatórios executivos conectados via **Live Connection** a modelos semânticos do Fabric.

Consulte a documentação completa com todas as regras de negócio e arquitetura em [DOCUMENTATION.md](file:///c:/Users/Francisco%20Neto/Desktop/Projetos/PowerAPPS/poc-self-service-bi/DOCUMENTATION.md).

## Destaques do Projeto:
- **Multi-Dataset Canvas:** Combine múltiplos modelos semânticos na mesma tela.
- **Dark Mode & Light Mode:** Alternância completa de tema com adaptação em tempo real dos gráficos.
- **Templates de Metadados:** Exportação e importação de layouts em JSON reutilizáveis sem expor dados confidenciais.
- **Live Connection:** Arquitetura limpa conectada ao Fabric via TMDL.
## Deploy no Render (Web Service)
Para publicar a aplicação em produção no **Render**:
- **Environment:** `Python 3`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `python app/server.py`
- **Health Check Path:** `/health`
- **Variáveis de Ambiente (opcionais para sincronização live no Fabric):**
  - `AZURE_CLIENT_ID` (ou `CLIENT_ID`)
  - `AZURE_CLIENT_SECRET` (ou `CLIENT_SECRET`)
  - `AZURE_TENANT_ID` (ou `TENANT_ID`)
  - ou `FABRIC_TOKEN` diretamente.
  *(A aplicação possui fallback automático para os schemas cacheados em `config/schemas_cache/`, garantindo 100% de disponibilidade mesmo em modo offline/demonstração).*
