import 'package:flutter_test/flutter_test.dart';
import 'package:gradhive_mobile/core/i18n.dart';

void main() {
  test('libellés FR/EN et valeur inconnue renvoyée telle quelle', () {
    expect(Labels(true).oppType('scholarship'), 'Bourse');
    expect(Labels(false).oppType('scholarship'), 'Scholarship');
    expect(Labels(true).status('under_review'), 'En examen');
    expect(Labels(true).role('inconnu'), 'inconnu');
    expect(Labels(true).level(null), '');
  });
  test('types d’opportunités alignés sur l’API', () {
    expect(opportunityTypes, [
      'employment',
      'internship',
      'scholarship',
      'ta',
      'ra',
      'mobility_program',
      'research_program',
      'other',
    ]);
  });
}
