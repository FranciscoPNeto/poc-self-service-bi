import asyncio
import json
import urllib.request
import websockets

async def check_charts():
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
        
        # Voltar para página 0 (Visão Geral que tem gráficos) e checar os canvas
        eval_script = """
        (() => {
            document.querySelectorAll('.page-tab-item')[0].click();
            return new Promise(resolve => {
                setTimeout(() => {
                    const canvases = document.querySelectorAll('canvas');
                    const canvasInfo = Array.from(canvases).map(c => ({
                        id: c.id,
                        width: c.width,
                        height: c.height,
                        clientWidth: c.clientWidth,
                        clientHeight: c.clientHeight
                    }));
                    resolve({
                        activePageIndex: state.activePageIndex,
                        canvasesCount: canvases.length,
                        chartInstancesKeys: Object.keys(state.chartInstances),
                        canvases: canvasInfo
                    });
                }, 300);
            });
        })()
        """
        r = await send("Runtime.evaluate", {"expression": eval_script, "awaitPromise": True, "returnByValue": True})
        print("Status dos Gráficos na Página 1:", json.dumps(r.get("result", {}).get("result", {}).get("value"), indent=2))

if __name__ == "__main__":
    asyncio.run(check_charts())
