/**
 * Таблица маршрутов. Страницы группируются по layout-ам: гостевой (вход и
 * регистрация), сеансовый без организации (выбор пространства, создание
 * организации) и рабочее пространство с боковым меню.
 */
import type { RouteRecordRaw } from 'vue-router'
import { defineComponent } from 'vue'
import { useSessionStore } from '@/entities/session'

/** Пустой экран маршрута `/settings`: `beforeEnter` всегда уводит на вкладку. */
const SettingsEntry = defineComponent({ name: 'SettingsEntry', render: () => null })

export const routes: RouteRecordRaw[] = [
  // Корень ведёт в Radar; guard сам перенаправит гостя на вход, а
  // пользователя без организации — к её созданию или выбору.
  { path: '/', name: 'home', redirect: { name: 'radar' } },
  {
    path: '/',
    component: () => import('../layouts/AuthLayout.vue'),
    children: [
      {
        path: 'login',
        name: 'login',
        component: () => import('@/pages/login').then((m) => m.LoginPage),
        meta: { access: 'guest', title: 'Вход' },
      },
      {
        path: 'register',
        name: 'register',
        component: () => import('@/pages/register').then((m) => m.RegisterPage),
        meta: { access: 'guest', title: 'Регистрация' },
      },
    ],
  },
  {
    path: '/',
    component: () => import('../layouts/PlainLayout.vue'),
    children: [
      {
        path: 'workspaces',
        name: 'workspaces',
        component: () => import('@/pages/workspaces').then((m) => m.WorkspacesPage),
        meta: { access: 'session', title: 'Рабочие пространства' },
      },
      {
        path: 'invitations/accept',
        name: 'invitations-accept',
        component: () => import('@/pages/invitations').then((m) => m.AcceptInvitationPage),
        meta: { access: 'session', title: 'Приглашение' },
      },
    ],
  },
  {
    path: '/',
    component: () => import('../layouts/OnboardingLayout.vue'),
    children: [
      {
        path: 'onboarding',
        name: 'onboarding',
        component: () => import('@/pages/onboarding').then((m) => m.OnboardingResumePage),
        meta: { access: 'session', title: 'Начало работы' },
      },
      {
        path: 'onboarding/company',
        name: 'onboarding-company',
        component: () => import('@/pages/onboarding').then((m) => m.CompanyPage),
        meta: { access: 'session', title: 'Начало работы', onboardingStep: 'ORGANIZATION' },
      },
      {
        path: 'onboarding/location',
        name: 'onboarding-location',
        component: () => import('@/pages/onboarding').then((m) => m.LocationPage),
        meta: {
          access: 'tenant',
          permission: 'location.manage',
          title: 'Точка и график',
          onboardingStep: 'LOCATION',
        },
      },
      {
        path: 'onboarding/services',
        name: 'onboarding-services',
        component: () => import('@/pages/onboarding').then((m) => m.ServicesPage),
        meta: {
          access: 'tenant',
          permission: 'service.manage',
          title: 'Услуги и цены',
          onboardingStep: 'SERVICES',
        },
      },
      {
        path: 'onboarding/channel',
        name: 'onboarding-channel',
        component: () => import('@/pages/onboarding').then((m) => m.ChannelPage),
        meta: { access: 'tenant', title: 'Источник сообщений', onboardingStep: 'CHANNEL' },
      },
    ],
  },
  {
    path: '/',
    component: () => import('../layouts/ShellLayout.vue'),
    children: [
      {
        path: 'radar',
        name: 'radar',
        component: () => import('@/pages/radar').then((m) => m.RadarPage),
        meta: { access: 'tenant', permission: 'risks.read', title: 'Radar' },
      },
      {
        path: 'risks/:riskId',
        name: 'risk',
        component: () => import('@/pages/risk').then((m) => m.RiskPage),
        meta: { access: 'tenant', permission: 'risks.read', title: 'Риск' },
      },
      {
        path: 'conversations',
        name: 'conversations',
        component: () => import('@/pages/conversations').then((m) => m.ConversationsPage),
        meta: { access: 'tenant', permission: 'conversation.read', title: 'Диалоги' },
      },
      {
        path: 'conversations/:conversationId',
        name: 'conversation',
        component: () => import('@/pages/conversations').then((m) => m.ConversationsPage),
        meta: { access: 'tenant', permission: 'conversation.read', title: 'Диалог' },
      },
      {
        path: 'integrations',
        name: 'integrations',
        component: () => import('@/pages/integrations').then((m) => m.IntegrationsPage),
        meta: { access: 'tenant', permission: 'integration.manage', title: 'Интеграции' },
      },
      {
        path: 'settings',
        name: 'settings',
        // Вкладка выбирается после загрузки сессии глобальным guard-ом, поэтому
        // это не `redirect` (он разрешается до guard-ов), а `beforeEnter`:
        // владелец начинает с компании, менеджеру доступны только личные уведомления.
        component: SettingsEntry,
        meta: { access: 'tenant', title: 'Настройки' },
        beforeEnter: () => ({
          name: useSessionStore().can('organization.manage')
            ? 'settings-company'
            : 'settings-notifications',
          replace: true,
        }),
      },
      {
        path: 'settings/company',
        name: 'settings-company',
        component: () => import('@/pages/settings').then((m) => m.SettingsCompanyPage),
        meta: { access: 'tenant', permission: 'organization.manage', title: 'Настройки' },
      },
      {
        path: 'settings/services',
        name: 'settings-services',
        component: () => import('@/pages/settings').then((m) => m.SettingsServicesPage),
        meta: { access: 'tenant', permission: 'service.manage', title: 'Услуги и цены' },
      },
      {
        path: 'settings/notifications',
        name: 'settings-notifications',
        component: () => import('@/pages/settings').then((m) => m.SettingsNotificationsPage),
        meta: { access: 'tenant', title: 'Уведомления' },
      },
      {
        path: 'settings/team',
        name: 'settings-team',
        component: () => import('@/pages/settings').then((m) => m.SettingsTeamPage),
        meta: { access: 'tenant', permission: 'member.manage', title: 'Команда' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/not-found').then((m) => m.NotFoundPage),
    meta: { title: 'Страница не найдена' },
  },
]
