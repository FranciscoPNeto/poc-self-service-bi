import asyncio
import json
import urllib.request
import websockets

async def run_edge_tests():
    tabs_resp = urllib.request.urlopen("http://127.0.0.1:9222/json/list").read().decode()
    tabs = json.loads(tabs_resp)
    target_tab = next((t for t in tabs if "localhost:8080" in t.get("url", "")), tabs[0])
    ws_url = target_tab["webSocketDebuggerUrl"]

    print(f"Conectado à aba Edge: {target_tab.get('title')} ({target_tab.get('url')})")

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

        print("\n--- Recarregando página para garantir código mais recente ---")
        await send("Page.reload", {"ignoreCache": True})
        await asyncio.sleep(2.0)

        print("\n=== TESTE 1: Validar botões de Templates no DOM ===")
        check_buttons = """
        (() => {
            const btnExp = document.getElementById('btn-export-template');
            const btnModal = document.getElementById('btn-open-templates-modal');
            return {
                btnExportExists: !!btnExp,
                btnExportVisible: btnExp && btnExp.offsetParent !== null,
                btnModalExists: !!btnModal,
                btnModalVisible: btnModal && btnModal.offsetParent !== null
            };
        })()
        """
        r1 = await send("Runtime.evaluate", {"expression": check_buttons, "returnByValue": True})
        print("Resultado Teste 1:", r1.get("result", {}).get("result", {}).get("value"))

        print("\n=== TESTE 2: Abrir modal de templates e salvar um template no servidor ===")
        save_tmpl_script = """
        (async () => {
            document.getElementById('btn-open-templates-modal').click();
            const modal = document.getElementById('modal-templates');
            const isModalOpen = modal.classList.contains('open');

            const nameInput = document.getElementById('inp-save-template-name');
            nameInput.value = 'Template Executivo Hospitalar Teste';

            document.getElementById('btn-save-as-template').click();
            await new Promise(r => setTimeout(r, 600));

            return {
                modalOpened: isModalOpen,
                templatesRendered: document.getElementById('templates-list-container').children.length
            };
        })()
        """
        r2 = await send("Runtime.evaluate", {"expression": save_tmpl_script, "awaitPromise": True, "returnByValue": True})
        print("Resultado Teste 2:", r2.get("result", {}).get("result", {}).get("value"))

        print("\n=== TESTE 3: Alterar tema para Dark Mode e validar sincronização visual ===")
        theme_script = """
        (() => {
            document.getElementById('btn-toggle-theme').click();
            return {
                isDark: document.body.classList.contains('dark-mode'),
                themeInState: state.theme,
                storedInStorage: localStorage.getItem('fabric_theme')
            };
        })()
        """
        r3 = await send("Runtime.evaluate", {"expression": theme_script, "returnByValue": True})
        print("Resultado Teste 3:", r3.get("result", {}).get("result", {}).get("value"))

        print("\n=== TESTE 4: Testar exportação/download de arquivo JSON de metadados ===")
        export_script = """
        (() => {
            let triggeredDownload = false;
            const originalCreateElement = document.createElement;
            document.createElement = function(tag) {
                const el = originalCreateElement.call(document, tag);
                if (tag.toLowerCase() === 'a') {
                    el.click = function() {
                        if (el.getAttribute('download') && el.getAttribute('href').startsWith('data:text/json')) {
                            triggeredDownload = true;
                        }
                    };
                }
                return el;
            };

            document.getElementById('btn-export-template').click();
            document.createElement = originalCreateElement;

            return {
                triggeredDownload: triggeredDownload,
                activePagesCount: state.pages.length
            };
        })()
        """
        r4 = await send("Runtime.evaluate", {"expression": export_script, "returnByValue": True})
        print("Resultado Teste 4:", r4.get("result", {}).get("result", {}).get("value"))

        print("\n=== TESTE 5: Aplicar template e validar consistência de abas e canvas ===")
        apply_script = """
        (async () => {
            const firstLoadBtn = document.querySelector('#templates-list-container button');
            if (firstLoadBtn) {
                firstLoadBtn.click();
                await new Promise(r => setTimeout(r, 600));
                return {
                    applied: true,
                    activePageTitle: state.pages[state.activePageIndex].name,
                    cardsCount: document.querySelectorAll('.visual-card-canvas').length
                };
            }
            return { applied: false };
        })()
        """
        r5 = await send("Runtime.evaluate", {"expression": apply_script, "awaitPromise": True, "returnByValue": True})
        print("Resultado Teste 5:", r5.get("result", {}).get("result", {}).get("value"))

if __name__ == "__main__":
    asyncio.run(run_edge_tests())
