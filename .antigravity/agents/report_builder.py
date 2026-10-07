"""
Report Builder Agent
Gera o artefato final de definição de relatório (PBIR / Fabric App Definition)
com o tema Clean Power BI / Fabric App no diretório reports_output/.
"""
import os
import json
from typing import Dict, Any

def build_report_definition(payload: Dict[str, Any], output_filename: str = "report_fabric_app.json") -> str:
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "reports_output")
    output_dir = os.path.abspath(output_dir)
    os.makedirs(output_dir, exist_ok=True)
    
    file_path = os.path.join(output_dir, output_filename)
    
    # Tema Power BI / Microsoft Fabric Clean & Light
    theme_definition = {
        "name": "Fabric Modern Clean",
        "dataColors": [
            "#0078D4", "#107C41", "#5C2D91", "#D83B01",
            "#008272", "#B4009E", "#004E8C", "#498205"
        ],
        "background": "#F0F2F5",
        "foreground": "#201F1E",
        "tableAccent": "#0078D4",
        "visualStyles": {
            "*": {
                "*": {
                    "card": [
                        {
                            "backgroundColor": {"solid": {"color": "#FFFFFF"}},
                            "border": {"show": True, "color": "#E1DFDD", "radius": 6},
                            "dropShadow": {"show": True, "color": "rgba(0,0,0,0.04)", "blur": 8}
                        }
                    ],
                    "title": [
                        {
                            "fontSize": 12,
                            "fontFamily": "Segoe UI, -apple-system, sans-serif",
                            "color": "#605E5C",
                            "bold": False
                        }
                    ],
                    "labels": [
                        {
                            "fontSize": 24,
                            "fontFamily": "Segoe UI Semibold, -apple-system, sans-serif",
                            "color": "#201F1E"
                        }
                    ]
                }
            }
        }
    }
    
    final_output = {
        "reportDefinition": payload,
        "activeTheme": theme_definition,
        "metadata": {
            "generator": "report-builder-agent",
            "concept": "Microsoft Fabric App Multi-Dataset",
            "version": "2.0.0",
            "mode": "LiveConnection"
        }
    }
    
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=2, ensure_ascii=False)
        
    return file_path
