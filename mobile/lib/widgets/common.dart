import 'package:file_selector/file_selector.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:provider/provider.dart';

import 'dart:io';

import '../core/api.dart';
import '../core/i18n.dart';
import '../core/session.dart';

const brand = Color(0xFF39A9DF);
const brandDark = Color(0xFF1B6E99);

void snack(BuildContext c, String msg, {bool error = false}) {
  ScaffoldMessenger.of(c).showSnackBar(
    SnackBar(
      content: Text(msg),
      backgroundColor: error ? Colors.red.shade700 : null,
    ),
  );
}

String errText(Object e) => e is ApiException ? e.display : '$e';

String fmtDate(dynamic iso) {
  final d = DateTime.tryParse('${iso ?? ''}');
  return d == null ? '' : DateFormat('dd/MM/yyyy').format(d.toLocal());
}

/// Charge des données asynchrones avec état de chargement, erreur + réessai et tirer-pour-rafraîchir.
class Loader<T> extends StatefulWidget {
  const Loader({super.key, required this.load, required this.builder});
  final Future<T> Function() load;
  final Widget Function(
    BuildContext context,
    T data,
    Future<void> Function() reload,
  )
  builder;
  @override
  State<Loader<T>> createState() => _LoaderState<T>();
}

class _LoaderState<T> extends State<Loader<T>> {
  late Future<T> _f = widget.load();
  Future<void> _reload() async {
    setState(() => _f = widget.load());
    try {
      await _f;
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
    future: _f,
    builder: (c, s) {
      if (s.connectionState != ConnectionState.done)
        return const Center(child: CircularProgressIndicator());
      if (s.hasError) {
        return Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off, size: 48),
                const SizedBox(height: 12),
                Text(errText(s.error!), textAlign: TextAlign.center),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: _reload,
                  child: Text(c.tr('Réessayer', 'Retry')),
                ),
              ],
            ),
          ),
        );
      }
      return RefreshIndicator(
        onRefresh: _reload,
        child: widget.builder(c, s.data as T, _reload),
      );
    },
  );
}

/// Liste défilante (toujours « tirable » même vide).
class ItemList extends StatelessWidget {
  const ItemList({
    super.key,
    required this.items,
    required this.itemBuilder,
    this.empty,
    this.header,
  });
  final List items;
  final Widget Function(BuildContext, dynamic) itemBuilder;
  final String? empty;
  final Widget? header;
  @override
  Widget build(BuildContext context) => ListView(
    physics: const AlwaysScrollableScrollPhysics(),
    padding: const EdgeInsets.all(12),
    children: [
      if (header != null) header!,
      if (items.isEmpty)
        Padding(
          padding: const EdgeInsets.all(32),
          child: Center(
            child: Text(empty ?? context.tr('Aucun résultat.', 'No results.')),
          ),
        ),
      ...items.map((e) => itemBuilder(context, e)),
    ],
  );
}

class Chip2 extends StatelessWidget {
  const Chip2(this.text, {super.key, this.color});
  final String text;
  final Color? color;
  @override
  Widget build(BuildContext context) => Container(
    margin: const EdgeInsets.only(right: 6, top: 4),
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
    decoration: BoxDecoration(
      color: (color ?? brand).withValues(alpha: .15),
      borderRadius: BorderRadius.circular(10),
    ),
    child: Text(
      text,
      style: TextStyle(fontSize: 12, color: color ?? brandDark),
    ),
  );
}

class Section extends StatelessWidget {
  const Section(this.title, {super.key, required this.children});
  final String title;
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium
              ?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 6),
        ...children,
      ],
    ),
  );
}

/// Champ de texte standard.
Widget field(
  TextEditingController c,
  String label, {
  bool obscure = false,
  int lines = 1,
  TextInputType? type,
  bool required = false,
  String? hint,
}) => Padding(
  padding: const EdgeInsets.only(bottom: 12),
  child: TextFormField(
    controller: c,
    obscureText: obscure,
    minLines: lines,
    maxLines: obscure ? 1 : lines,
    keyboardType: type,
    decoration: InputDecoration(
      labelText: label,
      hintText: hint,
      border: const OutlineInputBorder(),
    ),
    validator: required
        ? (v) => (v == null || v.trim().isEmpty) ? '•' : null
        : null,
  ),
);

Widget dropdown(
  String label,
  String? value,
  Map<String, String> options,
  void Function(String?) onChanged, {
  bool allowEmpty = false,
  String emptyLabel = '—',
}) => Padding(
  padding: const EdgeInsets.only(bottom: 12),
  child: DropdownButtonFormField<String>(
    value: options.containsKey(value) ? value : null,
    isExpanded: true,
    decoration: InputDecoration(
      labelText: label,
      border: const OutlineInputBorder(),
    ),
    items: [
      if (allowEmpty) DropdownMenuItem(value: '', child: Text(emptyLabel)),
      ...options.entries.map(
        (e) => DropdownMenuItem(value: e.key, child: Text(e.value)),
      ),
    ],
    onChanged: (v) => onChanged(v),
  ),
);

/// Sélection d'un PDF (20 Mo max côté serveur pour un travail, 5 Mo par pièce de candidature).
Future<PickedFile?> pickPdf(BuildContext c, {int maxMb = 20}) async {
  final x = await openFile(acceptedTypeGroups: [
    const XTypeGroup(label: 'PDF', extensions: ['pdf'], mimeTypes: ['application/pdf'], uniformTypeIdentifiers: ['com.adobe.pdf']),
  ]);
  if (x == null) return null;
  final size = await x.length();
  if (size > maxMb * 1024 * 1024) {
    snack(c, c.tr('Fichier trop volumineux ($maxMb Mo maximum).', 'File too large ($maxMb MB max).'), error: true);
    return null;
  }
  return PickedFile(x.name, size, x);
}

/// Télécharge un PDF protégé puis l'ouvre dans le lecteur du téléphone.
Future<void> openPdf(BuildContext c, String path, String name) async {
  if (kIsWeb) {
    snack(c, c.tr('L’ouverture des PDF n’est pas disponible dans la version web de test.', 'Opening PDFs is not available in the web test version.'), error: true);
    return;
  }
  try {
    final api = c.read<Session>().api;
    final bytes = await api.download(path);
    final dir = await getTemporaryDirectory();
    final f = File('${dir.path}/$name');
    await f.writeAsBytes(bytes, flush: true);
    final res = await OpenFilex.open(f.path);
    if (res.type != ResultType.done && c.mounted)
      snack(
        c,
        c.tr(
          'Aucune application pour ouvrir ce PDF.',
          'No app can open this PDF.',
        ),
        error: true,
      );
  } catch (e) {
    if (c.mounted) snack(c, errText(e), error: true);
  }
}

/// Bouton « envoyer » avec indicateur d'attente.
class BusyButton extends StatefulWidget {
  const BusyButton({super.key, required this.label, required this.onPressed});
  final String label;
  final Future<void> Function() onPressed;
  @override
  State<BusyButton> createState() => _BusyButtonState();
}

class _BusyButtonState extends State<BusyButton> {
  bool busy = false;
  @override
  Widget build(BuildContext context) => FilledButton(
    onPressed: busy
        ? null
        : () async {
            setState(() => busy = true);
            try {
              await widget.onPressed();
            } finally {
              if (mounted) setState(() => busy = false);
            }
          },
    child: busy
        ? const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Text(widget.label),
  );
}

Future<bool> confirm(BuildContext c, String msg) async =>
    await showDialog<bool>(
      context: c,
      builder: (d) => AlertDialog(
        content: Text(msg),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d, false),
            child: Text(c.tr('Annuler', 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(d, true),
            child: Text(c.tr('Confirmer', 'Confirm')),
          ),
        ],
      ),
    ) ??
    false;

/// Signalement d'un contenu (membre, travail ou opportunité).
class ReportButton extends StatelessWidget {
  const ReportButton({super.key, required this.type, required this.id});
  final String type;
  final int id;
  @override
  Widget build(BuildContext context) {
    if (!context.watch<Session>().isLoggedIn) return const SizedBox.shrink();
    return TextButton.icon(
      icon: const Icon(Icons.flag_outlined, size: 18),
      label: Text(context.tr('Signaler', 'Report')),
      onPressed: () async {
        final reasons = {
          'inaccurate': context.tr('Information inexacte', 'Inaccurate'),
          'inappropriate': context.tr('Contenu inapproprié', 'Inappropriate'),
          'fraud': context.tr('Fraude', 'Fraud'),
          'spam': 'Spam',
          'other': context.tr('Autre', 'Other'),
        };
        final reason = await showDialog<String>(
          context: context,
          builder: (d) => SimpleDialog(
            title: Text(context.tr('Motif du signalement', 'Reason')),
            children: reasons.entries
                .map(
                  (e) => SimpleDialogOption(
                    onPressed: () => Navigator.pop(d, e.key),
                    child: Text(e.value),
                  ),
                )
                .toList(),
          ),
        );
        if (reason == null) return;
        try {
          await context.read<Session>().api.post('/reports', {
            'target_type': type,
            'target_id': id,
            'reason': reason,
          });
          if (context.mounted)
            snack(context, context.tr('Signalement envoyé.', 'Report sent.'));
        } catch (e) {
          if (context.mounted) snack(context, errText(e), error: true);
        }
      },
    );
  }
}

/// Logo GradHive (asset local).
class Logo extends StatelessWidget {
  const Logo({super.key, this.size = 72});
  final double size;
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(size * .22),
        child: Image.asset('assets/images/logo.png', width: size, height: size, fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(width: size, height: size, color: brand, alignment: Alignment.center, child: Text('GH', style: TextStyle(color: Colors.white, fontSize: size * .4, fontWeight: FontWeight.bold)))),
      );
}

/// Image distante (Internet) avec chargement et repli propre si le réseau ou l'adresse échoue.
class NetImage extends StatelessWidget {
  const NetImage(this.url, {super.key, this.height = 160});
  final String url;
  final double height;
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Image.network(url, height: height, width: double.infinity, fit: BoxFit.cover,
            loadingBuilder: (c, child, p) => p == null ? child : Container(height: height, color: brand.withOpacity(.12), alignment: Alignment.center, child: const CircularProgressIndicator(strokeWidth: 2)),
            errorBuilder: (_, __, ___) => Container(height: height, color: brand.withOpacity(.15), alignment: Alignment.center, child: const Icon(Icons.school, size: 48, color: brandDark))),
      );
}
