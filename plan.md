Objectif

Créer, dans sav.shape-conseil.fr, une section de gestion de projet type Trello, visible uniquement par Admin et Développeur, permettant de suivre des tâches Back/Front, leur avancement et leurs liaisons avec les tickets existants.

⸻

Portée (MVP)
	•	Vue Kanban avec colonnes: To‑do back | To‑do front | In progress | Ready for review | Done.
	•	Cartes (tâches) avec: titre, description, urgence (Basse/Moyenne/Haute/Urgente), pièces jointes, date de début, statut, décompte temps restant, fil de discussion avec mentions @utilisateur.
	•	Drag & drop entre colonnes.
	•	Rôles: Admin (tous projets), Développeur (accès restreint aux projets assignés).
	•	Lien tâches ↔ tickets (N:N). MAJ statut propagée aux tickets liés.
	•	Menu latéral: “[nom_du_projet] - Dev”; vue Admin de tous les projets + archivage de projet.

Hors scope MVP (nice-to-have): notifications email/push, temps passé (time tracking), étiquettes personnalisées, sous-tâches, filtres avancés.

⸻

Critères d’acceptation (résumés)
	1.	Kanban: colonnes dans l’ordre défini, drag&drop fluide, persistance immédiate, tri par due_at croissant.
	2.	Tâche: création/édition par Admin/Dev; champs obligatoires validés; upload ≥1 PJ; compte à rebours affiché; historique visible.
	3.	Urgence: calcule due_at = start_at + SLA(urgence) avec SLA: Basse=96h, Moyenne=72h, Haute=48h, Urgente=24h.
	4.	Commentaires & @mentions: ajout, édition/suppression par auteur; sur @mention, l’utilisateur ciblé est notifié (UI badge) et listé en participants.
	5.	Permissions: un Dev ne voit que les projets auxquels il est affecté; Admin voit tout + peut archiver/désarchiver.
	6.	Tickets liés: une MAJ de statut d’une tâche synchronise le statut des tickets liés selon la table de mapping.
	7.	Archivage projet: un projet archivé devient en lecture seule; visible dans “Projets archivés” pour Admin.

⸻

Architecture & Modèle de données

Tables (proposition)
	•	projects(id, name, code, status[active|archived], created_at, archived_at)
	•	users(id, name, email, role[admin|developer|other], …)
	•	developer_projects(user_id, project_id) — ACL d’accès développeur.
	•	tasks(id, project_id, title, description, urgency[low|medium|high|urgent], status[todo_back|todo_front|in_progress|ready_for_review|done], start_at, due_at, order_index, created_by, updated_by, created_at, updated_at)
	•	task_attachments(id, task_id, filename, path, size, mime, uploaded_by, created_at)
	•	task_comments(id, task_id, author_id, body, created_at, updated_at, edited)
	•	comment_mentions(id, comment_id, mentioned_user_id)
	•	tickets(id, code, title, status, …) — existant
	•	task_tickets(task_id, ticket_id)
	•	activity_logs(id, entity_type, entity_id, action, payload_json, actor_id, created_at)

Enum & règles
	•	Status flow: todo_back ↔ in_progress ↔ ready_for_review ↔ done; todo_front idem. Passage direct todo_* → done autorisé pour hotfix.
	•	Urgency → SLA: low=96h, medium=72h, high=48h, urgent=24h.
	•	Tri colonnes: ORDER BY due_at ASC, urgency DESC, created_at ASC.
	•	order_index: optionnel pour drag&drop fin (pour conserver un ordre manual après égalité sur due_at).

⸻

Permissions (RBAC)
	•	Admin: CRUD projets, assignation Dev ↔ Projet, CRUD tâches/attachments/commentaires, archiver/restaurer projet, lier/délier tickets.
	•	Développeur: lecture projets assignés; CRUD tâches/attachments/commentaires dans ces projets; pas d’archivage; pas d’assignation d’accès.
	•	Autres rôles: pas d’accès à la section Dev.

⸻

API (exemple REST/JSON)

/api/dev/projects
	•	GET list (Admin: tous; Dev: assignés) — filtres status=active|archived
	•	POST create {name, code}
/api/dev/projects/{id}
	•	GET show
	•	PATCH update {name,status}
	•	POST /archive
	•	POST /restore
/api/dev/projects/{id}/developers
	•	GET list
	•	POST add {user_id}
	•	DELETE remove {user_id}
/api/dev/projects/{id}/tasks
	•	GET list ?status=…
	•	POST create {title, description, urgency, status, start_at, ticket_ids[]}
/api/dev/tasks/{id}
	•	GET show
	•	PATCH update {title, description, urgency, status, start_at}
/api/dev/tasks/{id}/attachments
	•	POST upload (multipart)
	•	DELETE {attachment_id}
/api/dev/tasks/{id}/comments
	•	GET list
	•	POST create {body, mentions[user_id,…]}
	•	PATCH {comment_id} {body}
	•	DELETE {comment_id}
/api/dev/tasks/{id}/tickets
	•	POST link {ticket_id}
	•	DELETE unlink {ticket_id}
/api/dev/mentions/unread
	•	GET (badge de notif)

Réponses: {data, meta{pagination}}. Journaliser toute action sensible dans activity_logs.

⸻

UI/UX

Navigation
	•	Menu latéral: section ”[nom_du_projet] - Dev” pour chaque projet accessible. Admin a aussi Tous les projets + Projets archivés.

Kanban
	•	Colonnes fixes (5) dans l’ordre spécifié.
	•	Cartes: titre, badge urgence, chip due_at (compte à rebours), indicateur pièces jointes, avatar(s) mentionnés.
	•	Modale Créer une tâche et Éditer (mêmes champs). Par défaut start_at = now().
	•	DnD: sur drop → PATCH statut + recalcul tri; animation et toast de succès/erreur.
	•	Filtre rapide: par urgence, texte, statut; recherche plein‑texte titre/description.

Fiche tâche (drawer/panneau droit)
	•	Champs éditables, liste des tickets reliés, uploader pièces jointes (drag&drop fichiers), timeline d’activité, fil de discussion avec @mentions (autosuggest par users autorisés)

Admin
	•	Écran Gestion des développeurs: associer/desassocier des utilisateurs aux projets.
	•	Écran Archivage: bouton Archiver le projet; état lecture seule et bandeau “Archivé”.

⸻

Règles métier & synchronisation tickets
	•	Mapping statut tâche → statut ticket (à ajuster selon vos statuts ticket) :
	•	todo_* → open
	•	in_progress → in_progress
	•	ready_for_review → in_review
	•	done → resolved
	•	Sur MAJ tasks.status:
	1.	PATCH tickets liés avec le statut mappé,
	2.	log activité,
	3.	rafraîchir UI (optimistic update + rollback si 4xx/5xx).

⸻

Sécurité & conformité
	•	Auth existante réutilisée; vérifier que les rôles admin / developer existent.
	•	Contrôles d’accès systématiques côté API et UI.
	•	Limites upload (taille/format), antivirus si disponible, URLs signées pour téléchargements.
	•	Rate‑limit sur endpoints commentaires/uploads.

⸻

Performance & DX
	•	Pagination/virtualisation des cartes si >200 tâches/colonne.
	•	Websockets ou SSE pour mises à jour temps réel (facultatif MVP; fallback polling 30s).
	•	Tests unitaires services (SLA/due_at, permissions, mapping tickets) + tests E2E DnD.

⸻

Plan de livraison (phases ordonnées)

Phase 0 — Préparation (0.5 j)
	•	Valider mapping statuts tickets, maquettes rapides (Kanban + fiche tâche), stratégie d’archivage.

Phase 1 — Schéma & migrations (0.5–1 j)
	•	Créer tables/enums listées; seed rôles; index: tasks(project_id,status,due_at), developer_projects(user_id,project_id UNIQUE).

Phase 2 — Services & API (1.5–2 j)
	•	Endpoints projets, tâches, pièces jointes, commentaires, liaisons tickets, mentions.
	•	Hooks métier: calcul due_at sur create/update; propagation de statut vers tickets.

Phase 3 — UI Kanban (1.5–2 j)
	•	Colonnes, cartes, tri, DnD, création/édition modale.

Phase 4 — Fiche tâche & commentaires (1–1.5 j)
	•	Drawer, upload PJ, fil, @mentions avec autosuggest.

Phase 5 — Permissions & navigation (0.5 j)
	•	Menu latéral, restrictions vues, écran Admin « Développeurs ».

Phase 6 — Archivage projet (0.5 j)
	•	État lecture seule, listes “Actifs/Archivés”.

Phase 7 — QA & durcissement (0.5–1 j)
	•	Tests E2E DnD, access control, charges (1000 tâches), UX passes.

Phase 8 — Déploiement & doc (0.5 j)
	•	Migration prod, feature flag, rollback plan, guide utilisateur rapide.

Estimation MVP: ~6–9 jours dev (1 dev full‑stack). Ajuster selon contraintes internes.

⸻

Scénarios de test (exemples)
	•	Création tâche Urgente: due_at = now()+24h; visible en tête de colonne; compte à rebours décrémente.
	•	Drag & drop todo_back → in_progress: ticket lié passe à in_progress.
	•	Dev non assigné tente d’ouvrir un projet: 403.
	•	Archivage d’un projet: toutes les actions d’écriture renvoient 403; badges “Archivé” dans UI; encore visible côté Admin.
	•	Commentaire avec @alice: badge de notification non lu pour Alice; elle clique → ancre sur le commentaire.

⸻

Détails d’implémentation
	•	Tri & compte à rebours: composant qui recalcule côté client toutes les 60s; côté serveur, tri par due_at.
	•	DnD: librairie (ex. SortableJS / DnD Kit). Persist on drop avec optimistic UI.
	•	Uploads: multi‑fichiers, taille max configurable; stockage S3/équivalent; liens temporaires.
	•	Logs: toute transition de statut et action sensible.

⸻

Éléments à valider avant démarrage
	•	Statuts exacts des tickets existants pour le mapping.
	•	Limites et politique de conservation des pièces jointes.
	•	Besoin (ou non) de notifications email.
	•	Contrainte RGPD (durée conservation logs/attachments).

⸻

Roadmap post‑MVP (optionnel)
	•	Filtres sauvegardés, vues par personne, étiquettes.
	•	Time tracking et burndown par projet.
	•	Websocket temps réel complet.
	•	Export CSV/Excel des tâches.