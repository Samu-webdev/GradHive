import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'core/session.dart';
import 'screens/admin.dart';
import 'screens/auth.dart';
import 'screens/home.dart';
import 'screens/network.dart';
import 'screens/opportunities.dart';
import 'screens/positions.dart';
import 'screens/profile.dart';
import 'screens/misc.dart';
import 'screens/works.dart';

const _school = ['school'];
const _student = ['student'];
const _owners = ['school', 'company', 'organization'];

/// Rôles exigés par chemin (miroir des gardes du web). Absent = public.
List<String>? _rolesFor(String path) {
  const any = <String>[
    'student',
    'school',
    'company',
    'mentor',
    'organization',
    'admin',
  ];
  if (path == '/mon-profil') return ['student', 'school'];
  if (path == '/publications-institutionnelles' || path == '/mises-en-avant')
    return _school;
  if (path == '/memoires/publier' ||
      path.endsWith('/modifier') && path.startsWith('/memoires/'))
    return _student;
  if (path == '/mes-memoires' ||
      path == '/mes-candidatures' ||
      path == '/mes-candidatures-opportunites' ||
      path == '/favoris')
    return _student;
  if (path.startsWith('/gestion-opportunites')) return _owners;
  if (path == '/administration') return ['admin'];
  if (path == '/connexions' ||
      path == '/actualites' ||
      path == '/notifications' ||
      path == '/menu')
    return any;
  return null;
}

/// Logique de garde (testable sans widgets) : renvoie le chemin de redirection ou null.
String? redirectFor(Session s, Uri uri) {
  final path = uri.path;
  if (!s.ready) return null;
  final roles = _rolesFor(path);
  if (roles == null) {
    if ((path == '/connexion' || path == '/inscription') && s.isLoggedIn)
      return '/';
    return null;
  }
  if (!s.isLoggedIn)
    return '/connexion?redirect=${Uri.encodeComponent(uri.toString())}${s.expired ? '&expired=1' : ''}';
  if (!roles.contains(s.role)) return '/';
  return null;
}

GoRouter buildRouter(Session s) => GoRouter(
  refreshListenable: s,
  redirect: (context, state) => redirectFor(s, state.uri),
  routes: [
    GoRoute(
      path: '/connexion',
      builder: (c, st) => LoginScreen(
        redirect: st.uri.queryParameters['redirect'],
        expired: st.uri.queryParameters['expired'] == '1',
      ),
    ),
    GoRoute(path: '/inscription', builder: (c, st) => const RegisterScreen()),
    ShellRoute(
      builder: (c, st, child) => AppShell(child: child),
      routes: [
        GoRoute(path: '/', builder: (c, st) => const HomeScreen()),
        GoRoute(path: '/menu', builder: (c, st) => const MenuScreen()),
        GoRoute(path: '/recherche', builder: (c, st) => const SearchScreen()),
        GoRoute(path: '/reglages', builder: (c, st) => const SettingsScreen()),
        GoRoute(
          path: '/a-propos',
          builder: (c, st) => const InfoScreen(page: 'about'),
        ),
        GoRoute(
          path: '/conditions-generales',
          builder: (c, st) => const InfoScreen(page: 'terms'),
        ),
        GoRoute(
          path: '/confidentialite',
          builder: (c, st) => const InfoScreen(page: 'privacy'),
        ),
        GoRoute(
          path: '/mon-profil',
          builder: (c, st) => const MyProfileScreen(),
        ),
        GoRoute(
          path: '/publications-institutionnelles',
          builder: (c, st) => const InstitutionPostsScreen(),
        ),
        GoRoute(
          path: '/mises-en-avant',
          builder: (c, st) => const HighlightsScreen(),
        ),
        GoRoute(
          path: '/etudiants/:id',
          builder: (c, st) => PublicProfileScreen(
            id: int.parse(st.pathParameters['id']!),
            institution: false,
          ),
        ),
        GoRoute(
          path: '/etablissements/:id',
          builder: (c, st) => PublicProfileScreen(
            id: int.parse(st.pathParameters['id']!),
            institution: true,
          ),
        ),
        GoRoute(path: '/annuaire', builder: (c, st) => const DirectoryScreen()),
        GoRoute(
          path: '/connexions',
          builder: (c, st) => const ConnectionsScreen(),
        ),
        GoRoute(
          path: '/membres/:id',
          builder: (c, st) =>
              MemberDetailScreen(id: int.parse(st.pathParameters['id']!)),
        ),
        GoRoute(path: '/actualites', builder: (c, st) => const FeedScreen()),
        GoRoute(
          path: '/notifications',
          builder: (c, st) => const NotificationsScreen(),
        ),
        GoRoute(path: '/memoires', builder: (c, st) => const WorksListScreen()),
        GoRoute(
          path: '/memoires/publier',
          builder: (c, st) => const WorkFormScreen(),
        ),
        GoRoute(
          path: '/memoires/:id',
          builder: (c, st) =>
              WorkDetailScreen(id: int.parse(st.pathParameters['id']!)),
        ),
        GoRoute(
          path: '/memoires/:id/modifier',
          builder: (c, st) =>
              WorkFormScreen(id: int.parse(st.pathParameters['id']!)),
        ),
        GoRoute(
          path: '/mes-memoires',
          builder: (c, st) => const MyWorksScreen(),
        ),
        GoRoute(
          path: '/postes',
          builder: (c, st) => const PositionsListScreen(),
        ),
        GoRoute(
          path: '/postes/:id',
          builder: (c, st) =>
              PositionApplyScreen(id: int.parse(st.pathParameters['id']!)),
        ),
        GoRoute(
          path: '/mes-candidatures',
          builder: (c, st) => const MyApplicationsScreen(),
        ),
        GoRoute(
          path: '/opportunites',
          builder: (c, st) => const OpportunitiesListScreen(),
        ),
        GoRoute(
          path: '/opportunites/:id',
          builder: (c, st) =>
              OpportunityDetailScreen(id: int.parse(st.pathParameters['id']!)),
        ),
        GoRoute(path: '/favoris', builder: (c, st) => const FavoritesScreen()),
        GoRoute(
          path: '/mes-candidatures-opportunites',
          builder: (c, st) => const MyOpportunityApplicationsScreen(),
        ),
        GoRoute(
          path: '/gestion-opportunites',
          builder: (c, st) => const OpportunityManagementScreen(),
        ),
        GoRoute(
          path: '/gestion-opportunites/nouvelle',
          builder: (c, st) => const OpportunityFormScreen(),
        ),
        GoRoute(
          path: '/gestion-opportunites/:id/modifier',
          builder: (c, st) =>
              OpportunityFormScreen(id: int.parse(st.pathParameters['id']!)),
        ),
        GoRoute(
          path: '/gestion-opportunites/:id/candidatures',
          builder: (c, st) => ReceivedApplicationsScreen(
            id: int.parse(st.pathParameters['id']!),
          ),
        ),
        GoRoute(
          path: '/administration',
          builder: (c, st) => const AdminScreen(),
        ),
      ],
    ),
  ],
  errorBuilder: (c, st) => Scaffold(
    appBar: AppBar(title: const Text('GradHive')),
    body: const Center(child: Text('404')),
  ),
);
