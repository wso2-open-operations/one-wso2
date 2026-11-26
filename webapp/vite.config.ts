import { defineConfig, mergeConfig } from "vite";
import { configDefaults, defineConfig as defineVitestConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";
import path from "path";

// https://vite.dev/config/
const viteConfig = defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),
    // Lets this app load other deployments' frontends at runtime. No remotes
    // are listed: each is registered from config.js (see src/remotes). The
    // shared packages are the ones a remote must not bring its own copy of,
    // or it would get a second React and lose this app's sign-in session.
    // Left out under Vitest, where nothing is loaded remotely.
    ...(process.env.VITEST
      ? []
      : [
          federation({
            name: "one_wso2",
            remotes: {},
            shared: {
              react: { singleton: true },
              "react-dom": { singleton: true },
              "@asgardeo/react": { singleton: true },
            },
            dts: false,
          }),
        ]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@api": path.resolve(__dirname, "./src/api"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@config": path.resolve(__dirname, "./src/config"),
      "@constants": path.resolve(__dirname, "./src/constants"),
      "@context": path.resolve(__dirname, "./src/context"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@layouts": path.resolve(__dirname, "./src/layouts"),
      "@utils": path.resolve(__dirname, "./src/utils"),
    },
  },
  envPrefix: ["ONE_WSO2_"],
  server: {
    port: 3000,
    proxy: {
      // Dev-only proxy: browser calls /legal-backend/* (same origin, no CORS)
      // and Vite forwards to localhost:9090/*. In production, set
      // ONE_WSO2_LEGAL_BACKEND_URL to the real backend URL in config.js.
      "/legal-backend": {
        target: "http://localhost:9090",
        rewrite: (path) => path.replace(/^\/legal-backend/, ""),
        changeOrigin: true,
      },
      // Dev-only proxy for a Swag Store backend on localhost:8080. The backend
      // reads the caller from x-jwt-assertion, which the API gateway sets in a
      // real deployment; here the browser's bearer token is copied into it.
      // In production, set ONE_WSO2_SWAG_STORE_BACKEND_URL to the gateway URL.
      "/swag-store-backend": {
        target: "http://localhost:8080",
        rewrite: (path) => path.replace(/^\/swag-store-backend/, ""),
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const auth = req.headers.authorization;
            if (auth?.startsWith("Bearer ")) proxyReq.setHeader("x-jwt-assertion", auth.slice("Bearer ".length));
          });
        },
      },
    },
  },
});

// Vitest lives inline here rather than in a separate vitest.config.ts, so the
// aliases and plugins above are shared rather than duplicated. `css: true` so
// Oxygen's emotion styles resolve under jsdom, and
// the Oxygen/Asgardeo packages ship ESM that has to be inlined to be
// transformable.
const vitestConfig = defineVitestConfig({
  test: {
    globals: true,
    environment: "jsdom",
    css: !["true", "1"].includes(process.env.DISABLE_VITEST_CSS ?? ""),
    setupFiles: ["./src/test/setup.ts"],
    exclude: [...configDefaults.exclude],
    server: {
      deps: {
        inline: [
          "@wso2/oxygen-ui",
          "@wso2/oxygen-ui-icons-react",
          // `@asgardeo/react` too, not just `/browser`: left external, Node
          // loads it itself and follows its `buffer/` import with the ESM
          // resolver, which refuses a directory import before any alias here
          // gets a say. Inlining the whole chain keeps that resolution in vite.
          "@asgardeo/react",
          "@asgardeo/browser",
          // Oxygen re-exports MUI X DataGrid, which ships a bare `.css` import
          // Node can't resolve. Rendering ANY Oxygen component pulls it in, so
          // this is required for component tests, not just data-grid ones.
          "@mui/x-data-grid",
        ],
      },
    },
  },
});

export default mergeConfig(viteConfig, vitestConfig);
