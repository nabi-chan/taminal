import type { TRPCRouter } from "@/integrations/trpc/router"

import NiceModal from "@ebay/nice-modal-react"
import { TanStackDevtools } from "@tanstack/react-devtools"
import type { QueryClient } from "@tanstack/react-query"
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router"
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools"
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query"
import { NuqsAdapter } from "nuqs/adapters/tanstack-router"

import { TooltipProvider } from "@/components/ui/tooltip"
import TanStackQueryDevtools from "@/integrations/tanstack-query/devtools"
import TanStackQueryProvider from "@/integrations/tanstack-query/root-provider"
import appCss from "@/styles.css?url"

interface RouterContext {
  queryClient: QueryClient
  trpc: TRPCOptionsProxy<TRPCRouter>
}

const THEME_INIT_SCRIPT = `(function(){try{var stored=window.localStorage.getItem('theme');var mode=(stored==='light'||stored==='dark'||stored==='auto')?stored:'auto';var prefersDark=window.matchMedia('(prefers-color-scheme: dark)').matches;var resolved=mode==='auto'?(prefersDark?'dark':'light'):mode;var root=document.documentElement;root.classList.remove('light','dark');root.classList.add(resolved);if(mode==='auto'){root.removeAttribute('data-theme')}else{root.setAttribute('data-theme',mode)}root.style.colorScheme=resolved;}catch(e){}})();`

export const Route = createRootRouteWithContext<RouterContext>()({
  shellComponent: RootDocument,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { title: "Taminal" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <TanStackQueryProvider>
          <NuqsAdapter>
            <NiceModal.Provider>
              <TooltipProvider>{children}</TooltipProvider>
            </NiceModal.Provider>
          </NuqsAdapter>
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
        </TanStackQueryProvider>
        <Scripts />
      </body>
    </html>
  )
}
