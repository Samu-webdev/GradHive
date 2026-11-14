import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/i18n.dart';
import '../core/session.dart';
import '../widgets/common.dart';

/// Barre de navigation basse commune à tous les écrans.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.child});
  final Widget child;

  static const _tabs = [
    '/',
    '/memoires',
    '/opportunites',
    '/annuaire',
    '/menu',
  ];

  @override
  Widget build(BuildContext context) {
    final loc = GoRouterState.of(context).uri.path;
    var idx = _tabs.indexWhere((t) => t != '/' && loc.startsWith(t));
    if (loc == '/') idx = 0;
    if (idx < 0) idx = 4;
    return Scaffold(
      body: SafeArea(child: child),
      bottomNavigationBar: NavigationBar(
        selectedIndex: idx,
        onDestinationSelected: (i) => context.go(_tabs[i]),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            label: context.tr('Accueil', 'Home'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.school_outlined),
            label: context.tr('Projets', 'Projects'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.work_outline),
            label: context.tr('Opportunités', 'Opportunities'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.groups_outlined),
            label: context.tr('Réseau', 'Network'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.menu),
            label: context.tr('Plus', 'More'),
          ),
        ],
      ),
    );
  }
}

/// AppBar standard avec titre.
PreferredSizeWidget bar(
  BuildContext c,
  String title, {
  List<Widget>? actions,
}) => AppBar(
  title: Text(title),
  leading: GoRouter.of(c).canPop() ? const BackButton() : null,
  actions: actions,
);

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    return Scaffold(
      appBar: AppBar(
        title: const Row(children: [Logo(size: 30), SizedBox(width: 10), Text('GradHive')]),
        actions: [
          if (s.isLoggedIn)
            IconButton(
              icon: const Icon(Icons.notifications_none),
              onPressed: () => context.push('/notifications'),
            ),
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => context.push('/recherche'),
          ),
        ],
      ),
      body: Loader<Map>(
        load: () async => (await s.api.get('/stats')) as Map,
        builder: (c, stats, reload) => ListView(
          padding: const EdgeInsets.all(16),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            const NetImage('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=900&q=80'),
            const SizedBox(height: 16),
            Text(
              c.tr(
                'Le talent académique rencontre l’opportunité mondiale',
                'Academic talent meets global opportunity',
              ),
              style: Theme.of(c).textTheme.headlineSmall
                  ?.copyWith(fontWeight: FontWeight.bold, color: brandDark),
            ),
            const SizedBox(height: 8),
            Text(
              c.tr(
                'Valorisez vos mémoires déjà soutenus, rejoignez le réseau et accédez aux bourses, stages et postes TA/RA.',
                'Showcase your defended theses, join the network and access scholarships, internships and TA/RA positions.',
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _stat(c, '${stats['works'] ?? 0}', c.tr('projets', 'projects')),
                _stat(
                  c,
                  '${stats['universities'] ?? 0}',
                  c.tr('universités', 'universities'),
                ),
                _stat(
                  c,
                  '${stats['positions'] ?? 0}',
                  c.tr('postes TA/RA', 'TA/RA posts'),
                ),
                _stat(c, '${stats['users'] ?? 0}', c.tr('membres', 'members')),
              ],
            ),
            const SizedBox(height: 16),
            if (!s.isLoggedIn) ...[
              FilledButton(
                onPressed: () => context.push('/inscription'),
                child: Text(c.tr('Créer un compte', 'Create an account')),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => context.push('/connexion'),
                child: Text(c.tr('Se connecter', 'Sign in')),
              ),
            ] else
              Text(
                c.tr('Bonjour ${s.user?['name']}', 'Hello ${s.user?['name']}'),
                style: Theme.of(c).textTheme.titleMedium,
              ),
            const SizedBox(height: 16),
            _tile(
              c,
              Icons.school,
              c.tr('Projets et mémoires', 'Projects & theses'),
              '/memoires',
            ),
            _tile(
              c,
              Icons.assignment_ind,
              c.tr('Postes TA/RA', 'TA/RA positions'),
              '/postes',
            ),
            _tile(
              c,
              Icons.work,
              c.tr('Opportunités', 'Opportunities'),
              '/opportunites',
            ),
            _tile(
              c,
              Icons.groups,
              c.tr('Annuaire des membres', 'Member directory'),
              '/annuaire',
            ),
            if (s.isLoggedIn)
              _tile(
                c,
                Icons.dynamic_feed,
                c.tr('Fil d’actualité', 'News feed'),
                '/actualites',
              ),
          ],
        ),
      ),
    );
  }

  Widget _stat(BuildContext c, String n, String label) => Expanded(
    child: Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 12),
        child: Column(
          children: [
            Text(
              n,
              style: Theme.of(c).textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            Text(
              label,
              style: const TextStyle(fontSize: 11),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    ),
  );

  Widget _tile(BuildContext c, IconData i, String t, String path) => Card(
    child: ListTile(
      leading: Icon(i, color: brand),
      title: Text(t),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => c.push(path),
    ),
  );
}

/// Menu « Plus » : espaces selon le rôle, réglages, informations, déconnexion.
class MenuScreen extends StatelessWidget {
  const MenuScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    final lb = context.lb;
    Widget item(IconData i, String t, String path) => ListTile(
      leading: Icon(i),
      title: Text(t),
      onTap: () => context.push(path),
    );
    return Scaffold(
      appBar: AppBar(title: Text(context.tr('Plus', 'More'))),
      body: ListView(
        children: [
          if (s.isLoggedIn)
            ListTile(
              leading: const CircleAvatar(child: Icon(Icons.person)),
              title: Text('${s.user?['name']}'),
              subtitle: Text(lb.role(s.role)),
            )
          else ...[
            item(
              Icons.login,
              context.tr('Se connecter', 'Sign in'),
              '/connexion',
            ),
            item(
              Icons.person_add,
              context.tr('Créer un compte', 'Create an account'),
              '/inscription',
            ),
          ],
          if (s.hasRole(['student', 'school']))
            item(
              Icons.badge,
              context.tr('Mon profil', 'My profile'),
              '/mon-profil',
            ),
          if (s.hasRole(['student'])) ...[
            item(
              Icons.upload_file,
              context.tr('Publier un projet', 'Publish a project'),
              '/memoires/publier',
            ),
            item(
              Icons.folder,
              context.tr('Mes projets', 'My projects'),
              '/mes-memoires',
            ),
            item(
              Icons.assignment_turned_in,
              context.tr('Mes candidatures TA/RA', 'My TA/RA applications'),
              '/mes-candidatures',
            ),
            item(
              Icons.how_to_reg,
              context.tr(
                'Mes candidatures aux opportunités',
                'My opportunity applications',
              ),
              '/mes-candidatures-opportunites',
            ),
            item(
              Icons.bookmark,
              context.tr('Opportunités enregistrées', 'Saved opportunities'),
              '/favoris',
            ),
          ],
          if (s.hasRole(['school'])) ...[
            item(
              Icons.star,
              context.tr('Étudiants mis en avant', 'Highlighted students'),
              '/mises-en-avant',
            ),
            item(
              Icons.campaign,
              context.tr(
                'Publications de l’établissement',
                'Institution posts',
              ),
              '/publications-institutionnelles',
            ),
          ],
          if (s.hasRole(['school', 'company', 'organization']))
            item(
              Icons.edit_note,
              context.tr('Gérer mes opportunités', 'Manage my opportunities'),
              '/gestion-opportunites',
            ),
          if (s.isLoggedIn) ...[
            item(
              Icons.dynamic_feed,
              context.tr('Fil d’actualité', 'News feed'),
              '/actualites',
            ),
            item(
              Icons.people,
              context.tr('Mes connexions', 'My connections'),
              '/connexions',
            ),
            item(Icons.notifications, 'Notifications', '/notifications'),
          ],
          if (s.hasRole(['admin']))
            item(
              Icons.admin_panel_settings,
              'Administration',
              '/administration',
            ),
          const Divider(),
          item(
            Icons.assignment_ind,
            context.tr('Postes TA/RA', 'TA/RA positions'),
            '/postes',
          ),
          item(Icons.search, context.tr('Recherche', 'Search'), '/recherche'),
          item(Icons.settings, context.tr('Réglages', 'Settings'), '/reglages'),
          item(
            Icons.info_outline,
            context.tr('À propos', 'About'),
            '/a-propos',
          ),
          item(
            Icons.description_outlined,
            context.tr('Conditions générales', 'Terms'),
            '/conditions-generales',
          ),
          item(
            Icons.privacy_tip_outlined,
            context.tr('Confidentialité', 'Privacy'),
            '/confidentialite',
          ),
          if (s.isLoggedIn)
            ListTile(
              leading: const Icon(Icons.logout),
              title: Text(context.tr('Se déconnecter', 'Sign out')),
              onTap: () async {
                await s.logout();
                if (context.mounted) context.go('/');
              },
            ),
        ],
      ),
    );
  }
}
