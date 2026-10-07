import asyncio
import json
import urllib.request
import websockets

async def run_tests():
    tabs_resp = urllib.request.urlopen("http://127.0.0.1:9222/json/list").read().decode()
    tabs = json.loads(tabs_resp)
    target_tab = next((t for t in tabs if "localhost:8080" in t.get("url", "")), tabs[0])
    ws_url = target_tab["webSocketDebuggerUrl"]

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
        await send("Console.enable")

        print("=== TESTE 1: Adicionar visual via botão '+' do item ===")
        add_script = """
        (() => {
            const firstQuickAdd = document.querySelector('.btn-quick-add');
            if (firstQuickAdd) {
                firstQuickAdd.click();
                return { clicked: true, newCardsCount: document.querySelectorAll('.visual-card-canvas').length };
            }
            return { clicked: false };
        })()
        """
        r1 = await send("Runtime.evaluate", {"expression": add_script, "returnByValue": True})
        print("Resultado Teste 1:", r1.get("result", {}).get("result", {}).get("value"))

        print("\n=== TESTE 2: Mudar tipo do último visual de KPI para Rosca ===")
        change_type_script = """
        (() => {
            const selects = document.querySelectorAll('.visual-type-select');
            const lastSelect = selects[selects.length - 1];
            if (lastSelect) {
                lastSelect.value = 'donut';
                lastSelect.dispatchEvent(new Event('change'));
                return {
                    changed: true,
                    newVal: lastSelect.value,
                    hasCanvas: !!document.getElementById('body_' + lastSelect.dataset.id).querySelector('canvas')
                };
            }
            return { changed: false };
        })()
        """
        r2 = await send("Runtime.evaluate", {"expression": change_type_script, "returnByValue": True})
        print("Resultado Teste 2:", r2.get("result", {}).get("result", {}).get("value"))

        print("\n=== TESTE 3: Trocar para Página 2 e voltar para Página 1 ===")
        page_test_script = """
        (() => {
            const tabs = document.querySelectorAll('.page-tab-item');
            tabs[1].click();
            const p2Cards = document.querySelectorAll('.visual-card-canvas').length;
            tabs[0].click();
            const p1Cards = document.querySelectorAll('.visual-card-canvas').length;
            return {
                page2Cards: p2Cards,
                page1CardsRestored: p1Cards
            };
        })()
        """
        r3 = await send("Runtime.evaluate", {"expression": page_test_script, "returnByValue": True})
        print("Resultado Teste 3:", r3.get("result", {}).get("result", {}).get("value"))

        print("\n=== TESTE 4: Criar nova página com o botão '+' ===")
        new_page_script = """
        (() => {
            document.getElementById('btn-add-new-page').click();
            const totalTabs = document.querySelectorAll('.page-tab-item').length;
            const activePageTitle = document.querySelector('.page-tab-item.active').textContent;
            return {
                totalTabs,
                activePageTitle
            };
        })()
        """
        r4 = await send("Runtime.evaluate", {"expression": new_page_script, "returnByValue": True})
        print("Resultado Teste 4:", r4.get("result", {}).get("result", {}).get("value"))

        print("\n=== TESTE 5: Excluir a nova página criada ===")
        del_page_script = """
        (() => {
            // Mock de confirm
            window.confirm = () => true;
            document.getElementById('btn-delete-active-page').click();
            return {
                totalTabsRemaining: document.querySelectorAll('.page-tab-item').length,
                activePageTitle: document.querySelector('.page-tab-item.active').textContent
            };
        })()
        """
        r5 = await send("Runtime.evaluate", {"expression": del_page_script, "returnByValue": True})
        print("Resultado Teste 5:", r5.get("result", {}).get("result", {}).get("value"))

        print("\n=== TESTE 6: Checar se houve qualquer erro no console ===")
        errors_script = """
        (() => {
            return {
                chartInstancesCount: Object.keys(state.chartInstances).length,
                visualsInActivePage: state.pages[state.activePageIndex].visuals.length,
                domCardsCount: document.querySelectorAll('.visual-card-canvas').length
            };
        })()
        """
        r6 = await send("Runtime.evaluate", {"expression": errors_script, "returnByValue": True})
        print("Consistência de Estado vs DOM:", r6.get("result", {}).get("result", {}).get("value"))

if __name__ == "__main__":
    asyncio.run(run_tests())
