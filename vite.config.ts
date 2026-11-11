import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";

/**
 * OaaS.Quest - mapa de rotas.
 *
 * O nome do arquivo HTML e o nome da rota: index.html -> /, chat.html -> /chat,
 * site.html -> /site e descoberta/index.html -> /descoberta.
 * A mesma fonte de verdade alimenta o servidor de desenvolvimento, o build e os testes.
 */
export interface OaasRoute {
  readonly route: string;
  readonly entry: string;
  readonly pageId: string;
}

export const routes: readonly OaasRoute[] = [
  { route: "/", entry: "index.html", pageId: "home" },
  { route: "/chat", entry: "chat.html", pageId: "chat" },
  { route: "/site", entry: "site.html", pageId: "site" },
  { route: "/descoberta", entry: "descoberta/index.html", pageId: "discovery" },
  { route: "/exemplos", entry: "exemplos.html", pageId: "exemplos" }
];

const routeEntries = new Map<string, string>(routes.map(item => [item.route, item.entry] as const));

/**
 * Serve as rotas limpas no dev server e publica um diretorio por rota no build,
 * de modo que /chat funcione em qualquer hospedagem estatica sem regra de rewrite.
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
 * Manifesto de assets por pagina: quais folhas de estilo cada rota carrega.
 * O roteador client-side usa esse mapa para trocar o CSS junto com o conteudo.
 * No dev ele e gerado a partir do HTML de entrada; no build, do HTML processado
 * — onde os arquivos tem nome com hash.
 */
function oaasAssetsManifest(): Plugin {
  const readAssets = (html: string) => ({
    styles: [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)]
      .map(match => match[1])
      .filter((href): href is string => Boolean(href)),
    scripts: [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
      .map(match => match[1])
      .filter((src): src is string => Boolean(src))
  });
  let outDir = "dist";
  return {
    name: "oaas-assets-manifest",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? "").split("?")[0];
        if (pathname !== "/oaas-assets.json") {
          next();
          return;
        }
        const map: Record<string, { styles: string[]; scripts: string[] }> = {};
        for (const item of routes) {
          const entry = resolve(server.config.root, item.entry);
          if (!existsSync(entry)) continue;
          map[item.pageId] = readAssets(readFileSync(entry, "utf8"));
        }
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(map));
      });
    },
    closeBundle() {
      const map: Record<string, { styles: string[]; scripts: string[] }> = {};
      for (const item of routes) {
        const built = resolve(outDir, item.entry);
        if (!existsSync(built)) continue;
        map[item.pageId] = readAssets(readFileSync(built, "utf8"));
      }
      writeFileSync(resolve(outDir, "oaas-assets.json"), JSON.stringify(map, null, 2));
    }
  };
}

/**
 * O WSL monta /mnt/d via DrvFs, que nao suporta inotify: o watcher do Vite nunca
 * dispara e o hot reload nao acontece. Nesse caso o watcher passa a usar polling.
 *
 * A opcao watch so entra no config quando o polling e necessario: passar
 * watch: null desliga o watcher do Vite por completo, matando o hot reload.
 */
const needsPolling = process.platform === "linux" && /^\/mnt\//.test(process.cwd());
const watch = needsPolling ? { usePolling: true, interval: 300 } : undefined;


export default defineConfig({
  appType: "mpa",
  plugins: [oaasHtmlRoutes(), oaasAssetsManifest()],
  server: {
    port: 5173,
    strictPort: false,
    ...(watch ? { watch } : {})
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
