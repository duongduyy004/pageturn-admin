import { createRoute, createRootRoute, createRouter } from '@tanstack/react-router'
import { Layout } from './components/Layout'
import { BookCreatePage, BookEditPage } from './pages/BookFormPage'
import { BookDetailPage } from './pages/BookDetailPage'
import { BooksPage } from './pages/BooksPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { UsersPage } from './pages/UsersPage'

const rootRoute = createRootRoute({ component: Layout })

const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: DashboardPage })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: LoginPage })
const booksRoute = createRoute({ getParentRoute: () => rootRoute, path: '/books', component: BooksPage })
const bookCreateRoute = createRoute({ getParentRoute: () => rootRoute, path: '/books/new', component: BookCreatePage })
const bookDetailRoute = createRoute({ getParentRoute: () => rootRoute, path: '/books/$bookId', component: BookDetailPage })
const bookEditRoute = createRoute({ getParentRoute: () => rootRoute, path: '/books/$bookId/edit', component: BookEditPage })
const categoriesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/categories', component: CategoriesPage })
const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/users', component: UsersPage })

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, booksRoute, bookCreateRoute, bookDetailRoute, bookEditRoute, categoriesRoute, usersRoute])
export const router = createRouter({ routeTree, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
