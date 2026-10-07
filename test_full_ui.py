import asyncio
import json
import urllib.request
import websockets

async def test_full_features():
    tabs = json.loads(urllib.request.urlopen("http://127.0.0.1:9222/json/list").read().decode())
    target = next((t for t in tabs if "localhost:8080" in t.get("url", "")), tabs[0])
    async with websockets.connect(target["webSocketDebuggerUrl"]) as ws:
        msg_id = 1
        async def send(method, params=None):
            nonlocal msg_id
            msg_id += 1
            payload = {"id": msg_id, "method": method, "params": params or {}}
            await ws.send(json.dumps(payload))
            while True:
                resp = await ws.recv()
                data = json.loads(resp)
                if data.get("id") == msg_id:
                    return data

        test_script = """
        (() => {
            // 1. Testar scroll da barra lateral
            const container = document.getElementById('dataset-fields-container');
            container.scrollTop = 500;
            const scrolledTop = container.scrollTop;

            // 2. Testar alternância para Modo Escuro
            const themeBtn = document.getElementById('btn-toggle-theme');
            themeBtn.click();
            const isDark = document.body.classList.contains('dark-mode');

            // 3. Testar seleção de card e customização
            const card = document.querySelector('.visual-card-canvas');
            card.click();
            const customPanelDisplay = document.getElementById('visual-customizer-panel').style.display;
            
            // Mudar título customizado
            const titleInput = document.getElementById('inp-custom-title');
            titleInput.value = 'Métrica Customizada Teste';
            titleInput.dispatchEvent(new Event('input'));
            const cardTitleUpdated = card.querySelector('.visual-card-title').textContent;

            // Mudar cor do card para Roxo (#5C2D91)
            const purpleDot = document.querySelector('[data-color="#5C2D91"]');
            if (purpleDot) purpleDot.click();
            const cardBorderColor = card.style.borderTop;

            return {
                scrolledTop,
                isDark,
                customPanelDisplay,
                cardTitleUpdated,
                cardBorderColor
            };
        })()
        """
        r = await send("Runtime.evaluate", {"expression": test_script, "returnByValue": True})
        print("RESULTADO TESTE COMPLETO:", json.dumps(r.get("result", {}).get("result", {}).get("value"), indent=2))

if __name__ == "__main__":
    asyncio.run(test_full_features())
