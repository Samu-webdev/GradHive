import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/i18n.dart';
import '../core/session.dart';
import '../widgets/common.dart';

class AdminScreen extends StatelessWidget {
  const AdminScreen({super.key});
  @override
  Widget build(BuildContext context) => DefaultTabController(
    length: 3,
    child: Scaffold(
      appBar: AppBar(
        title: const Text('Administration'),
        bottom: TabBar(
          tabs: [
            Tab(text: context.tr('Indicateurs', 'Dashboard')),
            Tab(text: context.tr('Comptes', 'Accounts')),
            Tab(text: context.tr('Signalements', 'Reports')),
          ],
        ),
      ),
      body: const TabBarView(children: [_Dashboard(), _Users(), _Reports()]),
    ),
  );
}

class _Dashboard extends StatelessWidget {
  const _Dashboard();
  @override
  Widget build(BuildContext context) => Loader<Map>(
    load: () async =>
        (await context.read<Session>().api.get('/admin/dashboard'))['data']
            as Map,
    builder: (c, d, reload) {
      final acc = d['accounts'] as Map, opp = d['opportunities'] as Map;
      Widget row(String l, Object? v) => ListTile(
        dense: true,
        title: Text(l),
        trailing: Text(
          '$v',
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
      );
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          row(c.tr('Comptes', 'Accounts'), acc['total']),
          row(c.tr('Actifs', 'Active'), acc['active']),
          row(c.tr('Suspendus', 'Suspended'), acc['suspended']),
          for (final e in (acc['by_role'] as Map).entries)
            row('  ${c.lb.role('${e.key}')}', e.value),
          const Divider(),
          row(c.tr('Opportunités', 'Opportunities'), opp['total']),
          row(c.tr('Ouvertes', 'Open'), opp['open']),
          row(c.tr('Postes TA/RA', 'TA/RA positions'), opp['ta_ra_positions']),
          row(
            c.tr('Travaux académiques', 'Academic works'),
            d['academic_works'],
          ),
          row(
            c.tr('Candidatures (opportunités)', 'Applications (opportunities)'),
            d['opportunity_applications'],
          ),
          row(
            c.tr('Candidatures TA/RA', 'TA/RA applications'),
            d['ta_ra_applications'],
          ),
          row(c.tr('Signalements ouverts', 'Open reports'), d['open_reports']),
        ],
      );
    },
  );
}

class _Users extends StatefulWidget {
  const _Users();
  @override
  State<_Users> createState() => _UsersState();
}

class _UsersState extends State<_Users> {
  final _q = TextEditingController();
  int _k = 0;
  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(8),
          child: TextField(
            controller: _q,
            decoration: InputDecoration(
              hintText: context.tr('Nom ou e-mail', 'Name or email'),
              prefixIcon: const Icon(Icons.search),
              border: const OutlineInputBorder(),
            ),
            onSubmitted: (_) => setState(() => _k++),
          ),
        ),
        Expanded(
          child: Loader<List>(
            key: ValueKey(_k),
            load: () async =>
                (await api.get(
                      '/admin/users',
                      query: {'q': _q.text.trim()},
                    ))['data']
                    as List,
            builder: (c, items, reload) => ItemList(
              items: items,
              itemBuilder: (c, u) {
                final m = u as Map;
                final suspended = m['status'] == 'suspended';
                return Card(
                  child: ListTile(
                    title: Text('${m['name']}'),
                    subtitle: Text('${m['email']} · ${c.lb.role(m['role'])}'),
                    trailing: m['id'] == c.read<Session>().userId
                        ? null
                        : TextButton(
                            onPressed: () async {
                              try {
                                await api.patch(
                                  '/admin/users/${m['id']}/${suspended ? 'reactivate' : 'suspend'}',
                                );
                                setState(() => _k++);
                              } catch (e) {
                                if (c.mounted)
                                  snack(c, errText(e), error: true);
                              }
                            },
                            child: Text(
                              suspended
                                  ? c.tr('Réactiver', 'Reactivate')
                                  : c.tr('Suspendre', 'Suspend'),
                              style: TextStyle(
                                color: suspended ? Colors.green : Colors.red,
                              ),
                            ),
                          ),
                  ),
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _Reports extends StatefulWidget {
  const _Reports();
  @override
  State<_Reports> createState() => _ReportsState();
}

class _ReportsState extends State<_Reports> {
  int _k = 0;
  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    return Loader<List>(
      key: ValueKey(_k),
      load: () async =>
          (await api.get('/admin/reports', query: {'status': 'open'}))['data']
              as List,
      builder: (c, items, reload) => ItemList(
        items: items,
        empty: c.tr('Aucun signalement ouvert.', 'No open reports.'),
        itemBuilder: (c, r) {
          final m = r as Map;
          Future<void> set(String st) async {
            try {
              await api.patch('/admin/reports/${m['id']}', {'status': st});
              setState(() => _k++);
            } catch (e) {
              if (c.mounted) snack(c, errText(e), error: true);
            }
          }

          return Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${m['target_type']} · ${m['target_label'] ?? m['target_id']}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  Text(
                    '${m['reason']} — ${(m['reporter'] as Map?)?['name'] ?? ''} · ${fmtDate(m['created_at'])}',
                  ),
                  if (m['details'] != null) Text('${m['details']}'),
                  Row(
                    children: [
                      TextButton(
                        onPressed: () => set('reviewed'),
                        child: Text(c.tr('Traité', 'Reviewed')),
                      ),
                      TextButton(
                        onPressed: () => set('dismissed'),
                        child: Text(c.tr('Rejeter', 'Dismiss')),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
