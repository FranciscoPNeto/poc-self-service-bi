import sys
import json
import base64
import urllib.request
import re

sys.path.append(r'c:\Users\Francisco Neto\Desktop\Engenharia de IA\fabric-core-mcp-remote')
import fabric_mcp_bridge

token = fabric_mcp_bridge.get_token()
op_url = 'https://api.fabric.microsoft.com/v1/operations/09f7d9bf-6cee-4e2d-a479-4b027c908660/result'
headers = {'Authorization': f'Bearer {token}'}

req = urllib.request.Request(op_url, headers=headers)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode('utf-8'))

parts = data.get('definition', {}).get('parts', [])
tables = []
measures = []
columns_by_table = {}

for part in parts:
    path = part.get('path', '')
    payload = part.get('payload', '')
    if part.get('payloadType') == 'InlineBase64':
        content = base64.b64decode(payload).decode('utf-8', errors='replace')
    else:
        content = payload
    
    if 'definition/tables/' in path:
        table_match = re.search(r'table\s+([^\r\n]+)', content)
        table_name = table_match.group(1).strip() if table_match else path.split('/')[-1].replace('.tmdl', '')
        table_name = table_name.strip('\'"')
        tables.append(table_name)
        
        # Encontrar medidas
        t_measures = re.findall(r'^\s*measure\s+(?:(?:\'([^\']+)\')|([^\s=]+))\s*=', content, re.MULTILINE)
        for m1, m2 in t_measures:
            m_name = m1 or m2
            measures.append({'table': table_name, 'measure': m_name})
            
        # Encontrar colunas
        t_cols = re.findall(r'^\s*column\s+(?:(?:\'([^\']+)\')|([^\s\r\n]+))', content, re.MULTILINE)
        cols = [(c1 or c2) for c1, c2 in t_cols]
        columns_by_table[table_name] = cols

output_dict = {
    'tables': tables,
    'total_tables': len(tables),
    'measures': measures,
    'total_measures': len(measures),
    'columns_by_table': columns_by_table
}

with open('schema_discovered.json', 'w', encoding='utf-8') as out:
    json.dump(output_dict, out, indent=2, ensure_ascii=False)

print(f"Total Tabelas: {len(tables)}")
print(f"Total Medidas: {len(measures)}")
