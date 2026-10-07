"""
Servidor Backend da aplicação Self-Service BI PoC (Fabric App Style).
Multi-dataset na mesma tela com suporte a:
- No-Cache headers para evitar que o navegador sirva JS ou CSS defasados
- Múltiplas páginas (adicionar, renomear, salvar, alternar)
- Drag & Drop de campos para gerar visuais
- Escolha dinâmica do tipo de visual (KPI Card, Barras, Linhas, Rosca/Donut, Área, Tabela)
- Persistência e exportação de relatórios
"""
import os
import sys
import json
import base64
import urllib.request
import re
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler
import importlib.util

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)

# Importar bridge do Fabric MCP
sys.path.append(r"c:\Users\Francisco Neto\Desktop\Engenharia de IA\fabric-core-mcp-remote")
try:
    import fabric_mcp_bridge
except ImportError:
    fabric_mcp_bridge = None

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

skill_path = os.path.join(PROJECT_ROOT, ".antigravity", "skills", "skill_payload_generator.py")
builder_path = os.path.join(PROJECT_ROOT, ".antigravity", "agents", "report_builder.py")

skill_payload_generator = load_module("skill_payload_generator", skill_path)
report_builder = load_module("report_builder", builder_path)

DATASETS_REGISTRY_FILE = os.path.join(PROJECT_ROOT, "config", "datasets_registry.json")
CACHE_DIR = os.path.join(PROJECT_ROOT, "config", "schemas_cache")
APP_STATE_FILE = os.path.join(PROJECT_ROOT, "config", "saved_dashboard_pages.json")
os.makedirs(CACHE_DIR, exist_ok=True)

def load_datasets_registry():
    if os.path.exists(DATASETS_REGISTRY_FILE):
        try:
            with open(DATASETS_REGISTRY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    initial = [
        {
            "id": "8195add5-dc47-4ad3-a3f7-78943b9ce122",
            "workspaceId": "5015771e-8558-4bd6-8392-b70bf61d7b15",
            "displayName": "Atendimento Laboratorial",
            "description": "Faturamento hospitalar, atendimentos, metas e convênios",
            "color": "#0078D4",
            "source": "Fabric MCP"
        },
        {
            "id": "1a743416-65a2-4685-ba14-719429802c41",
            "workspaceId": "5015771e-8558-4bd6-8392-b70bf61d7b15",
            "displayName": "Infotransito Recife",
            "description": "Sinistros de trânsito, médias diárias e bairros",
            "color": "#107C41",
            "source": "Fabric MCP"
        }
    ]
    save_datasets_registry(initial)
    return initial

def save_datasets_registry(datasets):
    with open(DATASETS_REGISTRY_FILE, "w", encoding="utf-8") as f:
        json.dump(datasets, f, indent=2, ensure_ascii=False)

def inspect_dataset_schema(workspace_id: str, item_id: str, force_refresh: bool = False):
    cache_file = os.path.join(CACHE_DIR, f"{item_id}.json")
    if not force_refresh and os.path.exists(cache_file):
        try:
            with open(cache_file, "r", encoding="utf-8") as cf:
                return json.load(cf)
        except Exception:
            pass

    if not force_refresh and item_id == "8195add5-dc47-4ad3-a3f7-78943b9ce122":
        legacy_cache = os.path.join(PROJECT_ROOT, "schema_discovered.json")
        if os.path.exists(legacy_cache):
            with open(legacy_cache, "r", encoding="utf-8") as lf:
                ld = json.load(lf)
                schema_res = {
                    "workspaceId": workspace_id,
                    "datasetId": item_id,
                    "tables": ld.get("tables", []),
                    "measures": ld.get("measures", []),
                    "columnsByTable": ld.get("columns_by_table", {})
                }
                with open(cache_file, "w", encoding="utf-8") as out:
                    json.dump(schema_res, out, indent=2, ensure_ascii=False)
                return schema_res

    if not fabric_mcp_bridge:
        raise RuntimeError("Fabric MCP bridge indisponível.")

    req = {
        "jsonrpc": "2.0",
        "id": int(time.time()),
        "method": "tools/call",
        "params": {
            "name": "get_item_definition",
            "arguments": {"WorkspaceId": workspace_id, "ItemId": item_id}
        }
    }
    raw_resp = fabric_mcp_bridge.send_to_fabric(json.dumps(req).encode("utf-8"))
    resp_obj = json.loads(raw_resp.decode("utf-8"))

    op_url = None
    for item in resp_obj.get("result", {}).get("content", []):
        t = item.get("text", "")
        for line in t.splitlines():
            if line.startswith("Location:"):
                op_url = line.split("Location:", 1)[1].strip()

    if not op_url:
        raise RuntimeError("Não foi possível iniciar extração TMDL.")

    token = fabric_mcp_bridge.get_token()
    headers = {"Authorization": f"Bearer {token}"}

    tmdl_data = None
    for _ in range(12):
        time.sleep(2)
        req_op = urllib.request.Request(op_url, headers=headers)
        with urllib.request.urlopen(req_op) as r:
            st = json.loads(r.read().decode("utf-8"))
            if st.get("status") == "Succeeded":
                res_url = op_url + "/result"
                req_res = urllib.request.Request(res_url, headers=headers)
                with urllib.request.urlopen(req_res) as r2:
                    tmdl_data = json.loads(r2.read().decode("utf-8"))
                break
            elif st.get("status") == "Failed":
                raise RuntimeError("Falha na extração TMDL.")

    if not tmdl_data:
        raise TimeoutError("Timeout ao aguardar TMDL.")

    parts = tmdl_data.get("definition", {}).get("parts", [])
    tables = []
    measures = []
    columns_by_table = {}

    for part in parts:
        path = part.get("path", "")
        payload = part.get("payload", "")
        if part.get("payloadType") == "InlineBase64":
            content = base64.b64decode(payload).decode("utf-8", errors="replace")
        else:
            content = payload

        if "definition/tables/" in path:
            table_match = re.search(r"table\s+([^\r\n]+)", content)
            table_name = table_match.group(1).strip() if table_match else path.split("/")[-1].replace(".tmdl", "")
            table_name = table_name.strip("'\"")
            tables.append(table_name)

            t_measures = re.findall(r"^\s*measure\s+(?:(?:'([^']+)')|([^\s=]+))\s*=", content, re.MULTILINE)
            for m1, m2 in t_measures:
                m_name = (m1 or m2).strip()
                if m_name:
                    measures.append({"table": table_name, "measure": m_name})

            t_cols = re.findall(r"^\s*column\s+(?:(?:'([^']+)')|([^\s\r\n]+))", content, re.MULTILINE)
            cols = [(c1 or c2).strip() for c1, c2 in t_cols if (c1 or c2)]
            columns_by_table[table_name] = cols

    result = {
        "workspaceId": workspace_id,
        "datasetId": item_id,
        "tables": tables,
        "measures": measures,
        "columnsByTable": columns_by_table
    }

    with open(cache_file, "w", encoding="utf-8") as out:
        json.dump(result, out, indent=2, ensure_ascii=False)

    return result

def load_saved_pages():
    if os.path.exists(APP_STATE_FILE):
        try:
            with open(APP_STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    initial_pages = [
        {
            "id": "page_overview",
            "name": "Visão Executiva Geral",
            "visuals": [
                {
                    "id": "v1",
                    "visualType": "kpi",
                    "datasetId": "8195add5-dc47-4ad3-a3f7-78943b9ce122",
                    "workspaceId": "5015771e-8558-4bd6-8392-b70bf61d7b15",
                    "datasetName": "Atendimento Laboratorial",
                    "color": "#0078D4",
                    "table": "Medidas",
                    "measure": "Faturamento",
                    "title": "Faturamento Total",
                    "value": "R$ 1.842.500",
                    "colSpan": 3
                },
                {
                    "id": "v2",
                    "visualType": "kpi",
                    "datasetId": "8195add5-dc47-4ad3-a3f7-78943b9ce122",
                    "workspaceId": "5015771e-8558-4bd6-8392-b70bf61d7b15",
                    "datasetName": "Atendimento Laboratorial",
                    "color": "#0078D4",
                    "table": "Medidas",
                    "measure": "Atendimentos",
                    "title": "Total Atendimentos",
                    "value": "14.820",
                    "colSpan": 3
                },
                {
                    "id": "v3",
                    "visualType": "kpi",
                    "datasetId": "1a743416-65a2-4685-ba14-719429802c41",
                    "workspaceId": "5015771e-8558-4bd6-8392-b70bf61d7b15",
                    "datasetName": "Infotransito Recife",
                    "color": "#107C41",
                    "table": "Medidas",
                    "measure": "QTD de acidentes",
                    "title": "Sinistros de Trânsito",
                    "value": "3.421",
                    "colSpan": 3
                },
                {
                    "id": "v4",
                    "visualType": "kpi",
                    "datasetId": "1a743416-65a2-4685-ba14-719429802c41",
                    "workspaceId": "5015771e-8558-4bd6-8392-b70bf61d7b15",
                    "datasetName": "Infotransito Recife",
                    "color": "#107C41",
                    "table": "Medidas",
                    "measure": "Media_Acidentes_Por_Dia",
                    "title": "Média Acidentes / Dia",
                    "value": "9,4 / dia",
                    "colSpan": 3
                },
                {
                    "id": "v5",
                    "visualType": "bar",
                    "datasetId": "8195add5-dc47-4ad3-a3f7-78943b9ce122",
                    "workspaceId": "5015771e-8558-4bd6-8392-b70bf61d7b15",
                    "datasetName": "Atendimento Laboratorial",
                    "color": "#0078D4",
                    "table": "Medidas",
                    "measure": "Faturamento",
                    "dimension": "NomeMes",
                    "title": "Faturamento por Mês (Laboratório)",
                    "colSpan": 6
                },
                {
                    "id": "v6",
                    "visualType": "line",
                    "datasetId": "1a743416-65a2-4685-ba14-719429802c41",
                    "workspaceId": "5015771e-8558-4bd6-8392-b70bf61d7b15",
                    "datasetName": "Infotransito Recife",
                    "color": "#107C41",
                    "table": "Medidas",
                    "measure": "QTD de acidentes",
                    "dimension": "bairro",
                    "title": "Ocorrências por Bairro (Trânsito)",
                    "colSpan": 6
                }
            ]
        },
        {
            "id": "page_health",
            "name": "Detalhamento Laboratório",
            "visuals": [
                {
                    "id": "vh1",
                    "visualType": "kpi",
                    "datasetId": "8195add5-dc47-4ad3-a3f7-78943b9ce122",
                    "workspaceId": "5015771e-8558-4bd6-8392-b70bf61d7b15",
                    "datasetName": "Atendimento Laboratorial",
                    "color": "#0078D4",
                    "table": "Medidas",
                    "measure": "Meta Faturamento",
                    "title": "Meta Faturamento",
                    "value": "R$ 1.950.000",
                    "colSpan": 3
                },
                {
                    "id": "vh2",
                    "visualType": "kpi",
                    "datasetId": "8195add5-dc47-4ad3-a3f7-78943b9ce122",
                    "workspaceId": "5015771e-8558-4bd6-8392-b70bf61d7b15",
                    "datasetName": "Atendimento Laboratorial",
                    "color": "#0078D4",
                    "table": "Medidas",
                    "measure": "Atingimento de meta",
                    "title": "Atingimento de Meta",
                    "value": "94.5%",
                    "colSpan": 3
                },
                {
                    "id": "vh3",
                    "visualType": "donut",
                    "datasetId": "8195add5-dc47-4ad3-a3f7-78943b9ce122",
                    "workspaceId": "5015771e-8558-4bd6-8392-b70bf61d7b15",
                    "datasetName": "Atendimento Laboratorial",
                    "color": "#0078D4",
                    "table": "Medidas",
                    "measure": "Faturamento",
                    "dimension": "Convênio",
                    "title": "Distribuição por Convênio",
                    "colSpan": 6
                }
            ]
        }
    ]
    save_pages_state(initial_pages)
    return initial_pages

def save_pages_state(pages):
    with open(APP_STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(pages, f, indent=2, ensure_ascii=False)

class SelfServiceHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        # Previne cache rígido do navegador
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        if self.path == "/api/datasets":
            datasets = load_datasets_registry()
            self.send_json({"datasets": datasets})
        elif self.path == "/api/all-schemas" or self.path.startswith("/api/all-schemas?"):
            force_refresh = "force=true" in self.path or "refresh=true" in self.path
            datasets = load_datasets_registry()
            combined = []
            for ds in datasets:
                try:
                    s = inspect_dataset_schema(ds["workspaceId"], ds["id"], force_refresh=force_refresh)
                    combined.append({"dataset": ds, "schema": s})
                except Exception as e:
                    combined.append({"dataset": ds, "error": str(e)})
            self.send_json({"items": combined, "refreshed": force_refresh})
        elif self.path == "/api/pages":
            pages = load_saved_pages()
            self.send_json({"pages": pages})
        elif self.path == "/api/templates":
            self.handle_list_templates()
        elif self.path.startswith("/api/reports"):
            self.handle_get_reports()
        else:
            if self.path == "/":
                self.path = "/index.html"
            app_dir = os.path.join(PROJECT_ROOT, "app")
            file_to_serve = os.path.normpath(os.path.join(app_dir, self.path.lstrip("/")))
            if os.path.commonprefix([file_to_serve, app_dir]) == app_dir and os.path.exists(file_to_serve):
                return super().do_GET()
            else:
                self.send_error(404, "Arquivo não encontrado")

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
        try:
            payload_data = json.loads(body)
        except Exception:
            payload_data = {}

        if self.path == "/api/datasets":
            self.handle_add_dataset(payload_data)
        elif self.path == "/api/refresh-schemas":
            self.handle_refresh_schemas(payload_data)
        elif self.path == "/api/pages":
            self.handle_save_pages(payload_data)
        elif self.path == "/api/templates/save":
            self.handle_save_template(payload_data)
        elif self.path == "/api/templates/load":
            self.handle_load_template(payload_data)
        elif self.path == "/api/generate-mega-report":
            self.handle_generate_mega_report(payload_data)
        else:
            self.send_error(404, "Endpoint não encontrado")

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def handle_save_pages(self, data):
        pages = data.get("pages", [])
        save_pages_state(pages)
        self.send_json({"success": True, "pages": pages})

    def handle_refresh_schemas(self, data):
        try:
            target_id = data.get("datasetId")
            datasets = load_datasets_registry()
            updated = []
            for ds in datasets:
                if not target_id or ds["id"] == target_id:
                    s = inspect_dataset_schema(ds["workspaceId"], ds["id"], force_refresh=True)
                    updated.append({"dataset": ds, "schema": s})
                else:
                    s = inspect_dataset_schema(ds["workspaceId"], ds["id"], force_refresh=False)
                    updated.append({"dataset": ds, "schema": s})
            self.send_json({"success": True, "items": updated})
        except Exception as e:
            self.send_json({"error": str(e)}, status=500)

    def handle_list_templates(self):
        templates_dir = os.path.join(PROJECT_ROOT, "config", "templates")
        os.makedirs(templates_dir, exist_ok=True)
        items = []
        for fname in os.listdir(templates_dir):
            if fname.endswith(".json"):
                fpath = os.path.join(templates_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as tf:
                        tdata = json.load(tf)
                        items.append({
                            "fileName": fname,
                            "templateName": tdata.get("name", fname.replace(".json", "")),
                            "description": tdata.get("description", ""),
                            "totalPages": len(tdata.get("pages", [])),
                            "created": tdata.get("createdAt", "")
                        })
                except Exception:
                    pass
        self.send_json({"templates": items})

    def handle_save_template(self, data):
        try:
            templates_dir = os.path.join(PROJECT_ROOT, "config", "templates")
            os.makedirs(templates_dir, exist_ok=True)
            name = data.get("name", "Template").strip()
            clean_name = re.sub(r'[^a-zA-Z0-9_-]', '_', name.lower())
            if not clean_name:
                clean_name = f"template_{int(time.time())}"
            fname = f"{clean_name}.json"
            fpath = os.path.join(templates_dir, fname)

            metadata_template = {
                "schemaVersion": "1.0-fabric-metadata-template",
                "name": name,
                "description": data.get("description", "Template de layout corporativo reutilizável"),
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "theme": data.get("theme", "light"),
                "pages": data.get("pages", [])
            }

            with open(fpath, "w", encoding="utf-8") as out:
                json.dump(metadata_template, out, indent=2, ensure_ascii=False)

            self.send_json({"success": True, "fileName": fname, "template": metadata_template})
        except Exception as e:
            self.send_json({"error": str(e)}, status=500)

    def handle_load_template(self, data):
        try:
            templates_dir = os.path.join(PROJECT_ROOT, "config", "templates")
            fname = data.get("fileName", "")
            if not fname:
                self.send_json({"error": "fileName é obrigatório"}, status=400)
                return
            fpath = os.path.normpath(os.path.join(templates_dir, fname))
            if not os.path.exists(fpath) or not fpath.startswith(templates_dir):
                self.send_json({"error": "Template não encontrado"}, status=404)
                return
            with open(fpath, "r", encoding="utf-8") as f:
                template_data = json.load(f)

            # Opcionalmente já atualiza o estado atual das páginas se solicitado
            if data.get("applyNow", True):
                pages = template_data.get("pages", [])
                if pages:
                    save_pages_state(pages)

            self.send_json({"success": True, "template": template_data})
        except Exception as e:
            self.send_json({"error": str(e)}, status=500)

    def handle_add_dataset(self, data):
        try:
            workspace_id = data.get("workspaceId", "").strip()
            dataset_id = data.get("datasetId", "").strip()
            display_name = data.get("displayName", "").strip()
            description = data.get("description", "").strip()

            if not workspace_id or not dataset_id:
                self.send_json({"error": "workspaceId e datasetId são obrigatórios."}, status=400)
                return

            datasets = load_datasets_registry()
            existing = next((d for d in datasets if d["id"] == dataset_id), None)
            
            palette = ["#0078D4", "#107C41", "#5C2D91", "#D83B01", "#008272", "#B4009E"]
            color = palette[len(datasets) % len(palette)]

            if existing:
                existing["displayName"] = display_name or existing.get("displayName")
                existing["workspaceId"] = workspace_id
                existing["description"] = description
            else:
                datasets.append({
                    "id": dataset_id,
                    "workspaceId": workspace_id,
                    "displayName": display_name or f"Dataset {dataset_id[:8]}",
                    "description": description or "Dataset adicionado via Fabric App Hub",
                    "color": color,
                    "source": "Fabric MCP"
                })

            save_datasets_registry(datasets)
            self.send_json({"success": True, "datasets": datasets})
        except Exception as e:
            self.send_json({"error": str(e)}, status=500)

    def handle_generate_mega_report(self, data):
        try:
            report_title = data.get("reportTitle", "Mega Dataset Executive App")
            theme = data.get("theme", "Fabric Modern Clean")
            pages = data.get("pages", [])

            payload = skill_payload_generator.generate_multi_page_payload(
                report_title=report_title,
                pages=pages,
                theme=theme
            )

            clean_title = re.sub(r'[^a-zA-Z0-9_-]', '_', report_title.lower())
            filename = f"fabric_app_{clean_title}_{int(time.time())}.json"
            file_path = report_builder.build_report_definition(payload, filename)

            self.send_json({
                "success": True,
                "filePath": file_path,
                "fileName": filename,
                "payload": payload
            })
        except Exception as e:
            self.send_json({"error": str(e)}, status=500)

    def handle_get_reports(self):
        reports_dir = os.path.join(PROJECT_ROOT, "reports_output")
        reports = []
        if os.path.exists(reports_dir):
            for fname in os.listdir(reports_dir):
                if fname.endswith(".json"):
                    fpath = os.path.join(reports_dir, fname)
                    try:
                        with open(fpath, "r", encoding="utf-8") as rf:
                            content = json.load(rf)
                            reports.append({
                                "fileName": fname,
                                "title": content.get("reportDefinition", {}).get("report", {}).get("title", fname),
                                "mode": content.get("metadata", {}).get("concept", "Standard")
                            })
                    except Exception:
                        pass
        self.send_json({"reports": reports})

def run_server(port=8080):
    os.chdir(os.path.join(PROJECT_ROOT, "app"))
    server_address = ("", port)
    httpd = HTTPServer(server_address, SelfServiceHandler)
    print(f"Fabric App Hub Server running at http://localhost:{port}/")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_server(port)
