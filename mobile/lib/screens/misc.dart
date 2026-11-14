import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/i18n.dart';
import '../core/session.dart';
import '../widgets/common.dart';
import 'home.dart';
import 'network.dart';
import 'works.dart';

/// Recherche globale : travaux et membres.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});
  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _q = TextEditingController();
  String query = '';
  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    return Scaffold(
      appBar: bar(context, context.tr('Recherche', 'Search')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _q,
              autofocus: true,
              decoration: InputDecoration(
                hintText: context.tr('Rechercher…', 'Search…'),
                prefixIcon: const Icon(Icons.search),
                border: const OutlineInputBorder(),
              ),
              onSubmitted: (v) => setState(() => query = v.trim()),
            ),
          ),
          Expanded(
            child: query.length < 2
                ? Center(
                    child: Text(
                      context.tr(
                        'Saisissez au moins 2 caractères.',
                        'Type at least 2 characters.',
                      ),
                    ),
                  )
                : Loader<Map>(
                    key: ValueKey(query),
                    load: () async => {
                      'works':
                          (await s.api.get(
                                '/works',
                                query: {'q': query},
                              ))['data']
                              as List,
                      'members':
                          (await s.api.get(
                                '/search/members',
                                query: {'q': query},
                              ))['data']
                              as List,
                    },
                    builder: (c, r, reload) => ListView(
                      padding: const EdgeInsets.all(12),
                      children: [
                        Section(
                          c.tr('Projets et mémoires', 'Projects & theses'),
                          children: [
                            if ((r['works'] as List).isEmpty)
                              Text(c.tr('Aucun résultat.', 'No results.')),
                            for (final w in (r['works'] as List).take(15))
                              workCard(c, w as Map),
                          ],
                        ),
                        Section(
                          c.tr('Membres', 'Members'),
                          children: [
                            if ((r['members'] as List).isEmpty)
                              Text(c.tr('Aucun résultat.', 'No results.')),
                            for (final m in (r['members'] as List))
                              memberTile(c, m as Map),
                          ],
                        ),
                      ],
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    return Scaffold(
      appBar: bar(context, context.tr('Réglages', 'Settings')),
      body: ListView(
        children: [
          ListTile(title: Text(context.tr('Langue', 'Language'))),
          RadioListTile<String>(
            value: 'fr',
            groupValue: s.locale,
            onChanged: (v) => s.setLocale(v!),
            title: const Text('Français'),
          ),
          RadioListTile<String>(
            value: 'en',
            groupValue: s.locale,
            onChanged: (v) => s.setLocale(v!),
            title: const Text('English'),
          ),
          const Divider(),
          const ListTile(title: Text('GradHive Mobile 1.0.0')),
        ],
      ),
    );
  }
}

class InfoScreen extends StatelessWidget {
  const InfoScreen({super.key, required this.page});
  final String page;
  @override
  Widget build(BuildContext context) {
    final texts = {
      'about': (
        context.tr('À propos', 'About'),
        context.tr(
          'GradHive valorise les mémoires et travaux académiques déjà soutenus et validés par les établissements, met en relation étudiants, écoles, entreprises, mentors et organismes, et donne accès à des opportunités d’emploi, de stage, de bourse et de mobilité internationale.\n\nLa publication d’un travail ne constitue pas une validation ni une certification académique ; la mise en avant par un établissement est promotionnelle.',
          'GradHive showcases academic work already defended and validated by institutions, connects students, schools, companies, mentors and organizations, and gives access to jobs, internships, scholarships and international mobility.\n\nPublishing a work is not academic validation or certification; institutional highlights are promotional.',
        ),
      ),
      'terms': (
        context.tr('Conditions générales', 'Terms'),
        context.tr(
          'Vous publiez uniquement des contenus dont vous détenez les droits et qui ont déjà été validés par votre établissement. Les contenus frauduleux ou inappropriés peuvent être signalés et entraîner la suspension du compte.',
          'You only publish content you own the rights to and that your institution has already validated. Fraudulent or inappropriate content can be reported and may lead to account suspension.',
        ),
      ),
      'privacy': (
        context.tr('Confidentialité', 'Privacy'),
        context.tr(
          'Votre profil étudiant est privé par défaut ; vous choisissez la visibilité de vos travaux (public ou privé). Votre jeton de connexion est conservé dans le stockage sécurisé de votre téléphone et supprimé à la déconnexion.',
          'Your student profile is private by default; you choose the visibility of your works (public or private). Your sign-in token is kept in your phone’s secure storage and removed on sign-out.',
        ),
      ),
    };
    final t = texts[page]!;
    return Scaffold(
      appBar: bar(context, t.$1),
      body: ListView(padding: const EdgeInsets.all(16), children: [Text(t.$2)]),
    );
  }
}
