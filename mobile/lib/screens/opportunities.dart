import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/i18n.dart';
import '../core/session.dart';
import '../widgets/common.dart';
import 'home.dart';

Widget opportunityCard(BuildContext c, Map o, {Widget? trailing}) {
  final lb = c.lb;
  return Card(
    child: ListTile(
      title: Text(
        '${o['title']}',
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${o['organization_name'] ?? (o['owner'] as Map?)?['name'] ?? ''}${o['location'] != null ? ' · ${o['location']}' : ''}',
          ),
          Wrap(
            children: [
              Chip2(lb.oppType(o['type'])),
              if (o['remote'] == true) Chip2(c.tr('À distance', 'Remote')),
              if (o['deadline'] != null)
                Chip2(
                  '${c.tr('Avant le', 'By')} ${o['deadline']}',
                  color: Colors.orange,
                ),
            ],
          ),
        ],
      ),
      trailing: trailing,
      onTap: () => c.push('/opportunites/${o['id']}'),
    ),
  );
}

class OpportunitiesListScreen extends StatefulWidget {
  const OpportunitiesListScreen({super.key});
  @override
  State<OpportunitiesListScreen> createState() =>
      _OpportunitiesListScreenState();
}

class _OpportunitiesListScreenState extends State<OpportunitiesListScreen> {
  final _q = TextEditingController();
  String type = '';
  int _k = 0;
  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    final lb = context.lb;
    return Scaffold(
      appBar: bar(
        context,
        context.tr('Opportunités', 'Opportunities'),
        actions: [
          if (context.watch<Session>().hasRole([
            'school',
            'company',
            'organization',
          ]))
            IconButton(
              icon: const Icon(Icons.edit_note),
              onPressed: () => context.push('/gestion-opportunites'),
            ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: TextField(
              controller: _q,
              decoration: InputDecoration(
                hintText: context.tr(
                  'Titre, organisation, compétence…',
                  'Title, organization, skill…',
                ),
                prefixIcon: const Icon(Icons.search),
                border: const OutlineInputBorder(),
              ),
              onSubmitted: (_) => setState(() => _k++),
            ),
          ),
          SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              children: [
                for (final t in ['', ...opportunityTypes])
                  Padding(
                    padding: const EdgeInsets.all(4),
                    child: ChoiceChip(
                      label: Text(
                        t.isEmpty ? context.tr('Toutes', 'All') : lb.oppType(t),
                      ),
                      selected: type == t,
                      onSelected: (_) => setState(() {
                        type = t;
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
                        '/opportunities',
                        query: {'q': _q.text.trim(), 'type': type},
                      ))['data']
                      as List,
              builder: (c, items, reload) => ItemList(
                items: items,
                itemBuilder: (c, o) => opportunityCard(c, o as Map),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class OpportunityDetailScreen extends StatefulWidget {
  const OpportunityDetailScreen({super.key, required this.id});
  final int id;
  @override
  State<OpportunityDetailScreen> createState() =>
      _OpportunityDetailScreenState();
}

class _OpportunityDetailScreenState extends State<OpportunityDetailScreen> {
  int _k = 0;
  final motivation = TextEditingController();
  final files = <String, PickedFile>{};
  String? error;

  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    final lb = context.lb;
    return Scaffold(
      appBar: bar(context, context.tr('Opportunité', 'Opportunity')),
      body: Loader<Map>(
        key: ValueKey(_k),
        load: () async =>
            (await s.api.get('/opportunities/${widget.id}'))['data'] as Map,
        builder: (c, o, reload) {
          final owner = o['owner'] as Map?;
          final docs = (o['required_documents'] as List?) ?? [];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      '${o['title']}',
                      style: Theme.of(c).textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.bold),
                    ),
                  ),
                  if (s.hasRole(['student']))
                    IconButton(
                      icon: Icon(
                        o['is_favorited'] == true
                            ? Icons.bookmark
                            : Icons.bookmark_border,
                      ),
                      onPressed: () async {
                        try {
                          o['is_favorited'] == true
                              ? await s.api.delete(
                                  '/opportunities/${widget.id}/favorite',
                                )
                              : await s.api.post(
                                  '/opportunities/${widget.id}/favorite',
                                );
                          setState(() => _k++);
                        } catch (e) {
                          snack(c, errText(e), error: true);
                        }
                      },
                    ),
                ],
              ),
              if (owner != null)
                InkWell(
                  onTap: () => c.push('/membres/${owner['id']}'),
                  child: Text(
                    '${o['organization_name'] ?? owner['name']}',
                    style: const TextStyle(color: brandDark),
                  ),
                ),
              Wrap(
                children: [
                  Chip2(lb.oppType(o['type'])),
                  if (o['location'] != null) Chip2('${o['location']}'),
                  if (o['country'] != null) Chip2('${o['country']}'),
                  if (o['remote'] == true) Chip2(c.tr('À distance', 'Remote')),
                  if (o['study_level'] != null)
                    Chip2(lb.level(o['study_level'])),
                  if (o['status'] != 'open')
                    Chip2(lb.status(o['status']), color: Colors.red),
                ],
              ),
              if (o['deadline'] != null)
                Section(
                  c.tr('Date limite', 'Deadline'),
                  children: [Text('${o['deadline']}')],
                ),
              if (o['funding'] != null)
                Section(
                  c.tr('Financement', 'Funding'),
                  children: [Text('${o['funding']}')],
                ),
              Section('Description', children: [Text('${o['description']}')]),
              if (o['requirements'] != null)
                Section(
                  c.tr('Conditions', 'Requirements'),
                  children: [Text('${o['requirements']}')],
                ),
              if ((o['skills'] as List).isNotEmpty)
                Section(
                  c.tr('Compétences', 'Skills'),
                  children: [
                    Wrap(children: [for (final k in o['skills']) Chip2('$k')]),
                  ],
                ),
              if (o['application_method'] != null)
                Section(
                  c.tr('Comment postuler', 'How to apply'),
                  children: [Text('${o['application_method']}')],
                ),
              ReportButton(type: 'opportunity', id: widget.id),
              const Divider(height: 28),
              if (!s.isLoggedIn)
                FilledButton(
                  onPressed: () =>
                      c.push('/connexion?redirect=/opportunites/${widget.id}'),
                  child: Text(
                    c.tr('Se connecter pour postuler', 'Sign in to apply'),
                  ),
                )
              else if (s.hasRole(['student']) && o['status'] == 'open') ...[
                Text(
                  c.tr('Postuler', 'Apply'),
                  style: Theme.of(c).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                field(
                  motivation,
                  c.tr(
                    'Message de motivation (20 caractères min.)',
                    'Motivation (20 chars min.)',
                  ),
                  lines: 4,
                ),
                for (final d in docs)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('${lb.doc('$d')} *'),
                    subtitle: Text(
                      files['$d']?.name ?? c.tr('Aucun fichier', 'No file'),
                    ),
                    trailing: const Icon(Icons.attach_file),
                    onTap: () async {
                      final f = await pickPdf(c, maxMb: 5);
                      if (f != null) setState(() => files['$d'] = f);
                    },
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
                  label: c.tr('Envoyer ma candidature', 'Send application'),
                  onPressed: () async {
                    try {
                      await s.api.multipart(
                        '/opportunities/${widget.id}/applications',
                        {
                          if (motivation.text.trim().isNotEmpty)
                            'motivation': motivation.text.trim(),
                        },
                        [
                          for (final e in files.entries)
                            UploadFile('documents[${e.key}]', e.value),
                        ],
                      );
                      if (!c.mounted) return;
                      snack(
                        c,
                        c.tr('Candidature envoyée.', 'Application sent.'),
                      );
                      c.go('/mes-candidatures-opportunites');
                    } on ApiException catch (e) {
                      setState(() => error = e.display);
                    }
                  },
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class FavoritesScreen extends StatelessWidget {
  const FavoritesScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: bar(
      context,
      context.tr('Opportunités enregistrées', 'Saved opportunities'),
    ),
    body: Loader<List>(
      load: () async =>
          (await context.read<Session>().api.get(
                '/my/favorite-opportunities',
              ))['data']
              as List,
      builder: (c, items, reload) => ItemList(
        items: items,
        itemBuilder: (c, o) => opportunityCard(c, o as Map),
      ),
    ),
  );
}

class MyOpportunityApplicationsScreen extends StatefulWidget {
  const MyOpportunityApplicationsScreen({super.key});
  @override
  State<MyOpportunityApplicationsScreen> createState() =>
      _MyOpportunityApplicationsScreenState();
}

class _MyOpportunityApplicationsScreenState
    extends State<MyOpportunityApplicationsScreen> {
  int _k = 0;
  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    return Scaffold(
      appBar: bar(context, context.tr('Mes candidatures', 'My applications')),
      body: Loader<List>(
        key: ValueKey(_k),
        load: () async =>
            (await api.get('/my/opportunity-applications'))['data'] as List,
        builder: (c, items, reload) => ItemList(
          items: items,
          itemBuilder: (c, a) {
            final m = a as Map;
            final o = m['opportunity'] as Map;
            final history = (m['history'] as List?) ?? [];
            final canWithdraw = [
              'submitted',
              'under_review',
              'shortlisted',
            ].contains(m['status']);
            return Card(
              child: ExpansionTile(
                title: Text('${o['title']}'),
                subtitle: Text(
                  '${c.lb.status(m['status'])} · ${fmtDate(m['created_at'])}',
                ),
                childrenPadding: const EdgeInsets.all(12),
                expandedCrossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (m['motivation'] != null) Text('${m['motivation']}'),
                  for (final h in history)
                    Text(
                      '${fmtDate((h as Map)['created_at'])} · ${c.lb.status(h['from_status'])} → ${c.lb.status(h['to_status'])}',
                      style: const TextStyle(fontSize: 12),
                    ),
                  Row(
                    children: [
                      TextButton(
                        onPressed: () => c.push('/opportunites/${o['id']}'),
                        child: Text(c.tr('Voir l’offre', 'View offer')),
                      ),
                      if (canWithdraw)
                        TextButton(
                          onPressed: () async {
                            if (!await confirm(
                              c,
                              c.tr(
                                'Retirer cette candidature ?',
                                'Withdraw this application?',
                              ),
                            ))
                              return;
                            try {
                              await api.patch(
                                '/my/opportunity-applications/${m['id']}/withdraw',
                              );
                              setState(() => _k++);
                            } catch (e) {
                              if (c.mounted) snack(c, errText(e), error: true);
                            }
                          },
                          child: Text(c.tr('Retirer', 'Withdraw')),
                        ),
                    ],
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

class OpportunityManagementScreen extends StatefulWidget {
  const OpportunityManagementScreen({super.key});
  @override
  State<OpportunityManagementScreen> createState() =>
      _OpportunityManagementScreenState();
}

class _OpportunityManagementScreenState
    extends State<OpportunityManagementScreen> {
  int _k = 0;
  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    return Scaffold(
      appBar: bar(
        context,
        context.tr('Gérer mes opportunités', 'Manage my opportunities'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await context.push('/gestion-opportunites/nouvelle');
          setState(() => _k++);
        },
        icon: const Icon(Icons.add),
        label: Text(context.tr('Publier', 'Publish')),
      ),
      body: Loader<List>(
        key: ValueKey(_k),
        load: () async => (await api.get('/my/opportunities'))['data'] as List,
        builder: (c, items, reload) => ItemList(
          items: items,
          empty: c.tr(
            'Aucune opportunité publiée.',
            'No opportunity published.',
          ),
          itemBuilder: (c, o) {
            final m = o as Map;
            return opportunityCard(
              c,
              m,
              trailing: PopupMenuButton<String>(
                onSelected: (a) async {
                  try {
                    if (a == 'apps') {
                      await c.push(
                        '/gestion-opportunites/${m['id']}/candidatures',
                      );
                    } else if (a == 'edit') {
                      await c.push('/gestion-opportunites/${m['id']}/modifier');
                    } else if (a == 'toggle') {
                      await api.put('/opportunities/${m['id']}', {
                        'status': m['status'] == 'open' ? 'closed' : 'open',
                      });
                    } else if (a == 'del' &&
                        await confirm(
                          c,
                          c.tr(
                            'Supprimer cette opportunité ?',
                            'Delete this opportunity?',
                          ),
                        )) {
                      await api.delete('/opportunities/${m['id']}');
                    }
                    setState(() => _k++);
                  } catch (e) {
                    if (c.mounted) snack(c, errText(e), error: true);
                  }
                },
                itemBuilder: (_) => [
                  PopupMenuItem(
                    value: 'apps',
                    child: Text(
                      c.tr('Candidatures reçues', 'Received applications'),
                    ),
                  ),
                  PopupMenuItem(
                    value: 'edit',
                    child: Text(c.tr('Modifier', 'Edit')),
                  ),
                  PopupMenuItem(
                    value: 'toggle',
                    child: Text(
                      m['status'] == 'open'
                          ? c.tr('Fermer', 'Close')
                          : c.tr('Rouvrir', 'Reopen'),
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

class OpportunityFormScreen extends StatefulWidget {
  const OpportunityFormScreen({super.key, this.id});
  final int? id;
  @override
  State<OpportunityFormScreen> createState() => _OpportunityFormScreenState();
}

class _OpportunityFormScreenState extends State<OpportunityFormScreen> {
  final _form = GlobalKey<FormState>();
  final title = TextEditingController(),
      org = TextEditingController(),
      location = TextEditingController(),
      country = TextEditingController();
  final funding = TextEditingController(),
      description = TextEditingController(),
      requirements = TextEditingController();
  final skills = TextEditingController(),
      method = TextEditingController(),
      empType = TextEditingController();
  String type = 'employment', studyLevel = '', status = 'open';
  bool remote = false;
  DateTime? deadline;
  final docs = <String>{};
  bool loaded = false;
  String? error;

  @override
  void initState() {
    super.initState();
    if (widget.id == null) {
      loaded = true;
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        final o =
            (await context.read<Session>().api.get(
                  '/opportunities/${widget.id}',
                ))['data']
                as Map;
        type = o['type'];
        title.text = '${o['title']}';
        org.text = '${o['organization_name'] ?? ''}';
        location.text = '${o['location'] ?? ''}';
        country.text = '${o['country'] ?? ''}';
        funding.text = '${o['funding'] ?? ''}';
        description.text = '${o['description']}';
        requirements.text = '${o['requirements'] ?? ''}';
        skills.text = (o['skills'] as List).join(', ');
        method.text = '${o['application_method'] ?? ''}';
        empType.text = '${o['employment_type'] ?? ''}';
        studyLevel = o['study_level'] ?? '';
        status = o['status'];
        remote = o['remote'] == true;
        deadline = DateTime.tryParse('${o['deadline'] ?? ''}');
        docs.addAll((o['required_documents'] as List).map((e) => '$e'));
      } catch (e) {
        error = errText(e);
      }
      if (mounted) setState(() => loaded = true);
    });
  }

  String? _n(TextEditingController c) =>
      c.text.trim().isEmpty ? null : c.text.trim();

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    final body = <String, dynamic>{
      'type': type,
      'title': title.text.trim(),
      'organization_name': _n(org),
      'location': _n(location),
      'country': _n(country),
      'remote': remote,
      'employment_type': _n(empType),
      'funding': _n(funding),
      'description': description.text.trim(),
      'study_level': studyLevel.isEmpty ? null : studyLevel,
      'requirements': _n(requirements),
      'skills': skills.text
          .split(',')
          .map((e) => e.trim())
          .where((e) => e.isNotEmpty)
          .toList(),
      'required_documents': docs.toList(),
      'application_method': _n(method),
      'status': status,
      'deadline': deadline == null
          ? null
          : deadline!.toIso8601String().substring(0, 10),
    };
    try {
      widget.id == null
          ? await context.read<Session>().api.post('/opportunities', body)
          : await context.read<Session>().api.put(
              '/opportunities/${widget.id}',
              body,
            );
      if (mounted) context.pop();
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
            ? context.tr('Nouvelle opportunité', 'New opportunity')
            : context.tr('Modifier', 'Edit'),
      ),
      body: !loaded
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  dropdown('Type', type, {
                    for (final t in opportunityTypes) t: lb.oppType(t),
                  }, (v) => setState(() => type = v ?? type)),
                  field(title, context.tr('Titre', 'Title'), required: true),
                  field(org, context.tr('Organisation', 'Organization')),
                  field(location, context.tr('Lieu', 'Location')),
                  field(country, context.tr('Pays', 'Country')),
                  SwitchListTile(
                    value: remote,
                    onChanged: (v) => setState(() => remote = v),
                    title: Text(context.tr('À distance', 'Remote')),
                  ),
                  field(
                    empType,
                    context.tr('Type de contrat', 'Employment type'),
                  ),
                  field(funding, context.tr('Financement', 'Funding')),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      deadline == null
                          ? context.tr(
                              'Date limite (facultative)',
                              'Deadline (optional)',
                            )
                          : '${context.tr('Date limite', 'Deadline')} : ${deadline!.toIso8601String().substring(0, 10)}',
                    ),
                    trailing: const Icon(Icons.calendar_today),
                    onTap: () async {
                      final d = await showDatePicker(
                        context: context,
                        initialDate:
                            deadline ??
                            DateTime.now().add(const Duration(days: 30)),
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(
                          const Duration(days: 3650),
                        ),
                      );
                      if (d != null) setState(() => deadline = d);
                    },
                  ),
                  field(
                    description,
                    'Description (20 car. min.)',
                    lines: 5,
                    required: true,
                  ),
                  dropdown(
                    context.tr('Niveau d’études visé', 'Target study level'),
                    studyLevel,
                    {for (final l in levels) l: lb.level(l)},
                    (v) => setState(() => studyLevel = v ?? ''),
                    allowEmpty: true,
                  ),
                  field(
                    requirements,
                    context.tr('Conditions', 'Requirements'),
                    lines: 3,
                  ),
                  field(
                    skills,
                    context.tr(
                      'Compétences (séparées par des virgules)',
                      'Skills (comma-separated)',
                    ),
                  ),
                  Text(
                    context.tr(
                      'Pièces à fournir par les candidats',
                      'Documents required from applicants',
                    ),
                  ),
                  Wrap(
                    spacing: 6,
                    children: [
                      for (final d in documentTypes)
                        FilterChip(
                          label: Text(lb.doc(d)),
                          selected: docs.contains(d),
                          onSelected: (v) =>
                              setState(() => v ? docs.add(d) : docs.remove(d)),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  field(
                    method,
                    context.tr('Comment postuler', 'How to apply'),
                    lines: 2,
                  ),
                  dropdown(context.tr('Statut', 'Status'), status, {
                    for (final x in ['draft', 'open', 'closed'])
                      x: lb.status(x),
                  }, (v) => setState(() => status = v ?? status)),
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

class ReceivedApplicationsScreen extends StatefulWidget {
  const ReceivedApplicationsScreen({super.key, required this.id});
  final int id;
  @override
  State<ReceivedApplicationsScreen> createState() =>
      _ReceivedApplicationsScreenState();
}

class _ReceivedApplicationsScreenState
    extends State<ReceivedApplicationsScreen> {
  int _k = 0;
  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    return Scaffold(
      appBar: bar(
        context,
        context.tr('Candidatures reçues', 'Received applications'),
      ),
      body: Loader<List>(
        key: ValueKey(_k),
        load: () async =>
            (await api.get(
                  '/my/opportunities/${widget.id}/applications',
                ))['data']
                as List,
        builder: (c, items, reload) => ItemList(
          items: items,
          itemBuilder: (c, a) {
            final m = a as Map;
            final who = m['applicant'] as Map?;
            return Card(
              child: ExpansionTile(
                title: Text('${who?['name'] ?? ''}'),
                subtitle: Text(
                  '${c.lb.status(m['status'])} · ${fmtDate(m['created_at'])}',
                ),
                childrenPadding: const EdgeInsets.all(12),
                expandedCrossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${who?['institution'] ?? ''} ${who?['field_of_study'] ?? ''}',
                  ),
                  if (m['motivation'] != null)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Text('${m['motivation']}'),
                    ),
                  for (final d in (m['documents'] as List))
                    TextButton.icon(
                      icon: const Icon(Icons.picture_as_pdf),
                      label: Text(
                        '${c.lb.doc((d as Map)['type'])} — ${d['name']}',
                      ),
                      onPressed: () => openPdf(
                        c,
                        '/opportunity-applications/${m['id']}/documents/${d['id']}',
                        'application-${m['id']}-${d['id']}.pdf',
                      ),
                    ),
                  Wrap(
                    spacing: 6,
                    children: [
                      for (final st in [
                        'under_review',
                        'shortlisted',
                        'accepted',
                        'rejected',
                      ])
                        if (st != m['status'])
                          ActionChip(
                            label: Text(c.lb.status(st)),
                            onPressed: () async {
                              try {
                                await api.patch(
                                  '/opportunities/${widget.id}/applications/${m['id']}/status',
                                  {'status': st},
                                );
                                setState(() => _k++);
                              } catch (e) {
                                if (c.mounted)
                                  snack(c, errText(e), error: true);
                              }
                            },
                          ),
                    ],
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
