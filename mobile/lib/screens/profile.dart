import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/i18n.dart';
import '../core/session.dart';
import '../widgets/common.dart';
import 'home.dart';
import 'works.dart';

class MyProfileScreen extends StatefulWidget {
  const MyProfileScreen({super.key});
  @override
  State<MyProfileScreen> createState() => _MyProfileScreenState();
}

class _MyProfileScreenState extends State<MyProfileScreen> {
  final name = TextEditingController(),
      country = TextEditingController(),
      headline = TextEditingController(),
      bio = TextEditingController();
  final website = TextEditingController(),
      institution = TextEditingController(),
      fieldOfStudy = TextEditingController();
  String level = 'licence', visibility = 'private';
  bool loaded = false;
  String? error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final p =
            (await context.read<Session>().api.get('/my/profile'))['data']
                as Map;
        name.text = '${p['name'] ?? ''}';
        country.text = '${p['country'] ?? ''}';
        headline.text = '${p['headline'] ?? ''}';
        bio.text = '${p['bio'] ?? ''}';
        website.text = '${p['website'] ?? ''}';
        institution.text = '${p['institution'] ?? ''}';
        fieldOfStudy.text = '${p['field_of_study'] ?? ''}';
        level = p['level'] ?? 'licence';
        visibility = p['profile_visibility'] ?? 'private';
      } catch (e) {
        error = errText(e);
      }
      if (mounted) setState(() => loaded = true);
    });
  }

  String? _n(TextEditingController c) =>
      c.text.trim().isEmpty ? null : c.text.trim();

  Future<void> _save() async {
    final s = context.read<Session>();
    final student = s.role == 'student';
    final body = <String, dynamic>{
      'name': name.text.trim(),
      'country': _n(country),
      'headline': _n(headline),
      'bio': _n(bio),
      'website': _n(website),
      'institution': _n(institution),
      if (student) ...{
        'field_of_study': _n(fieldOfStudy),
        'level': level,
        'student_profile_visibility': visibility,
      } else
        'institution_profile_visibility': visibility,
    };
    try {
      await s.api.put('/my/profile', body);
      await s.refreshProfile();
      if (mounted) {
        setState(() => error = null);
        snack(context, context.tr('Profil mis à jour.', 'Profile updated.'));
      }
    } catch (e) {
      setState(() => error = errText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    final student = s.role == 'student';
    return Scaffold(
      appBar: bar(context, context.tr('Mon profil', 'My profile')),
      body: !loaded
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                field(name, context.tr('Nom', 'Name')),
                field(headline, context.tr('Titre / accroche', 'Headline')),
                field(institution, context.tr('Établissement', 'Institution')),
                if (student) ...[
                  field(fieldOfStudy, context.tr('Filière', 'Field of study')),
                  dropdown(context.tr('Niveau', 'Level'), level, {
                    for (final l in levels) l: context.lb.level(l),
                  }, (v) => setState(() => level = v ?? level)),
                ],
                field(country, context.tr('Pays', 'Country')),
                field(
                  website,
                  context.tr('Site web', 'Website'),
                  type: TextInputType.url,
                ),
                field(bio, context.tr('Présentation', 'About'), lines: 5),
                dropdown(
                  context.tr('Visibilité du profil', 'Profile visibility'),
                  visibility,
                  {
                    'public': context.tr('Public', 'Public'),
                    'private': context.tr('Privé', 'Private'),
                  },
                  (v) => setState(() => visibility = v ?? visibility),
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      error!,
                      style: TextStyle(color: Colors.red.shade700),
                    ),
                  ),
                BusyButton(
                  label: context.tr('Enregistrer', 'Save'),
                  onPressed: _save,
                ),
                if (visibility == 'public' && s.userId != null)
                  TextButton(
                    onPressed: () => context.push(
                      student
                          ? '/etudiants/${s.userId}'
                          : '/etablissements/${s.userId}',
                    ),
                    child: Text(
                      context.tr(
                        'Voir mon profil public',
                        'View my public profile',
                      ),
                    ),
                  ),
              ],
            ),
    );
  }
}

class PublicProfileScreen extends StatelessWidget {
  const PublicProfileScreen({
    super.key,
    required this.id,
    required this.institution,
  });
  final int id;
  final bool institution;
  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    return Scaffold(
      appBar: bar(
        context,
        institution
            ? context.tr('Établissement', 'Institution')
            : context.tr('Profil étudiant', 'Student profile'),
      ),
      body: Loader<Map>(
        load: () async {
          final p =
              (await s.api.get(
                    institution
                        ? '/institutions/$id/profile'
                        : '/students/$id/profile',
                  ))['data']
                  as Map;
          final works = institution
              ? <dynamic>[]
              : (await s.api.get('/works', query: {'author_id': id}))['data']
                    as List;
          return {...p, '_works': works};
        },
        builder: (c, p, reload) {
          final highlights = (p['highlights'] as List?) ?? [];
          final works = p['_works'] as List;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                '${p['name']}',
                style: Theme.of(c).textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              if (p['headline'] != null) Text('${p['headline']}'),
              Wrap(
                children: [
                  if (p['institution'] != null) Chip2('${p['institution']}'),
                  if (p['field_of_study'] != null)
                    Chip2('${p['field_of_study']}'),
                  if (p['level'] != null) Chip2(c.lb.level(p['level'])),
                  if (p['country'] != null) Chip2('${p['country']}'),
                ],
              ),
              if (p['bio'] != null)
                Section(
                  c.tr('Présentation', 'About'),
                  children: [Text('${p['bio']}')],
                ),
              if (p['website'] != null)
                Section(
                  c.tr('Site web', 'Website'),
                  children: [Text('${p['website']}')],
                ),
              if (s.isLoggedIn && s.userId != id)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: FilledButton.icon(
                    icon: const Icon(Icons.person_add_alt),
                    label: Text(c.tr('Se connecter', 'Connect')),
                    onPressed: () async {
                      try {
                        await s.api.post('/connections', {'user_id': id});
                        if (c.mounted)
                          snack(c, c.tr('Demande envoyée.', 'Request sent.'));
                      } catch (e) {
                        if (c.mounted) snack(c, errText(e), error: true);
                      }
                    },
                  ),
                ),
              ReportButton(type: 'member', id: id),
              if (institution)
                Section(
                  c.tr('Étudiants mis en avant', 'Highlighted students'),
                  children: [
                    if (highlights.isEmpty)
                      Text(c.tr('Aucune mise en avant.', 'No highlights.')),
                    for (final h in highlights)
                      Card(
                        child: ListTile(
                          leading: const Icon(Icons.star, color: Colors.amber),
                          title: Text('${(h as Map)['title']}'),
                          subtitle: Text(
                            '${(h['student'] as Map?)?['name'] ?? ''}\n${h['message']}',
                          ),
                          isThreeLine: true,
                          onTap: h['student'] == null
                              ? null
                              : () => c.push(
                                  '/etudiants/${(h['student'] as Map)['id']}',
                                ),
                        ),
                      ),
                    Text(
                      c.tr(
                        'Mise en avant promotionnelle, sans valeur de certification.',
                        'Promotional highlight, not a certification.',
                      ),
                      style: const TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ],
                )
              else
                Section(
                  c.tr('Projets et mémoires', 'Projects & theses'),
                  children: [
                    if (works.isEmpty)
                      Text(c.tr('Aucun travail public.', 'No public work.')),
                    for (final w in works) workCard(c, w as Map),
                  ],
                ),
            ],
          );
        },
      ),
    );
  }
}

/// Étudiants mis en avant par l'établissement (rôle school).
class HighlightsScreen extends StatefulWidget {
  const HighlightsScreen({super.key});
  @override
  State<HighlightsScreen> createState() => _HighlightsScreenState();
}

class _HighlightsScreenState extends State<HighlightsScreen> {
  int _k = 0;

  Future<void> _add() async {
    final api = context.read<Session>().api;
    final students =
        (await api.get('/my/institution/eligible-students'))['data'] as List;
    if (!mounted) return;
    final title = TextEditingController(), msg = TextEditingController();
    int? sel;
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => StatefulBuilder(
        builder: (d, set) => AlertDialog(
          title: Text(
            context.tr('Mettre un étudiant en avant', 'Highlight a student'),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (students.isEmpty)
                  Text(
                    context.tr(
                      'Aucun étudiant éligible : le profil doit être public et le nom de l’établissement identique au vôtre.',
                      'No eligible student: the profile must be public and the institution name identical to yours.',
                    ),
                  ),
                DropdownButtonFormField<int>(
                  value: sel,
                  isExpanded: true,
                  decoration: InputDecoration(
                    labelText: context.tr('Étudiant', 'Student'),
                  ),
                  items: [
                    for (final s in students)
                      DropdownMenuItem(
                        value: (s as Map)['id'] as int,
                        child: Text(
                          '${s['name']}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (v) => set(() => sel = v),
                ),
                TextField(
                  controller: title,
                  decoration: InputDecoration(
                    labelText: context.tr('Titre', 'Title'),
                  ),
                ),
                TextField(
                  controller: msg,
                  maxLines: 3,
                  decoration: InputDecoration(
                    labelText: context.tr(
                      'Message (10 car. min.)',
                      'Message (10 chars min.)',
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(d, false),
              child: Text(context.tr('Annuler', 'Cancel')),
            ),
            FilledButton(
              onPressed: sel == null ? null : () => Navigator.pop(d, true),
              child: Text(context.tr('Valider', 'Save')),
            ),
          ],
        ),
      ),
    );
    if (ok != true || sel == null) return;
    try {
      await api.post('/my/institution/highlights', {
        'student_id': sel,
        'title': title.text.trim(),
        'message': msg.text.trim(),
      });
      setState(() => _k++);
    } catch (e) {
      if (mounted) snack(context, errText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    return Scaffold(
      appBar: bar(
        context,
        context.tr('Étudiants mis en avant', 'Highlighted students'),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _add,
        child: const Icon(Icons.add),
      ),
      body: Loader<List>(
        key: ValueKey(_k),
        load: () async =>
            (await api.get('/my/institution/highlights'))['data'] as List,
        builder: (c, items, reload) => ItemList(
          items: items,
          empty: c.tr('Aucune mise en avant.', 'No highlights yet.'),
          header: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              c.tr(
                'La mise en avant est promotionnelle et ne constitue pas une certification.',
                'Highlights are promotional and not a certification.',
              ),
              style: const TextStyle(fontSize: 12),
            ),
          ),
          itemBuilder: (c, h) {
            final m = h as Map;
            return Card(
              child: ListTile(
                leading: const Icon(Icons.star, color: Colors.amber),
                title: Text('${m['title']}'),
                subtitle: Text(
                  '${(m['student'] as Map?)?['name'] ?? ''}\n${m['message']}',
                ),
                isThreeLine: true,
                trailing: IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () async {
                    if (!await confirm(
                      c,
                      c.tr(
                        'Retirer cette mise en avant ?',
                        'Remove this highlight?',
                      ),
                    ))
                      return;
                    try {
                      await api.delete('/my/institution/highlights/${m['id']}');
                      setState(() => _k++);
                    } catch (e) {
                      if (c.mounted) snack(c, errText(e), error: true);
                    }
                  },
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class InstitutionPostsScreen extends StatefulWidget {
  const InstitutionPostsScreen({super.key});
  @override
  State<InstitutionPostsScreen> createState() => _InstitutionPostsScreenState();
}

class _InstitutionPostsScreenState extends State<InstitutionPostsScreen> {
  int _k = 0;

  Future<void> _edit([Map? post]) async {
    final api = context.read<Session>().api;
    final title = TextEditingController(text: post?['title'] as String? ?? ''),
        body = TextEditingController(text: post?['body'] as String? ?? '');
    final ok = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: Text(
          post == null
              ? context.tr('Nouvelle publication', 'New post')
              : context.tr('Modifier', 'Edit'),
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: title,
                decoration: InputDecoration(
                  labelText: context.tr('Titre', 'Title'),
                ),
              ),
              TextField(
                controller: body,
                maxLines: 5,
                decoration: InputDecoration(
                  labelText: context.tr(
                    'Texte (20 car. min.)',
                    'Text (20 chars min.)',
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d, false),
            child: Text(context.tr('Annuler', 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(d, true),
            child: Text(context.tr('Publier', 'Publish')),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      final data = {'title': title.text.trim(), 'body': body.text.trim()};
      post == null
          ? await api.post('/my/institution/posts', data)
          : await api.put('/my/institution/posts/${post['id']}', data);
      setState(() => _k++);
    } catch (e) {
      if (mounted) snack(context, errText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    return Scaffold(
      appBar: bar(
        context,
        context.tr('Publications de l’établissement', 'Institution posts'),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _edit(),
        child: const Icon(Icons.add),
      ),
      body: Loader<List>(
        key: ValueKey(_k),
        load: () async =>
            (await api.get('/my/institution/posts'))['data'] as List,
        builder: (c, items, reload) => ItemList(
          items: items,
          empty: c.tr('Aucune publication.', 'No posts yet.'),
          itemBuilder: (c, p) {
            final m = p as Map;
            return Card(
              child: ListTile(
                title: Text('${m['title']}'),
                subtitle: Text(
                  '${fmtDate(m['created_at'])}\n${m['body']}',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                isThreeLine: true,
                onTap: () => _edit(m),
                trailing: IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () async {
                    if (!await confirm(
                      c,
                      c.tr(
                        'Supprimer cette publication ?',
                        'Delete this post?',
                      ),
                    ))
                      return;
                    try {
                      await api.delete('/my/institution/posts/${m['id']}');
                      setState(() => _k++);
                    } catch (e) {
                      if (c.mounted) snack(c, errText(e), error: true);
                    }
                  },
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
