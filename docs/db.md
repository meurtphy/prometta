🗂️ Spécification Technique : Module Audit + Base de Données
🎯 Objectif
Créer une structure robuste pour :

Enregistrer chaque audit de site de façon horodatée et versionnée

Relier toutes les sous-sections (réponses GPT, performances, captures)

Comparer plusieurs audits d’un même site dans le temps

Permettre une consultation sécurisée par le client

🛠️ Technologie
Base relationnelle : PostgreSQL

ORM recommandé : Prisma (Node.js) ou SQLAlchemy (Python)

Stockage fichiers : S3 / MinIO ou dossier local (/static)

Authentification : JWT + Rôle consultant / client

🧱 Schéma relationnel
1. clients
Champ	Type	Détail
id	UUID	Identifiant unique
name	TEXT	Nom
email	TEXT	Email
created_at	TIMESTAMP	Création compte

2. audits
Champ	Type	Détail
id	UUID	Identifiant audit
client_id	UUID	Référence clients
url	TEXT	URL du site analysé
platform	TEXT	ex: WordPress, Shopify, Webflow
competitors	TEXT[]	URLs des concurrents
status	TEXT	pending / done / failed
version	TEXT	ex: V1.0, V1.1
created_at	TIMESTAMP	Date d’analyse

3. audit_snapshots
Champ	Type	Détail
id	UUID	ID unique
audit_id	UUID	Référence audits
json_data	JSONB	Output du crawler
screenshot	TEXT	Chemin du fichier PNG
created_at	TIMESTAMP	Timestamp

4. audit_sections
Champ	Type	Détail
id	UUID	ID
audit_id	UUID	Référence audits
type	TEXT	ex: UX_NAV, SEO_TECH, ACCESS
prompt_used	TEXT	Prompt final GPT
gpt_response	TEXT	Réponse brute
score	INT	Score (0-100)
priority	TEXT	low / medium / high
created_at	TIMESTAMP

5. audit_summary
Champ	Type	Détail
audit_id	UUID	Référence audits
global_score	INT	Moyenne pondérée des scores
top_issues	TEXT[]	Liste des points critiques
improvement_projection	TEXT	Projection post-optimisation

🔐 Sécurité & accès
Espace Consultant UX :
Voir tous les audits de tous les clients

Comparer entre clients

Espace Client :
Voir uniquement ses audits

Accès par token JWT

Audit filtré par client_id

🔄 Fonctionnalités clés
Comparaison de deux audits :

Diff de score par section

Résumé des évolutions

Export PDF / HTML dynamique

Marquage d’un audit comme “audit de référence”

Ajout de tags ou commentaires internes par consultant

🧠 Évolutions futures
Ajout d’un champ model_used pour chaque audit (GPT-4, GPT-4-turbo, etc.)

Ajout de feedback_utilisateur post-audit

RAG : stocker les audits précédents dans une base vectorielle pour comparaison intelligente

