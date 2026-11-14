import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/i18n.dart';
import '../core/session.dart';
import '../widgets/common.dart';
import 'home.dart';

Widget workCard(BuildContext c, Map w, {Widget? trailing}) {
  final lb = c.lb;
  return Card(
    child: ListTile(
      title: Text(
        '${w['title']}',
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${w['author_name'] ?? ''}${w['institution'] != null ? ' · ${w['institution']}' : ''} · ${w['year']}',
          ),
          Wrap(
            children: [
              Chip2(lb.workType(w['type'])),
              Chip2(lb.level(w['level'])),
              if (w['visibility'] == 'private')
                Chip2(c.tr('Privé', 'Private'), color: Colors.orange),
            ],
          ),
        ],
      ),
      trailing: trailing,
      onTap: () => c.push('/memoires/${w['id']}'),
    ),
  );
}

class WorksListScreen extends StatefulWidget {
  const WorksListScreen({super.key});
  @override
  State<WorksListScreen> createState() => _WorksListScreenState();
}

class _WorksListScreenState extends State<WorksListScreen> {
  final _q = TextEditingController();
  String level = '', type = '';
  int _k = 0;

  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    final lb = context.lb;
    return Scaffold(
      appBar: bar(
        context,
        context.tr('Projets et mémoires', 'Projects & theses'),
      ),
      floatingActionButton: context.watch<Session>().hasRole(['student'])
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/memoires/publier'),
              icon: const Icon(Icons.add),
              label: Text(context.tr('Publier', 'Publish')),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: TextField(
              controller: _q,
              decoration: InputDecoration(
                hintText: context.tr(
                  'Titre, thème, mot-clé, auteur…',
                  'Title, theme, keyword, author…',
                ),
                prefixIcon: const Icon(Icons.search),
                border: const OutlineInputBorder(),
              ),
              textInputAction: TextInputAction.search,
              onSubmitted: (_) => setState(() => _k++),
            ),
          ),
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              children: [
                for (final l in ['', ...levels])
                  Padding(
                    padding: const EdgeInsets.all(4),
                    child: ChoiceChip(
                      label: Text(
                        l.isEmpty
                            ? context.tr('Tous niveaux', 'All levels')
                            : lb.level(l),
                      ),
                      selected: level == l,
                      onSelected: (_) => setState(() {
                        level = l;
                        _k++;
                      }),
                    ),
                  ),
                for (final t in workTypes)
                  Padding(
                    padding: const EdgeInsets.all(4),
                    child: ChoiceChip(
                      label: Text(lb.workType(t)),
                      selected: type == t,
                      onSelected: (s) => setState(() {
                        type = s ? t : '';
                        _k++;
                      }),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: Loader<List>(
              key: ValueKey(_k),
              load: () async =>
                  (await api.get(
                        '/works',
                        query: {
                          'q': _q.text.trim(),
                          'level': level,
                          'type': type,
                        },
                      ))['data']
                      as List,
              builder: (c, items, reload) => ItemList(
                items: items,
                itemBuilder: (c, w) => workCard(c, w as Map),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class WorkDetailScreen extends StatelessWidget {
  const WorkDetailScreen({super.key, required this.id});
  final int id;
  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    final lb = context.lb;
    return Scaffold(
      appBar: bar(context, context.tr('Détail du travail', 'Work detail')),
      body: Loader<Map>(
        load: () async => (await s.api.get('/works/$id'))['data'] as Map,
        builder: (c, w, reload) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              '${w['title']}',
              style: Theme.of(c).textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            InkWell(
              onTap: () => c.push('/etudiants/${w['author_id']}'),
              child: Text(
                '${w['author_name']}${w['institution'] != null ? ' · ${w['institution']}' : ''}',
                style: const TextStyle(color: brandDark),
              ),
            ),
            Wrap(
              children: [
                Chip2(lb.workType(w['type'])),
                Chip2(lb.level(w['level'])),
                Chip2('${w['year']}'),
                if (w['mention'] != null) Chip2(lb.mention(w['mention'])),
                if (w['visibility'] == 'private')
                  Chip2(c.tr('Privé', 'Private'), color: Colors.orange),
              ],
            ),
            Section(
              c.tr('Résumé', 'Abstract'),
              children: [Text('${w['abstract']}')],
            ),
            Section(c.tr('Thème', 'Theme'), children: [Text('${w['theme']}')]),
            if (w['supervisor'] != null)
              Section(
                c.tr('Encadreur', 'Supervisor'),
                children: [Text('${w['supervisor']}')],
              ),
            Section(
              c.tr('Mots-clés', 'Keywords'),
              children: [
                Wrap(
                  children: [
                    for (final k in (w['keywords'] as List)) Chip2('$k'),
                  ],
                ),
              ],
            ),
            Text(
              '${w['views']} ${c.tr('vues', 'views')}',
              style: const TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 16),
            if (w['file_available'] == true)
              FilledButton.icon(
                icon: const Icon(Icons.picture_as_pdf),
                label: Text(c.tr('Ouvrir le PDF', 'Open PDF')),
                onPressed: () =>
                    openPdf(c, '/works/$id/download', 'work-$id.pdf'),
              ),
            Align(
              alignment: Alignment.centerLeft,
              child: ReportButton(type: 'work', id: id),
            ),
            Text(
              c.tr(
                'La publication ne vaut pas validation académique : le travail a été validé par son établissement.',
                'Publication is not academic validation: the work was validated by its institution.',
              ),
              style: const TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}

class MyWorksScreen extends StatefulWidget {
  const MyWorksScreen({super.key});
  @override
  State<MyWorksScreen> createState() => _MyWorksScreenState();
}

class _MyWorksScreenState extends State<MyWorksScreen> {
  int _k = 0;
  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    return Scaffold(
      appBar: bar(context, context.tr('Mes projets', 'My projects')),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await context.push('/memoires/publier');
          setState(() => _k++);
        },
        child: const Icon(Icons.add),
      ),
      body: Loader<List>(
        key: ValueKey(_k),
        load: () async => (await api.get('/my/works'))['data'] as List,
        builder: (c, items, reload) => ItemList(
          items: items,
          empty: c.tr(
            'Vous n’avez encore rien publié.',
            'Nothing published yet.',
          ),
          itemBuilder: (c, w) {
            final m = w as Map;
            return workCard(
              c,
              m,
              trailing: PopupMenuButton<String>(
                onSelected: (a) async {
                  try {
                    if (a == 'edit') {
                      await c.push('/memoires/${m['id']}/modifier');
                    } else if (a == 'vis') {
                      await api.put('/works/${m['id']}', {
                        'visibility': m['visibility'] == 'public'
                            ? 'private'
                            : 'public',
                      });
                    } else if (a == 'del' &&
                        await confirm(
                          c,
                          c.tr('Supprimer ce travail ?', 'Delete this work?'),
                        )) {
                      await api.delete('/works/${m['id']}');
                    }
                    setState(() => _k++);
                  } catch (e) {
                    if (c.mounted) snack(c, errText(e), error: true);
                  }
                },
                itemBuilder: (_) => [
                  PopupMenuItem(
                    value: 'edit',
                    child: Text(c.tr('Modifier', 'Edit')),
                  ),
                  PopupMenuItem(
                    value: 'vis',
                    child: Text(
                      m['visibility'] == 'public'
                          ? c.tr('Rendre privé', 'Make private')
                          : c.tr('Rendre public', 'Make public'),
                    ),
                  ),
                  PopupMenuItem(
                    value: 'del',
                    child: Text(c.tr('Supprimer', 'Delete')),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Publication (POST multipart avec PDF) ou modification des métadonnées (PUT JSON) d'un travail.
class WorkFormScreen extends StatefulWidget {
  const WorkFormScreen({super.key, this.id});
  final int? id;
  @override
  State<WorkFormScreen> createState() => _WorkFormScreenState();
}

class _WorkFormScreenState extends State<WorkFormScreen> {
  final _form = GlobalKey<FormState>();
  final title = TextEditingController(),
      abstract0 = TextEditingController(),
      theme = TextEditingController();
  final year = TextEditingController(text: '${DateTime.now().year}'),
      supervisor = TextEditingController(),
      keywords = TextEditingController();
  String level = 'licence',
      type = 'project',
      visibility = 'public',
      mention = '';
  PickedFile? file;
  bool loaded = false;
  String? error;

  @override
  void initState() {
    super.initState();
    if (widget.id == null) {
      loaded = true;
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        try {
          final w =
              (await context.read<Session>().api.get(
                    '/works/${widget.id}',
                  ))['data']
                  as Map;
          title.text = '${w['title']}';
          abstract0.text = '${w['abstract']}';
          theme.text = '${w['theme']}';
          year.text = '${w['year']}';
          supervisor.text = '${w['supervisor'] ?? ''}';
          keywords.text = (w['keywords'] as List).join(', ');
          level = w['level'];
          type = w['type'];
          visibility = w['visibility'];
          mention = w['mention'] ?? '';
        } catch (e) {
          error = errText(e);
        }
        if (mounted) setState(() => loaded = true);
      });
    }
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (widget.id == null && file == null) {
      setState(
        () => error = context.tr(
          'Le fichier PDF est obligatoire.',
          'The PDF file is required.',
        ),
      );
      return;
    }
    setState(() => error = null);
    final api = context.read<Session>().api;
    final fields = {
      'title': title.text.trim(),
      'abstract': abstract0.text.trim(),
      'theme': theme.text.trim(),
      'level': level,
      'year': year.text.trim(),
      'keywords': keywords.text.trim(),
      'type': type,
      'visibility': visibility,
      if (supervisor.text.trim().isNotEmpty)
        'supervisor': supervisor.text.trim(),
      if (mention.isNotEmpty) 'mention': mention,
    };
    try {
      if (widget.id == null) {
        await api.multipart('/works', fields, [UploadFile('file', file!)]);
      } else {
        await api.put('/works/${widget.id}', {
          ...fields,
          'mention': mention.isEmpty ? null : mention,
          'supervisor': supervisor.text.trim().isEmpty
              ? null
              : supervisor.text.trim(),
        });
      }
      if (!mounted) return;
      snack(context, context.tr('Enregistré.', 'Saved.'));
      context.go('/mes-memoires');
    } catch (e) {
      setState(() => error = errText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final lb = context.lb;
    return Scaffold(
      appBar: bar(
        context,
        widget.id == null
            ? context.tr('Publier un projet', 'Publish a project')
            : context.tr('Modifier', 'Edit'),
      ),
      body: !loaded
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    context.tr(
                      'La publication ne constitue pas une validation académique : le mémoire doit déjà avoir été soutenu et validé par votre établissement.',
                      'Publishing is not academic validation: the work must already be defended and validated by your institution.',
                    ),
                    style: const TextStyle(fontSize: 13),
                  ),
                  const SizedBox(height: 12),
                  field(title, context.tr('Titre', 'Title'), required: true),
                  field(
                    abstract0,
                    context.tr(
                      'Résumé (30 caractères min.)',
                      'Abstract (30 chars min.)',
                    ),
                    lines: 5,
                    required: true,
                  ),
                  dropdown(context.tr('Type', 'Type'), type, {
                    for (final t in workTypes) t: lb.workType(t),
                  }, (v) => setState(() => type = v ?? type)),
                  dropdown(context.tr('Visibilité', 'Visibility'), visibility, {
                    'public': context.tr('Public', 'Public'),
                    'private': context.tr('Privé', 'Private'),
                  }, (v) => setState(() => visibility = v ?? visibility)),
                  field(theme, context.tr('Thème', 'Theme'), required: true),
                  dropdown(context.tr('Niveau', 'Level'), level, {
                    for (final l in levels) l: lb.level(l),
                  }, (v) => setState(() => level = v ?? level)),
                  field(
                    year,
                    context.tr('Année de soutenance', 'Defense year'),
                    type: TextInputType.number,
                    required: true,
                  ),
                  dropdown(
                    context.tr('Mention', 'Grade'),
                    mention,
                    {for (final m in mentions) m: lb.mention(m)},
                    (v) => setState(() => mention = v ?? ''),
                    allowEmpty: true,
                  ),
                  field(
                    supervisor,
                    context.tr(
                      'Encadreur (facultatif)',
                      'Supervisor (optional)',
                    ),
                  ),
                  field(
                    keywords,
                    context.tr(
                      'Mots-clés et technologies (séparés par des virgules)',
                      'Keywords & technologies (comma-separated)',
                    ),
                    required: true,
                  ),
                  if (widget.id == null) ...[
                    OutlinedButton.icon(
                      icon: const Icon(Icons.attach_file),
                      label: Text(
                        file?.name ??
                            context.tr(
                              'Choisir le PDF (20 Mo max)',
                              'Choose PDF (20 MB max)',
                            ),
                      ),
                      onPressed: () async {
                        final f = await pickPdf(context);
                        if (f != null) setState(() => file = f);
                      },
                    ),
                    const SizedBox(height: 12),
                  ],
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
                    onPressed: _submit,
                  ),
                ],
              ),
            ),
    );
  }
}
