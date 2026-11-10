import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";

/**
 * OaaS.Quest - mapa de rotas.
 *
 * O nome do arquivo HTML e o nome da rota: index.html -> /, guilda.html -> /guilda,
 * classico.html -> /classico e descoberta/index.html -> /descoberta.
 * A mesma fonte de verdade alimenta o servidor de desenvolvimento, o build e os testes.
 */
export interface OaasRoute {
  readonly route: string;
  readonly entry: string;
  readonly pageId: string;
}

export const routes: readonly OaasRoute[] = [
  { route: "/", entry: "index.html", pageId: "home" },
  { route: "/guilda", entry: "guilda.html", pageId: "guild" },
  { route: "/classico", entry: "classico.html", pageId: "classic" },
  { route: "/descoberta", entry: "descoberta/index.html", pageId: "discovery" },
  { route: "/proposta", entry: "proposta/index.html", pageId: "proposal" }
];

const routeEntries = new Map<string, string>(routes.map(item => [item.route, item.entry] as const));

/**
 * Serve as rotas limpas no dev server e publica um diretorio por rota no build,
 * de modo que /guilda funcione em qualquer hospedagem estatica sem regra de rewrite.
 */
function oaasHtmlRoutes(): Plugin {
  let outDir = "dist";
  return {
    name: "oaas-html-routes",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, _res, next) => {
        const [pathname = "/", search] = (req.url ?? "/").split("?");
        const entry = routeEntries.get(pathname);
        if (!entry) {
          next();
          return;
        }
        req.url = "/" + entry + (search ? "?" + search : "");
        next();
      });
    },
    closeBundle() {
      for (const item of routes) {
        if (item.route === "/") continue;
        const source = resolve(outDir, item.entry);
        if (!existsSync(source)) continue;
        const directory = resolve(outDir, item.route.replace(/^\//, ""), "index.html");
        const flat = resolve(outDir, item.route.replace(/^\//, "") + ".html");
        // /rota/index.html: para hospedagens que resolvem diretorio.
        if (source !== directory) {
          mkdirSync(dirname(directory), { recursive: true });
          copyFileSync(source, directory);
        }
        // /rota.html: garante que /rota responda sem barra final em qualquer hospedagem.
        if (!existsSync(flat)) copyFileSync(source, flat);
      }
    }
  };
}

/**
 * O WSL monta /mnt/d via DrvFs, que nao suporta inotify: o watcher do Vite nunca
 * dispara e o hot reload nao acontece. Nesse caso o watcher passa a usar polling.
 */
const needsPolling = process.platform === "linux" && /^\/mnt\//.test(process.cwd());

export default defineConfig({
  appType: "mpa",
  plugins: [oaasHtmlRoutes()],
  server: {
    port: 5173,
    strictPort: false,
    watch: needsPolling ? { usePolling: true, interval: 300 } : null
  },
  preview: { port: 4173, strictPort: false },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(routes.map(item => [item.pageId, item.entry]))
    }
  }
});
