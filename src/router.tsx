import { createRoute, createRootRoute, createRouter } from '@tanstack/react-router'
import { Layout } from './components/Layout'
import { BooksPage } from './pages/BooksPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { UsersPage } from './pages/UsersPage'

const rootRoute = createRootRoute({ component: Layout })

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: DashboardPage })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage })
const booksRoute = createRoute({ getParentRoute: () => rootRoute, path: '/books', component: BooksPage })
const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/users', component: UsersPage })

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, booksRoute, usersRoute])
export const router = createRouter({ routeTree, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
