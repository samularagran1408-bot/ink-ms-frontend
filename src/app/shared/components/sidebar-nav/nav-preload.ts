/** Precarga el chunk de una ruta del sidebar. El bundler deduplica los import(). */
const loaders: Record<string, () => Promise<unknown>> = {
  '/home': () =>
    import('@features/users/pages/user-interface/user-interface.component'),
  '/home/events': () =>
    import('@features/sports-disabilities/pages/events-page/events-page.component'),
  '/home/profile': () =>
    import('@features/users/pages/profile-page/profile-page.component'),
  '/home/accessibility': () =>
    import('@features/accessibility/pages/accessibility-page/accessibility-page.component'),
  '/home/notifications': () =>
    import('@features/accessibility/pages/notifications-page/notifications-page.component'),
  '/admin': () =>
    import('@features/admin/pages/admin-dashboard/admin-dashboard.component'),
  '/admin/users': () =>
    import('@features/users/pages/admin-users/admin-users.component'),
  '/admin/events': () =>
    import('@features/sports-disabilities/pages/events-page/events-page.component'),
  '/admin/athletes': () =>
    import('@features/users/pages/athletes-page/athletes-page.component'),
  '/admin/sports': () =>
    import('@features/sports-disabilities/pages/sports-page/sports-page.component'),
  '/admin/disabilities': () =>
    import('@features/sports-disabilities/pages/disabilities-page/disabilities-page.component'),
  '/admin/associations': () =>
    import('@features/sports-disabilities/pages/associations-page/associations-page.component'),
  '/admin/roles': () =>
    import('@features/admin/pages/admin-roles/admin-roles.component'),
  '/admin/audit': () =>
    import('@features/admin/pages/admin-audit/admin-audit.component'),
  '/admin/subscriptions': () =>
    import('@features/subscriptions/pages/organizer-plans/organizer-plans.component'),
  '/admin/profile': () =>
    import('@features/users/pages/profile-page/profile-page.component'),
  '/admin/accessibility': () =>
    import('@features/accessibility/pages/accessibility-page/accessibility-page.component'),
  '/admin/notifications': () =>
    import('@features/accessibility/pages/notifications-page/notifications-page.component'),
  '/trainer': () =>
    import('@features/assistant/pages/trainer-dashboard/trainer-dashboard.component'),
  '/trainer/quiz': () =>
    import('@features/users/pages/aptitude-quiz-page/aptitude-quiz-page.component'),
  '/trainer/sessions': () =>
    import('@features/assistant/pages/sessions-page/sessions-page.component'),
  '/trainer/sports': () =>
    import('@features/sports-disabilities/pages/sports-page/sports-page.component'),
  '/trainer/disabilities': () =>
    import('@features/sports-disabilities/pages/disabilities-page/disabilities-page.component'),
  '/trainer/associations': () =>
    import('@features/sports-disabilities/pages/associations-page/associations-page.component'),
  '/trainer/profile': () =>
    import('@features/users/pages/profile-page/profile-page.component'),
  '/trainer/accessibility': () =>
    import('@features/accessibility/pages/accessibility-page/accessibility-page.component'),
  '/trainer/notifications': () =>
    import('@features/accessibility/pages/notifications-page/notifications-page.component'),
  '/organizer': () =>
    import('@features/sports-disabilities/pages/organizer-dashboard/organizer-dashboard.component'),
  '/organizer/quiz': () =>
    import('@features/users/pages/aptitude-quiz-page/aptitude-quiz-page.component'),
  '/organizer/events': () =>
    import('@features/sports-disabilities/pages/events-page/events-page.component'),
  '/organizer/athletes': () =>
    import('@features/users/pages/athletes-page/athletes-page.component'),
  '/organizer/plans': () =>
    import('@features/subscriptions/pages/organizer-plans/organizer-plans.component'),
  '/organizer/subscription': () =>
    import('@features/subscriptions/pages/subscription/subscription.component'),
  '/organizer/payments': () =>
    import('@features/subscriptions/pages/payment-history/payment-history.component'),
  '/organizer/payments/receipt': () =>
    import('@features/subscriptions/pages/proof-of-payment/proof-of-payment.component'),
  '/organizer/profile': () =>
    import('@features/users/pages/profile-page/profile-page.component'),
  '/organizer/accessibility': () =>
    import('@features/accessibility/pages/accessibility-page/accessibility-page.component'),
  '/organizer/notifications': () =>
    import('@features/accessibility/pages/notifications-page/notifications-page.component')
};

const inflight = new Set<string>();

export function preloadNavRoute(route?: string): void {
  if (!route || inflight.has(route)) {
    return;
  }
  const load = loaders[route];
  if (!load) {
    return;
  }
  inflight.add(route);
  void load().catch(() => {
    inflight.delete(route);
  });
}

export function preloadNavRoutes(routes: Array<string | undefined>): void {
  routes.forEach((route) => preloadNavRoute(route));
}
