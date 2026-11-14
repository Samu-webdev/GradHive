import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'core/api.dart';
import 'core/session.dart';
import 'router.dart';
import 'widgets/common.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final api = ApiClient();
  final session = Session(api);
  await session.restore();
  runApp(
    ChangeNotifierProvider.value(
      value: session,
      child: GradHiveApp(session: session),
    ),
  );
}

class GradHiveApp extends StatefulWidget {
  const GradHiveApp({super.key, required this.session});
  final Session session;
  @override
  State<GradHiveApp> createState() => _GradHiveAppState();
}

class _GradHiveAppState extends State<GradHiveApp> {
  late final _router = buildRouter(widget.session);

  @override
  Widget build(BuildContext context) {
    final fr = context.watch<Session>().isFr;
    return MaterialApp.router(
      title: 'GradHive',
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      locale: Locale(fr ? 'fr' : 'en'),
      supportedLocales: const [Locale('fr'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: brand),
        appBarTheme: const AppBarTheme(centerTitle: false),
        cardTheme: const CardThemeData(margin: EdgeInsets.only(bottom: 10)),
      ),
    );
  }
}
