import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/i18n.dart';
import '../widgets/common.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.redirect, this.expired = false});
  final String? redirect;
  final bool expired;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _pwd = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _show = false;
  String? _error;

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _error = null);
    try {
      await context.session.login(_email.text.trim(), _pwd.text);
      if (!mounted) return;
      context.go(
        widget.redirect != null && widget.redirect!.startsWith('/')
            ? widget.redirect!
            : '/',
      );
    } catch (e) {
      setState(() => _error = errText(e));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(context.tr('Connexion', 'Sign in')),
      leading: BackButton(
        onPressed: () => context.canPop() ? context.pop() : context.go('/'),
      ),
    ),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Center(child: Logo(size: 88)),
        const SizedBox(height: 20),
        if (widget.expired)
          Card(
            color: Colors.amber.shade100,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Text(
                context.tr(
                  'Votre session a expiré, reconnectez-vous.',
                  'Your session expired, please sign in again.',
                ),
              ),
            ),
          ),
        Form(
          key: _form,
          child: Column(
            children: [
              field(
                _email,
                context.tr('Adresse e-mail', 'Email'),
                type: TextInputType.emailAddress,
                required: true,
              ),
              TextFormField(
                controller: _pwd,
                obscureText: !_show,
                decoration: InputDecoration(
                  labelText: context.tr('Mot de passe', 'Password'),
                  border: const OutlineInputBorder(),
                  suffixIcon: IconButton(
                    icon: Icon(_show ? Icons.visibility_off : Icons.visibility),
                    onPressed: () => setState(() => _show = !_show),
                  ),
                ),
                validator: (v) => (v == null || v.isEmpty) ? '•' : null,
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Text(
                    _error!,
                    style: TextStyle(color: Colors.red.shade700),
                  ),
                ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: BusyButton(
                  label: context.tr('Se connecter', 'Sign in'),
                  onPressed: _submit,
                ),
              ),
              TextButton(
                onPressed: () => context.go('/inscription'),
                child: Text(context.tr('Créer un compte', 'Create an account')),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  String? role;
  final _form = GlobalKey<FormState>();
  final name = TextEditingController(),
      email = TextEditingController(),
      pwd = TextEditingController(),
      pwd2 = TextEditingController();
  final country = TextEditingController(),
      institution = TextEditingController(),
      field0 = TextEditingController();
  String level = 'licence';
  bool accepted = false;
  String? error;

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    if (!accepted) {
      setState(
        () => error = context.tr(
          'Acceptez les conditions générales.',
          'Please accept the terms.',
        ),
      );
      return;
    }
    setState(() => error = null);
    final body = <String, dynamic>{
      'name': name.text.trim(),
      'email': email.text.trim(),
      'password': pwd.text,
      'password_confirmation': pwd2.text,
      'role': role,
      'country': country.text.trim(),
      if (role != 'mentor') 'institution': institution.text.trim(),
      if (role == 'student') ...{
        'field_of_study': field0.text.trim(),
        'level': level,
      },
    };
    try {
      await context.session.register(body);
      if (mounted) context.go('/');
    } catch (e) {
      setState(() => error = errText(e));
    }
  }

  @override
  Widget build(BuildContext context) {
    final lb = context.lb;
    final roles = ['student', 'school', 'company', 'mentor', 'organization'];
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('Créer un compte', 'Create an account')),
        leading: BackButton(
          onPressed: () => role != null
              ? setState(() => role = null)
              : (context.canPop() ? context.pop() : context.go('/')),
        ),
      ),
      body: role == null
          ? ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  context.tr(
                    'Étape 1 sur 2 · Choisissez votre profil',
                    'Step 1 of 2 · Choose your profile',
                  ),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
                ...roles.map(
                  (r) => Card(
                    child: ListTile(
                      title: Text(lb.role(r)),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => setState(() => role = r),
                    ),
                  ),
                ),
              ],
            )
          : Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Text(
                    context.tr(
                      'Étape 2 sur 2 · ${lb.role(role)}',
                      'Step 2 of 2 · ${lb.role(role)}',
                    ),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  field(
                    name,
                    role == 'student' || role == 'mentor'
                        ? context.tr('Nom complet', 'Full name')
                        : context.tr(
                            'Nom de l’organisation',
                            'Organization name',
                          ),
                    required: true,
                  ),
                  field(
                    email,
                    context.tr('Adresse e-mail', 'Email'),
                    type: TextInputType.emailAddress,
                    required: true,
                  ),
                  field(country, context.tr('Pays', 'Country'), required: true),
                  if (role != 'mentor')
                    field(
                      institution,
                      role == 'student'
                          ? context.tr('Établissement', 'Institution')
                          : context.tr(
                              'Nom de l’établissement / organisme',
                              'Institution / organization name',
                            ),
                      required: true,
                    ),
                  if (role == 'student') ...[
                    field(
                      field0,
                      context.tr('Filière', 'Field of study'),
                      required: true,
                    ),
                    dropdown(context.tr('Niveau', 'Level'), level, {
                      for (final l in levels) l: lb.level(l),
                    }, (v) => setState(() => level = v ?? 'licence')),
                  ],
                  field(
                    pwd,
                    context.tr(
                      'Mot de passe (8 caractères min.)',
                      'Password (8 chars min.)',
                    ),
                    obscure: true,
                    required: true,
                  ),
                  field(
                    pwd2,
                    context.tr('Confirmer le mot de passe', 'Confirm password'),
                    obscure: true,
                    required: true,
                  ),
                  CheckboxListTile(
                    value: accepted,
                    onChanged: (v) => setState(() => accepted = v ?? false),
                    controlAffinity: ListTileControlAffinity.leading,
                    title: Text(
                      context.tr(
                        'J’accepte les conditions générales',
                        'I accept the terms',
                      ),
                      style: const TextStyle(fontSize: 14),
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
                  BusyButton(
                    label: context.tr('Créer mon compte', 'Create my account'),
                    onPressed: _submit,
                  ),
                ],
              ),
            ),
    );
  }
}
