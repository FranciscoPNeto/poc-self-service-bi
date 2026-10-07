"""
Skill Payload Generator - Suporte a Multi-Páginas, Drag & Drop e Seleção Dinâmica de Visualizações.
"""
from typing import List, Dict, Any

def generate_multi_page_payload(
    report_title: str = "Executive Mega Dashboard",
    pages: List[Dict[str, Any]] = None,
    theme: str = "Fabric Modern Clean"
) -> Dict[str, Any]:
    """
    Estrutura um relatório PBIR / Fabric App com múltiplas páginas.
    Cada página contém:
      - id, name
      - visuals: lista de widgets com suas posições, tipos (kpi, bar, line, pie, donut, table),
        datasetId, table, measure/dimension.
    """
    if not pages:
        pages = []

    datasets_referenced = {}

    formatted_pages = []
    for p_idx, page in enumerate(pages, 1):
        p_visuals = []
        for v_idx, w in enumerate(page.get("visuals", []), 1):
            ds_id = w.get("datasetId")
            if ds_id and ds_id not in datasets_referenced:
                datasets_referenced[ds_id] = {
                    "workspaceId": w.get("workspaceId", ""),
                    "datasetId": ds_id,
                    "datasetName": w.get("datasetName", "Semantic Model"),
                    "connectionMode": "LiveConnection"
                }

            visual_obj = {
                "id": w.get("id") or f"visual_{p_idx}_{v_idx}",
                "type": w.get("visualType", "kpi"),
                "title": w.get("title") or w.get("measure") or "Novo Visual",
                "dataset": {
                    "datasetId": ds_id,
                    "datasetName": w.get("datasetName")
                },
                "field": {
                    "table": w.get("table", "Medidas"),
                    "measure": w.get("measure"),
                    "dimension": w.get("dimension"),
                    "dax": f"[{w.get('table')}].[{w.get('measure') or w.get('dimension')}]"
                },
                "config": {
                    "chartType": w.get("visualType", "kpi"),
                    "color": w.get("color", "#0078D4"),
                    "colSpan": w.get("colSpan", 4 if w.get("visualType") != "kpi" else 3)
                }
            }
            p_visuals.append(visual_obj)

        formatted_pages.append({
            "id": page.get("id") or f"page_{p_idx}",
            "name": page.get("name") or f"Página {p_idx}",
            "visuals": p_visuals
        })

    payload = {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/1.0.0/schema.json",
        "theme": theme,
        "style": "PowerBI_FabricApp_Clean",
        "report": {
            "title": report_title,
            "architecture": "MultiDatasetHub",
            "datasets": list(datasets_referenced.values()),
            "pages": formatted_pages
        }
    }
    return payload

def generate_multi_dataset_payload(
    report_title: str = "Executive Mega Dashboard",
    theme: str = "Modern Minimalist",
    widgets: List[Dict[str, Any]] = None
) -> Dict[str, Any]:
    # Compatibilidade retroativa
    pages = [{"id": "page_1", "name": "Visão Geral", "visuals": widgets or []}]
    return generate_multi_page_payload(report_title, pages, theme)

def generate_payload(content):
    if isinstance(content, dict):
        pages = content.get("pages")
        if pages:
            return generate_multi_page_payload(
                report_title=content.get("reportTitle", "Executive App"),
                pages=pages,
                theme=content.get("theme", "Fabric Modern Clean")
            )
        return generate_multi_dataset_payload(
            report_title=content.get("reportTitle", "Executive Dashboard"),
            theme=content.get("theme", "Fabric Modern Clean"),
            widgets=content.get("widgets", [])
        )
    return content
