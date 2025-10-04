#!/usr/bin/env node

/**
 * Test de validation des calculs SLA avec horaires de bureau
 * Horaires : 9h-18h, Lundi-Vendredi
 */

const businessHours = require('./src/utils/business-hours');

console.log('=== TEST DES CALCULS SLA AVEC HORAIRES DE BUREAU ===\n');

// Test 1: Ticket créé pendant les horaires de bureau
console.log('TEST 1: Ticket urgent (2h) créé Lundi 10h00');
const monday10am = new Date('2025-10-06T10:00:00'); // Lundi 10h
const deadline1 = businessHours.calculateSLADeadline(2, monday10am);
console.log(`  Créé à: ${monday10am.toLocaleString('fr-FR')}`);
console.log(`  Deadline: ${deadline1.toLocaleString('fr-FR')}`);
console.log(`  ✓ Devrait être Lundi 12h00: ${deadline1.getHours() === 12 ? 'OUI ✓' : 'NON ✗'}\n`);

// Test 2: Ticket créé en fin de journée
console.log('TEST 2: Ticket normal (8h) créé Vendredi 16h00');
const friday4pm = new Date('2025-10-10T16:00:00'); // Vendredi 16h
const deadline2 = businessHours.calculateSLADeadline(8, friday4pm);
console.log(`  Créé à: ${friday4pm.toLocaleString('fr-FR')}`);
console.log(`  Deadline: ${deadline2.toLocaleString('fr-FR')}`);
console.log(`  ✓ Devrait être Lundi suivant 15h00 (2h vendredi + 6h lundi)`);
console.log(`  Jour: ${deadline2.getDay() === 1 ? 'Lundi ✓' : 'Pas lundi ✗'}`);
console.log(`  Heure: ${deadline2.getHours() === 15 ? '15h ✓' : deadline2.getHours() + 'h ✗'}\n`);

// Test 3: Ticket créé le weekend
console.log('TEST 3: Ticket high (4h) créé Samedi 14h00');
const saturday2pm = new Date('2025-10-11T14:00:00'); // Samedi 14h
const deadline3 = businessHours.calculateSLADeadline(4, saturday2pm);
console.log(`  Créé à: ${saturday2pm.toLocaleString('fr-FR')}`);
console.log(`  Deadline: ${deadline3.toLocaleString('fr-FR')}`);
console.log(`  ✓ Devrait commencer Lundi 9h00 et finir à 13h00`);
console.log(`  Jour: ${deadline3.getDay() === 1 ? 'Lundi ✓' : 'Pas lundi ✗'}`);
console.log(`  Heure: ${deadline3.getHours() === 13 ? '13h ✓' : deadline3.getHours() + 'h ✗'}\n`);

// Test 4: Ticket créé hors horaires (soir)
console.log('TEST 4: Ticket urgent (2h) créé Lundi 20h00 (après 18h)');
const monday8pm = new Date('2025-10-06T20:00:00'); // Lundi 20h
const deadline4 = businessHours.calculateSLADeadline(2, monday8pm);
console.log(`  Créé à: ${monday8pm.toLocaleString('fr-FR')}`);
console.log(`  Deadline: ${deadline4.toLocaleString('fr-FR')}`);
console.log(`  ✓ Devrait commencer Mardi 9h00 et finir à 11h00`);
console.log(`  Jour: ${deadline4.getDay() === 2 ? 'Mardi ✓' : 'Pas mardi ✗'}`);
console.log(`  Heure: ${deadline4.getHours() === 11 ? '11h ✓' : deadline4.getHours() + 'h ✗'}\n`);

// Test 5: Vérification isSLAOverdue pendant et hors horaires
console.log('TEST 5: Vérification overdue selon horaires de bureau');
const pastDeadline = new Date('2025-10-06T10:00:00'); // Lundi 10h (passé)
const now = new Date('2025-10-06T11:00:00'); // Lundi 11h (présent)
const isOverdueDuringBusiness = businessHours.isSLAOverdue(pastDeadline, now);
console.log(`  Deadline passée: ${pastDeadline.toLocaleString('fr-FR')}`);
console.log(`  Maintenant (11h, pendant bureau): ${now.toLocaleString('fr-FR')}`);
console.log(`  Est en retard: ${isOverdueDuringBusiness ? 'OUI ✓' : 'NON ✗'}\n`);

const nowWeekend = new Date('2025-10-11T11:00:00'); // Samedi 11h
const isOverdueWeekend = businessHours.isSLAOverdue(pastDeadline, nowWeekend);
console.log(`  Deadline passée: ${pastDeadline.toLocaleString('fr-FR')}`);
console.log(`  Maintenant (samedi 11h, hors bureau): ${nowWeekend.toLocaleString('fr-FR')}`);
console.log(`  Est en retard: ${isOverdueWeekend ? 'OUI ✗' : 'NON ✓ (pause weekend)'}\n`);

// Test 6: Calcul d'heures entre deux dates
console.log('TEST 6: Calcul heures de bureau entre deux dates');
const start = new Date('2025-10-06T10:00:00'); // Lundi 10h
const end = new Date('2025-10-08T14:00:00'); // Mercredi 14h
const hoursBetween = businessHours.calculateBusinessHoursBetween(start, end);
console.log(`  De: ${start.toLocaleString('fr-FR')}`);
console.log(`  À: ${end.toLocaleString('fr-FR')}`);
console.log(`  Heures de bureau: ${hoursBetween}h`);
console.log(`  ✓ Devrait être: 8h (lundi) + 9h (mardi) + 5h (mercredi) = 22h`);
console.log(`  Résultat: ${hoursBetween === 22 ? 'CORRECT ✓' : 'INCORRECT ✗'}\n`);

// Test 7: SLA avec daniel@qlikads.com (urgent: 2h)
console.log('TEST 7: Scénario réel - Ticket urgent pour daniel@qlikads.com');
console.log('  SLA urgent configuré: 2h de réponse');
const realTicket = new Date('2025-10-06T17:30:00'); // Lundi 17h30
const realDeadline = businessHours.calculateSLADeadline(2, realTicket);
console.log(`  Ticket créé: ${realTicket.toLocaleString('fr-FR')}`);
console.log(`  Deadline calculée: ${realDeadline.toLocaleString('fr-FR')}`);
console.log(`  ✓ 30min restent lundi (17h30->18h), puis 1h30 mardi (9h->10h30)`);
console.log(`  Jour: ${realDeadline.getDay() === 2 ? 'Mardi ✓' : 'Pas mardi ✗'}`);
console.log(`  Heure: ${realDeadline.getHours() === 10 && realDeadline.getMinutes() === 30 ? '10h30 ✓' : realDeadline.getHours() + 'h' + realDeadline.getMinutes() + ' ✗'}\n`);

console.log('=== FIN DES TESTS ===');
