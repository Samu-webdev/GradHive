import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/i18n.dart';
import '../core/session.dart';
import '../widgets/common.dart';
import 'home.dart';
import 'opportunities.dart';
import 'works.dart';

String _profilePath(Map m) => m['role'] == 'student'
    ? '/etudiants/${m['id']}'
    : (m['role'] == 'school'
          ? '/etablissements/${m['id']}'
          : '/membres/${m['id']}');

Widget memberTile(BuildContext c, Map m, {Widget? trailing}) => Card(
  child: ListTile(
    leading: CircleAvatar(
      backgroundColor: brand,
      child: Text(
        ('${m['name']}'.isEmpty ? '?' : '${m['name']}'[0]).toUpperCase(),
        style: const TextStyle(color: Colors.white),
      ),
    ),
    title: Text('${m['name']}'),
    subtitle: Text(
      '${c.lb.role(m['role'])}${m['institution'] != null ? ' · ${m['institution']}' : ''}${m['country'] != null ? ' · ${m['country']}' : ''}',
    ),
    trailing: trailing,
    onTap: () => c.push(_profilePath(m)),
  ),
);

class DirectoryScreen extends StatefulWidget {
  const DirectoryScreen({super.key});
  @override
  State<DirectoryScreen> createState() => _DirectoryScreenState();
}

class _DirectoryScreenState extends State<DirectoryScreen> {
  final _q = TextEditingController();
  String role = '';
  int _k = 0;

  Widget _connect(BuildContext c, Map m, Session s) {
    switch (m['connection']) {
      case 'connected':
        return const Icon(Icons.check_circle, color: Colors.green);
      case 'pending_out':
        return Chip2(c.tr('Envoyée', 'Sent'));
      case 'pending_in':
        return Chip2(c.tr('À accepter', 'To accept'));
      case 'none':
        return IconButton(
          icon: const Icon(Icons.person_add_alt),
          onPressed: () async {
            try {
              await s.api.post('/connections', {'user_id': m['id']});
              setState(() => _k++);
            } catch (e) {
              snack(c, errText(e), error: true);
            }
          },
        );
      default:
        return const SizedBox.shrink();
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    final lb = context.lb;
    return Scaffold(
      appBar: bar(
        context,
        context.tr('Annuaire', 'Directory'),
        actions: [
          if (s.isLoggedIn)
            IconButton(
              icon: const Icon(Icons.people),
              onPressed: () => context.push('/connexions'),
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
                  'Nom, établissement, filière…',
                  'Name, institution, field…',
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
                for (final r in [
                  '',
                  'student',
                  'school',
                  'company',
                  'mentor',
                  'organization',
                ])
                  Padding(
                    padding: const EdgeInsets.all(4),
                    child: ChoiceChip(
                      label: Text(
                        r.isEmpty ? context.tr('Tous', 'All') : lb.role(r),
                      ),
                      selected: role == r,
                      onSelected: (_) => setState(() {
                        role = r;
                        _k++;
                      }),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: Loader<List>(
              key: ValueKey('${_k}${s.isLoggedIn}'),
              // Connecté : annuaire complet ; visiteur : recherche publique (2 caractères minimum).
              load: () async {
                if (s.isLoggedIn)
                  return (await s.api.get(
                        '/members',
                        query: {'q': _q.text.trim(), 'role': role},
                      ))['data']
                      as List;
                if (_q.text.trim().length < 2) return [];
                return (await s.api.get(
                      '/search/members',
                      query: {'q': _q.text.trim()},
                    ))['data']
                    as List;
              },
              builder: (c, items, reload) => ItemList(
                items: items,
                empty: s.isLoggedIn
                    ? null
                    : c.tr(
                        'Saisissez au moins 2 caractères pour rechercher, ou connectez-vous.',
                        'Type at least 2 characters, or sign in.',
                      ),
                itemBuilder: (c, m) => memberTile(
                  c,
                  m as Map,
                  trailing: s.isLoggedIn ? _connect(c, m, s) : null,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Fiche d'un membre non étudiant/école (mentor, entreprise, organisme).
class MemberDetailScreen extends StatelessWidget {
  const MemberDetailScreen({super.key, required this.id});
  final int id;
  @override
  Widget build(BuildContext context) {
    final s = context.watch<Session>();
    return Scaffold(
      appBar: bar(context, context.tr('Profil membre', 'Member profile')),
      body: Loader<Map>(
        load: () async => (await s.api.get('/members/$id'))['data'] as Map,
        builder: (c, m, reload) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              '${m['name']}',
              style: Theme.of(c).textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.bold),
            ),
            Text(
              '${c.lb.role(m['role'])}${m['country'] != null ? ' · ${m['country']}' : ''}',
            ),
            if (m['headline'] != null) Text('${m['headline']}'),
            if (m['institution'] != null) Text('${m['institution']}'),
            if (m['bio'] != null)
              Section(
                c.tr('Présentation', 'About'),
                children: [Text('${m['bio']}')],
              ),
            if (m['website'] != null)
              Section(
                c.tr('Site web', 'Website'),
                children: [Text('${m['website']}')],
              ),
            const SizedBox(height: 12),
            if (s.isLoggedIn && s.userId != id)
              FilledButton.icon(
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
            ReportButton(type: 'member', id: id),
          ],
        ),
      ),
    );
  }
}

class ConnectionsScreen extends StatefulWidget {
  const ConnectionsScreen({super.key});
  @override
  State<ConnectionsScreen> createState() => _ConnectionsScreenState();
}

class _ConnectionsScreenState extends State<ConnectionsScreen> {
  int _k = 0;
  Future<void> _do(Future<dynamic> f) async {
    try {
      await f;
      setState(() => _k++);
    } catch (e) {
      if (mounted) snack(context, errText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    return Scaffold(
      appBar: bar(context, context.tr('Mes connexions', 'My connections')),
      body: Loader<Map>(
        key: ValueKey(_k),
        load: () async => (await api.get('/connections')) as Map,
        builder: (c, d, reload) {
          final incoming = d['incoming'] as List,
              outgoing = d['outgoing'] as List,
              accepted = d['accepted'] as List;
          return ListView(
            padding: const EdgeInsets.all(12),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              if (incoming.isNotEmpty)
                Section(
                  c.tr('Demandes reçues', 'Received requests'),
                  children: [
                    for (final i in incoming)
                      memberTile(
                        c,
                        (i as Map)['user'] as Map,
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(
                                Icons.check,
                                color: Colors.green,
                              ),
                              onPressed: () => _do(
                                api.patch('/connections/${i['id']}/accept'),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close, color: Colors.red),
                              onPressed: () => _do(
                                api.patch('/connections/${i['id']}/decline'),
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              if (outgoing.isNotEmpty)
                Section(
                  c.tr('Demandes envoyées', 'Sent requests'),
                  children: [
                    for (final i in outgoing)
                      memberTile(
                        c,
                        (i as Map)['user'] as Map,
                        trailing: IconButton(
                          icon: const Icon(Icons.undo),
                          onPressed: () =>
                              _do(api.delete('/connections/${i['id']}')),
                        ),
                      ),
                  ],
                ),
              Section(
                c.tr('Mon réseau', 'My network'),
                children: [
                  if (accepted.isEmpty)
                    Text(
                      c.tr(
                        'Aucune connexion pour le moment.',
                        'No connections yet.',
                      ),
                    ),
                  for (final i in accepted)
                    memberTile(
                      c,
                      (i as Map)['user'] as Map,
                      trailing: IconButton(
                        icon: const Icon(Icons.person_remove_outlined),
                        onPressed: () async {
                          if (await confirm(
                            c,
                            c.tr(
                              'Supprimer cette connexion ?',
                              'Remove this connection?',
                            ),
                          ))
                            _do(api.delete('/connections/${i['id']}'));
                        },
                      ),
                    ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

class FeedScreen extends StatelessWidget {
  const FeedScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    return Scaffold(
      appBar: bar(context, context.tr('Actualités', 'News feed')),
      body: Loader<List>(
        load: () async => (await api.get('/feed'))['data'] as List,
        builder: (c, items, reload) => ItemList(
          items: items,
          itemBuilder: (c, i) {
            final it = i as Map;
            final d = it['data'] as Map;
            switch (it['type']) {
              case 'work':
                return workCard(c, d);
              case 'opportunity':
                return opportunityCard(c, d);
              case 'highlight':
                final st = d['student'] as Map?,
                    inst = d['institution'] as Map?;
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.star, color: Colors.amber),
                    title: Text('${d['title']}'),
                    subtitle: Text(
                      '${inst?['name'] ?? ''} → ${st?['name'] ?? ''}\n${d['message']}',
                    ),
                    isThreeLine: true,
                    onTap: st == null
                        ? null
                        : () => c.push('/etudiants/${st['id']}'),
                  ),
                );
              case 'institution_post':
                final inst = d['institution'] as Map?;
                return Card(
                  child: ListTile(
                    leading: const Icon(Icons.campaign, color: brand),
                    title: Text('${d['title']}'),
                    subtitle: Text(
                      '${inst?['name'] ?? ''} · ${fmtDate(d['created_at'])}\n${d['body']}',
                      maxLines: 4,
                      overflow: TextOverflow.ellipsis,
                    ),
                    isThreeLine: true,
                    onTap: inst == null
                        ? null
                        : () => c.push('/etablissements/${inst['id']}'),
                  ),
                );
              default:
                return const SizedBox.shrink();
            }
          },
        ),
      ),
    );
  }
}

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  int _k = 0;

  String _text(BuildContext c, Map n) {
    final e = '${(n['data'] as Map?)?['event'] ?? ''}';
    final fr = {
      'connection_request_received': 'Nouvelle demande de connexion.',
      'connection_request_accepted':
          'Votre demande de connexion a été acceptée.',
      'connection_request_declined':
          'Votre demande de connexion a été refusée.',
      'student_highlighted': 'Votre établissement vous a mis en avant.',
      'opportunity_application_status_changed':
          'Le statut de votre candidature a changé.',
      'opportunity_application_received': 'Nouvelle candidature reçue.',
      'opportunity_application_withdrawn':
          'Un candidat a retiré sa candidature.',
      'opportunity_published': 'Nouvelle opportunité publiée.',
    };
    final en = {
      'connection_request_received': 'New connection request.',
      'connection_request_accepted': 'Your connection request was accepted.',
      'connection_request_declined': 'Your connection request was declined.',
      'student_highlighted': 'Your institution highlighted you.',
      'opportunity_application_status_changed':
          'Your application status changed.',
      'opportunity_application_received': 'New application received.',
      'opportunity_application_withdrawn': 'An applicant withdrew.',
      'opportunity_published': 'New opportunity published.',
    };
    return c.tr(fr[e] ?? e, en[e] ?? e);
  }

  @override
  Widget build(BuildContext context) {
    final api = context.read<Session>().api;
    return Scaffold(
      appBar: bar(
        context,
        'Notifications',
        actions: [
          TextButton(
            onPressed: () async {
              try {
                await api.patch('/notifications/read-all');
                setState(() => _k++);
              } catch (_) {}
            },
            child: Text(context.tr('Tout lire', 'Mark all read')),
          ),
        ],
      ),
      body: Loader<Map>(
        key: ValueKey(_k),
        load: () async => (await api.get('/notifications')) as Map,
        builder: (c, d, reload) => ItemList(
          items: d['data'] as List,
          empty: c.tr('Aucune notification.', 'No notifications.'),
          itemBuilder: (c, n) {
            final m = n as Map;
            final unread = m['read_at'] == null;
            return Card(
              child: ListTile(
                leading: Icon(
                  unread
                      ? Icons.notifications_active
                      : Icons.notifications_none,
                  color: unread ? brand : Colors.grey,
                ),
                title: Text(
                  _text(c, m),
                  style: TextStyle(
                    fontWeight: unread ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
                subtitle: Text(fmtDate(m['created_at'])),
                onTap: unread
                    ? () async {
                        try {
                          await api.patch('/notifications/${m['id']}/read');
                          setState(() => _k++);
                        } catch (_) {}
                      }
                    : null,
              ),
            );
          },
        ),
      ),
    );
  }
}
