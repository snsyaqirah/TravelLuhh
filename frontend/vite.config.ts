import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import fs from "fs";
import path from "path";

// ---- vendor chunks (§13) ------------------------------------------------------------------------------------
// three, r3f and drei load once, only on routes with a 3D scene; recharts only where a chart renders.
//
// Rollup's default manualChunks mode copies a package's whole dependency tree into its chunk, react included,
// and the entry then imports the three.js chunk on first paint. So the chunks are explicit
// (onlyExplicitManualChunks) and filled in from the module graph:
//  1. a dependency used only by one vendor chunk joins it (lodash → charts, react-reconciler → r3f);
//  2. a dependency that a vendor chunk shares with app code gets a small chunk of its own (maath, prop-types),
//     unless the entry already loads it. Otherwise Rollup folds it into the route chunk that loaded the
//     vendor chunk, and the two chunks import each other (a circular chunk);
//  3. everything else (react, radix, …) is left to Rollup.
const VENDOR_CHUNKS: [RegExp, string][] = [
  [/[\\/]node_modules[\\/]three[\\/]/, "three"],
  [/[\\/]node_modules[\\/]@react-three[\\/]fiber[\\/]/, "r3f"],
  [/[\\/]node_modules[\\/]@react-three[\\/]drei[\\/]/, "drei"],
  [/[\\/]node_modules[\\/](recharts|recharts-scale|react-smooth|victory-vendor|d3-[^\\/]+)[\\/]/, "charts"],
];
const VENDOR_NAMES = new Set(VENDOR_CHUNKS.map(([, name]) => name));
// drei → r3f → three. A dependency shared inside this stack goes to the lowest chunk that needs it.
const STACK_3D = ["three", "r3f", "drei"];

interface GraphInfo {
  isEntry: boolean;
  importers: readonly string[];
  dynamicImporters: readonly string[];
  importedIds: readonly string[];
}

/**
 * The installed package directory a module lives in (nested copies stay distinct), or null for app code.
 * CommonJS interop wrappers ('\0…/lodash/get.js?commonjs-proxy') count as their package.
 */
function packageDir(id: string): string | null {
  const m = /^.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+/.exec(id.replace(/^\0/, "").split("?")[0]);
  return m ? m[0] : null;
}

/** Owner chunk of every module that has one, computed once per build from the whole module graph. */
function assignVendorChunks(ids: string[], info: (id: string) => GraphInfo | null): Map<string, string> {
  const pkgOwner = new Map<string, string>();
  const modulesByPkg = new Map<string, string[]>();
  for (const id of ids) {
    const pkg = packageDir(id);
    if (!pkg) continue;
    modulesByPkg.set(pkg, [...(modulesByPkg.get(pkg) ?? []), id]);
    const direct = VENDOR_CHUNKS.find(([re]) => re.test(id))?.[1];
    if (direct) pkgOwner.set(pkg, direct);
  }

  /** Chunks of the importers from outside the package; null stands for app code or an unassigned package. */
  const importerOwners = (pkg: string): (string | null)[] =>
    (modulesByPkg.get(pkg) ?? []).flatMap((id) => {
      const m = info(id);
      return [...(m?.importers ?? []), ...(m?.dynamicImporters ?? [])]
        .map((importer) => packageDir(importer))
        .filter((ipkg) => ipkg !== pkg)
        .map((ipkg) => (ipkg ? (pkgOwner.get(ipkg) ?? null) : null));
    });

  // 1. Fixed point: a package joins a vendor chunk once every outside importer is in it.
  for (let changed = true; changed; ) {
    changed = false;
    for (const pkg of modulesByPkg.keys()) {
      if (pkgOwner.has(pkg)) continue;
      const owners = importerOwners(pkg);
      if (owners.length === 0 || owners.includes(null)) continue;
      const set = new Set(owners as string[]);
      const owner =
        set.size === 1
          ? owners[0]
          : [...set].every((o) => STACK_3D.includes(o))
            ? STACK_3D.find((o) => set.has(o))
            : undefined;
      if (owner) {
        pkgOwner.set(pkg, owner);
        changed = true;
      }
    }
  }

  // 2. Shared with app code: its own chunk, unless the entry already has it statically.
  const inEntry = new Set<string>();
  const queue = ids.filter((id) => info(id)?.isEntry);
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    if (inEntry.has(id)) continue;
    inEntry.add(id);
    queue.push(...(info(id)?.importedIds ?? []));
  }
  for (const [pkg, modules] of modulesByPkg) {
    if (pkgOwner.has(pkg) || modules.some((id) => inEntry.has(id))) continue;
    if (importerOwners(pkg).some((o) => o !== null && VENDOR_NAMES.has(o))) {
      // '/…/node_modules/@babel/runtime' → 'vendor-babel-runtime'
      const name = pkg.slice(pkg.lastIndexOf("node_modules") + 13).replace(/^@/, "").replace(/[\\/]/g, "-");
      pkgOwner.set(pkg, `vendor-${name}`);
    }
  }

  const byModule = new Map<string, string>();
  for (const [pkg, modules] of modulesByPkg) {
    const owner = pkgOwner.get(pkg);
    if (owner) for (const id of modules) byModule.set(id, owner);
  }
  return byModule;
}

const chunkCache = new WeakMap<object, Map<string, string>>();

// Dev only. Every runtime dependency is pre-bundled when the server starts. Otherwise a package first met later
// (a lazy route, the 3D chunk, a file created while the server runs) re-optimises the deps mid-session; the
// page then mixes old and new chunks (two Reacts, "Invalid hook call") unless HMR can force a reload.
const NOT_PREBUNDLED = new Set(["tailwindcss-animate"]); // a Tailwind plugin, never imported by app code
const PREBUNDLE: string[] = (() => {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
    };
    return Object.keys(pkg.dependencies ?? {}).filter((d) => !NOT_PREBUNDLED.has(d));
  } catch {
    return [];
  }
})();

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    // Matches the backend's app.frontend.url (OAuth lands on :5173/auth/callback). Moves to the next free port
    // when taken.
    port: 5173,
    strictPort: false,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // The dev/*.html harnesses are served by the dev server only (the build input is index.html). Listing them
  // keeps their dependencies in the pre-bundle scan, which the explicit build input would otherwise narrow.
  optimizeDeps: {
    entries: ["index.html", "dev/*.html"],
    include: PREBUNDLE,
  },
  build: {
    // three alone is ~690 kB minified (~180 kB gz); anything else that big deserves the warning.
    chunkSizeWarningLimit: 720,
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
      onwarn(warning, warn) {
        // A shared package whose code is all tree-shaken leaves an empty vendor-* chunk behind. Harmless.
        if (warning.code === "EMPTY_BUNDLE" && /vendor-/.test(warning.message)) return;
        warn(warning);
      },
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id, meta) {
          let owners = chunkCache.get(meta);
          if (!owners) {
            owners = assignVendorChunks([...meta.getModuleIds()], meta.getModuleInfo);
            chunkCache.set(meta, owners);
          }
          return owners.get(id);
        },
      },
    },
  },
}));
