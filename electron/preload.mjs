import { contextBridge } from "electron";

const params = new URLSearchParams(window.location.search);
const apiBase = params.get("api") || "http://127.0.0.1:4173";

contextBridge.exposeInMainWorld("ledger", { apiBase });
