import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';

import 'session.dart';

/// Traduction FR/EN : `context.tr('Bonjour', 'Hello')`. S'abonne à la session, donc l'écran se reconstruit au changement de langue.
extension Tr on BuildContext {
  String tr(String fr, String en) => watch<Session>().isFr ? fr : en;
  Session get session => read<Session>();
}

const _roles = {
  'student': ('Étudiant / diplômé', 'Student / graduate'),
  'school': ('École / université', 'School / university'),
  'company': ('Entreprise', 'Company'),
  'mentor': ('Mentor', 'Mentor'),
  'organization': ('Organisme de bourses', 'Funding organization'),
  'admin': ('Administrateur', 'Administrator'),
};
const _levels = {
  'licence': ('Licence', 'Bachelor'),
  'master': ('Master', 'Master'),
  'doctorat': ('Doctorat', 'PhD'),
};
const _oppTypes = {
  'employment': ('Emploi', 'Job'),
  'internship': ('Stage', 'Internship'),
  'scholarship': ('Bourse', 'Scholarship'),
  'ta': ('Poste TA', 'TA position'),
  'ra': ('Poste RA', 'RA position'),
  'mobility_program': ('Mobilité', 'Mobility'),
  'research_program': ('Recherche', 'Research'),
  'other': ('Autre', 'Other'),
};
const _status = {
  'submitted': ('Envoyée', 'Submitted'),
  'under_review': ('En examen', 'Under review'),
  'shortlisted': ('Présélectionnée', 'Shortlisted'),
  'accepted': ('Acceptée', 'Accepted'),
  'rejected': ('Refusée', 'Rejected'),
  'withdrawn': ('Retirée', 'Withdrawn'),
  'open': ('Ouverte', 'Open'),
  'closed': ('Fermée', 'Closed'),
  'draft': ('Brouillon', 'Draft'),
  'active': ('Actif', 'Active'),
  'suspended': ('Suspendu', 'Suspended'),
  'reviewed': ('Traité', 'Reviewed'),
  'dismissed': ('Rejeté', 'Dismissed'),
};
const _docs = {
  'cv': ('Curriculum vitae', 'Curriculum vitae'),
  'transcripts': ('Relevés de notes', 'Transcripts'),
  'motivation_letter': ('Lettre de motivation', 'Motivation letter'),
  'recommendation_letter': (
    'Lettre de recommandation',
    'Recommendation letter',
  ),
  'research_proposal': ('Projet de recherche', 'Research proposal'),
  'language_certificate': ('Certificat de langue', 'Language certificate'),
  'passport': ('Passeport', 'Passport'),
  'other': ('Autre document', 'Other document'),
};
const _workTypes = {
  'project': ('Projet', 'Project'),
  'thesis': ('Mémoire', 'Thesis'),
  'dissertation': ('Thèse', 'Dissertation'),
  'publication': ('Publication', 'Publication'),
  'portfolio': ('Portfolio', 'Portfolio'),
};
const _mentions = {
  'passable': ('Passable', 'Pass'),
  'assez_bien': ('Assez bien', 'Good'),
  'bien': ('Bien', 'Very good'),
  'tres_bien': ('Très bien', 'Excellent'),
};

const opportunityTypes = [
  'employment',
  'internship',
  'scholarship',
  'ta',
  'ra',
  'mobility_program',
  'research_program',
  'other',
];
const documentTypes = [
  'cv',
  'transcripts',
  'motivation_letter',
  'recommendation_letter',
  'research_proposal',
  'language_certificate',
  'passport',
  'other',
];
const levels = ['licence', 'master', 'doctorat'];
const workTypes = [
  'project',
  'thesis',
  'dissertation',
  'publication',
  'portfolio',
];
const mentions = ['passable', 'assez_bien', 'bien', 'tres_bien'];

String _pick(Map<String, (String, String)> m, String? k, bool fr) {
  if (k == null) return '';
  final v = m[k];
  return v == null ? k : (fr ? v.$1 : v.$2);
}

class Labels {
  Labels(this.fr);
  final bool fr;
  String role(String? k) => _pick(_roles, k, fr);
  String level(String? k) => _pick(_levels, k, fr);
  String oppType(String? k) => _pick(_oppTypes, k, fr);
  String status(String? k) => _pick(_status, k, fr);
  String doc(String? k) => _pick(_docs, k, fr);
  String workType(String? k) => _pick(_workTypes, k, fr);
  String mention(String? k) => _pick(_mentions, k, fr);
}

extension LabelsExt on BuildContext {
  Labels get lb => Labels(watch<Session>().isFr);
}
