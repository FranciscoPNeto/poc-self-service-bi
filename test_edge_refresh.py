import asyncio
import json
import urllib.request
import websockets

async def run_refresh_tests():
    tabs_resp = urllib.request.urlopen("http://127.0.0.1:9222/json/list").read().decode()
    tabs = json.loads(tabs_resp)
    target_tab = next((t for t in tabs if "localhost:8080" in t.get("url", "")), tabs[0])
    ws_url = target_tab["webSocketDebuggerUrl"]

    print(f"Conectado à aba Edge: {target_tab.get('title')}")

    async with websockets.connect(ws_url) as ws:
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

        await send("Runtime.enable")
        await send("Page.enable")

        print("\n--- Recarregando página para aplicar novos scripts ---")
        await send("Page.reload", {"ignoreCache": True})
        await asyncio.sleep(2.0)

        print("\n=== TESTE 1: Verificar elementos do menu de Atualizar no DOM ===")
        check_elements = """
        (() => {
            const btnMenu = document.getElementById('btn-refresh-menu');
            const dropdownWrapper = document.getElementById('dropdown-refresh-wrapper');
            const btnVis = document.getElementById('btn-refresh-visuals');
            const btnSem = document.getElementById('btn-refresh-semantic-models');
            const btnAll = document.getElementById('btn-refresh-all');
            const btnQuick = document.getElementById('btn-quick-refresh-schemas');

            return {
                btnMenuExists: !!btnMenu,
                dropdownExists: !!dropdownWrapper,
                btnVisExists: !!btnVis,
                btnSemExists: !!btnSem,
                btnAllExists: !!btnAll,
                btnQuickExists: !!btnQuick
            };
        })()
        """
        r1 = await send("Runtime.evaluate", {"expression": check_elements, "returnByValue": True})
        print("Resultado Teste 1:", r1.get("result", {}).get("result", {}).get("value"))

        print("\n=== TESTE 2: Abrir Dropdown de Atualização ===")
        open_dropdown = """
        (() => {
            document.getElementById('btn-refresh-menu').click();
            const wrapper = document.getElementById('dropdown-refresh-wrapper');
            return {
                isOpen: wrapper.classList.contains('open')
            };
        })()
        """
        r2 = await send("Runtime.evaluate", {"expression": open_dropdown, "returnByValue": True})
        print("Resultado Teste 2:", r2.get("result", {}).get("result", {}).get("value"))

        print("\n=== TESTE 3: Disparar Atualização de Visuais ===")
        refresh_vis = """
        (() => {
            const initialInstances = Object.keys(state.chartInstances).length;
            document.getElementById('btn-refresh-visuals').click();
            return {
                activePageIndex: state.activePageIndex,
                visualsCount: state.pages[state.activePageIndex].visuals.length,
                initialInstances: initialInstances
            };
        })()
        """
        r3 = await send("Runtime.evaluate", {"expression": refresh_vis, "returnByValue": True})
        print("Resultado Teste 3:", r3.get("result", {}).get("result", {}).get("value"))
        await asyncio.sleep(1.0)

        print("\n=== TESTE 4: Disparar Atualização de Modelo Semântico ===")
        refresh_sem = """
        (async () => {
            document.getElementById('btn-refresh-menu').click();
            document.getElementById('btn-refresh-semantic-models').click();
            await new Promise(r => setTimeout(r, 1000));
            return {
                datasetsLoaded: state.datasetsWithSchemas.length,
                badgeText: document.getElementById('total-datasets-badge').textContent
            };
        })()
        """
        r4 = await send("Runtime.evaluate", {"expression": refresh_sem, "awaitPromise": True, "returnByValue": True})
        print("Resultado Teste 4:", r4.get("result", {}).get("result", {}).get("value"))

        print("\n=== TESTE 5: Disparar Atualização Completa ===")
        refresh_all = """
        (async () => {
            document.getElementById('btn-refresh-menu').click();
            document.getElementById('btn-refresh-all').click();
            await new Promise(r => setTimeout(r, 1200));
            return {
                completed: true,
                domCardsCount: document.querySelectorAll('.visual-card-canvas').length
            };
        })()
        """
        r5 = await send("Runtime.evaluate", {"expression": refresh_all, "awaitPromise": True, "returnByValue": True})
        print("Resultado Teste 5:", r5.get("result", {}).get("result", {}).get("value"))

if __name__ == "__main__":
    asyncio.run(run_refresh_tests())
