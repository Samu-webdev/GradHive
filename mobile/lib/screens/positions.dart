import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/api.dart';
import '../core/i18n.dart';
import '../core/session.dart';
import '../widgets/common.dart';
import 'home.dart';

class PositionsListScreen extends StatefulWidget {
  const PositionsListScreen({super.key});
  @override
  State<PositionsListScreen> createState() => _PositionsListScreenState();
}

class _PositionsListScreenState extends State<PositionsListScreen> {
  final _q = TextEditingController();
  String type = '';
  int _k = 0;
  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    return Scaffold(
      appBar: bar(context, context.tr('Postes TA/RA', 'TA/RA positions')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
            child: TextField(
              controller: _q,
              decoration: InputDecoration(
                hintText: context.tr(
                  'Titre, domaine, université…',
                  'Title, field, university…',
                ),
                prefixIcon: const Icon(Icons.search),
                border: const OutlineInputBorder(),
              ),
              onSubmitted: (_) => setState(() => _k++),
            ),
          ),
          Wrap(
            children: [
              for (final t in ['', 'TA', 'RA'])
                Padding(
                  padding: const EdgeInsets.all(6),
                  child: ChoiceChip(
                    label: Text(t.isEmpty ? context.tr('Tous', 'All') : t),
                    selected: type == t,
                    onSelected: (_) => setState(() {
                      type = t;
                      _k++;
                    }),
                  ),
                ),
            ],
          ),
          Expanded(
            child: Loader<List>(
              key: ValueKey(_k),
              load: () async =>
                  (await api.get(
                        '/positions',
                        query: {'q': _q.text.trim(), 'type': type},
                      ))['data']
                      as List,
              builder: (c, items, reload) => ItemList(
                items: items,
                itemBuilder: (c, p) {
                  final m = p as Map;
                  final u = m['university'] as Map?;
                  return Card(
                    child: ListTile(
                      title: Text('${m['title']}'),
                      subtitle: Text(
                        '${u?['name'] ?? ''} · ${u?['country'] ?? ''}\n${c.tr('Date limite', 'Deadline')} : ${m['deadline']}',
                      ),
                      isThreeLine: true,
                      leading: Chip2('${m['type']}'),
                      onTap: () => c.push('/postes/${m['id']}'),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class PositionApplyScreen extends StatefulWidget {
  const PositionApplyScreen({super.key, required this.id});
  final int id;
  @override
  State<PositionApplyScreen> createState() => _PositionApplyScreenState();
}

class _PositionApplyScreenState extends State<PositionApplyScreen> {
  final gpa = TextEditingController(),
      langTest = TextEditingController(),
      langScore = TextEditingController(),
      motivation = TextEditingController();
  String level = 'master';
  bool waiver = false;
  final files = <String, PickedFile>{};
  Map? check;
  String? error;
  bool done = false;

  Map<String, dynamic> _eligibilityBody(Map p) => {
    'gpa': double.tryParse(gpa.text.replaceAll(',', '.')),
    'level': level,
    'language_test': langTest.text.trim().isEmpty ? null : langTest.text.trim(),
    'language_score': double.tryParse(langScore.text.replaceAll(',', '.')),
    'language_waiver': waiver,
    'documents': files.keys.toList(),
  };

  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    final lb = context.lb;
    return Scaffold(
      appBar: bar(context, context.tr('Poste TA/RA', 'TA/RA position')),
      body: Loader<Map>(
        load: () async =>
            (await s.api.get('/positions/${widget.id}'))['data'] as Map,
        builder: (c, p, reload) {
          final u = p['university'] as Map?;
          final langs = (p['language_requirements'] as Map?) ?? {};
          final docs = (p['required_documents_labels'] as List?) ?? [];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(
                '${p['title']}',
                style: Theme.of(c).textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              Text(
                '${u?['name'] ?? ''} · ${u?['city'] ?? ''}, ${u?['country'] ?? ''}',
              ),
              Wrap(
                children: [
                  Chip2('${p['type']}'),
                  Chip2(lb.level(p['required_level'])),
                  Chip2(
                    '${c.tr('Moyenne min.', 'Min. average')} ${p['min_average']}/20',
                  ),
                  Chip2('${p['seats']} ${c.tr('place(s)', 'seat(s)')}'),
                ],
              ),
              Section(
                c.tr('Description', 'Description'),
                children: [
                  Text('${p['description'] ?? ''}'),
                  Text('${p['department']} · ${p['field']}'),
                ],
              ),
              Section(
                c.tr('Financement', 'Funding'),
                children: [Text('${p['funding']}')],
              ),
              Section(
                c.tr('Date limite', 'Deadline'),
                children: [Text('${p['deadline']}')],
              ),
              if (langs.isNotEmpty)
                Section(
                  c.tr('Langue', 'Language'),
                  children: [
                    Text(
                      langs.entries
                              .map((e) => '${e.key} ≥ ${e.value}')
                              .join(' · ') +
                          (p['language_waiver_allowed'] == true
                              ? c.tr(
                                  ' (dispense possible)',
                                  ' (waiver possible)',
                                )
                              : ''),
                    ),
                  ],
                ),
              const Divider(height: 32),
              if (!s.isLoggedIn)
                FilledButton(
                  onPressed: () =>
                      c.push('/connexion?redirect=/postes/${widget.id}'),
                  child: Text(
                    c.tr('Se connecter pour postuler', 'Sign in to apply'),
                  ),
                )
              else if (!s.hasRole(['student']))
                Text(
                  c.tr(
                    'Seuls les étudiants peuvent postuler.',
                    'Only students can apply.',
                  ),
                )
              else if (done)
                Text(
                  c.tr('Candidature envoyée avec succès.', 'Application sent.'),
                  style: const TextStyle(
                    color: Colors.green,
                    fontWeight: FontWeight.bold,
                  ),
                )
              else ...[
                Text(
                  c.tr('Candidature', 'Application'),
                  style: Theme.of(c).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                field(
                  gpa,
                  c.tr('Moyenne (sur 20)', 'Average (out of 20)'),
                  type: const TextInputType.numberWithOptions(decimal: true),
                ),
                dropdown(c.tr('Niveau', 'Level'), level, {
                  for (final l in levels) l: lb.level(l),
                }, (v) => setState(() => level = v ?? level)),
                if (langs.isNotEmpty) ...[
                  field(
                    langTest,
                    c.tr(
                      'Test de langue (TOEFL, IELTS…)',
                      'Language test (TOEFL, IELTS…)',
                    ),
                  ),
                  field(
                    langScore,
                    c.tr('Score', 'Score'),
                    type: const TextInputType.numberWithOptions(decimal: true),
                  ),
                  if (p['language_waiver_allowed'] == true)
                    SwitchListTile(
                      value: waiver,
                      onChanged: (v) => setState(() => waiver = v),
                      title: Text(
                        c.tr(
                          'Demander une dispense de test',
                          'Request a test waiver',
                        ),
                      ),
                    ),
                ],
                field(
                  motivation,
                  c.tr(
                    'Message au comité (50 caractères min.)',
                    'Message to the committee (50 chars min.)',
                  ),
                  lines: 5,
                ),
                for (final d in docs)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('${d['label']}'),
                    subtitle: Text(
                      files['${d['key']}']?.name ??
                          c.tr('Aucun fichier', 'No file'),
                    ),
                    trailing: const Icon(Icons.attach_file),
                    onTap: () async {
                      final f = await pickPdf(c, maxMb: 5);
                      if (f != null) setState(() => files['${d['key']}'] = f);
                    },
                  ),
                if (check != null)
                  Card(
                    color: check!['eligible'] == true
                        ? Colors.green.shade50
                        : Colors.orange.shade50,
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            check!['eligible'] == true
                                ? c.tr(
                                    'Vous remplissez les conditions.',
                                    'You meet the requirements.',
                                  )
                                : c.tr(
                                    'Conditions non remplies :',
                                    'Requirements not met:',
                                  ),
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          for (final k in (check!['checks'] as List? ?? []))
                            Text(
                              '${(k as Map)['ok'] == true ? '✓' : '✗'} ${k['label']}',
                            ),
                        ],
                      ),
                    ),
                  ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      error!,
                      style: TextStyle(color: Colors.red.shade700),
                    ),
                  ),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () async {
                          try {
                            final r = await s.api.post(
                              '/positions/${widget.id}/check',
                              _eligibilityBody(p),
                            );
                            setState(() {
                              check = r as Map;
                              error = null;
                            });
                          } catch (e) {
                            setState(() => error = errText(e));
                          }
                        },
                        child: Text(
                          c.tr('Vérifier mes conditions', 'Check eligibility'),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: BusyButton(
                        label: c.tr('Postuler', 'Apply'),
                        onPressed: () async {
                          final fields = <String, String>{
                            'gpa': gpa.text.replaceAll(',', '.'),
                            'level': level,
                            'motivation': motivation.text.trim(),
                            'language_waiver': waiver ? '1' : '0',
                            if (langTest.text.trim().isNotEmpty)
                              'language_test': langTest.text.trim(),
                            if (langScore.text.trim().isNotEmpty)
                              'language_score': langScore.text.replaceAll(
                                ',',
                                '.',
                              ),
                          };
                          try {
                            await s.api.multipart(
                              '/positions/${widget.id}/applications',
                              fields,
                              [
                                for (final e in files.entries)
                                  UploadFile('documents[${e.key}]', e.value),
                              ],
                            );
                            setState(() {
                              done = true;
                              error = null;
                            });
                          } on ApiException catch (e) {
                            setState(() {
                              error = e.display;
                              if (e.status == 422 &&
                                  e.errors.containsKey('conditions'))
                                error =
                                    '${c.tr('Conditions non remplies', 'Requirements not met')} : ${e.errors['conditions']!.join(', ')}';
                            });
                          }
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}

class MyApplicationsScreen extends StatelessWidget {
  const MyApplicationsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    return Scaffold(
      appBar: bar(
        context,
        context.tr('Mes candidatures TA/RA', 'My TA/RA applications'),
      ),
      body: Loader<List>(
        load: () async => (await api.get('/my/applications'))['data'] as List,
        builder: (c, items, reload) => ItemList(
          items: items,
          itemBuilder: (c, a) {
            final m = a as Map;
            final p = m['position'] as Map;
            return Card(
              child: ListTile(
                title: Text('${p['title']}'),
                subtitle: Text(
                  '${(p['university'] as Map?)?['name'] ?? ''} · ${fmtDate(m['created_at'])}',
                ),
                trailing: Chip2(c.lb.status(m['status'])),
                onTap: () => c.push('/postes/${p['id']}'),
              ),
            );
          },
        ),
      ),
    );
  }
}
