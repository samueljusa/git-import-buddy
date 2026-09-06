# Feuille de route

## En cours
- [x] Connexion réparée : Google activé + confirmation e-mail désactivée
- [x] Audit sécurité pré-production (secrets, RLS, validation, uploads, webhooks)
- [x] Offre de lancement : 2 jours, activable une seule fois, prix promo affiché
- [x] Badge de formule et date d'expiration dans le profil


## Fait
- [x] Table `community_gallery` + modération centralisée dans le bureau d'administration
- [x] Quotas : 5 images/jour, 9 vidéos/jour, pause 3 h après la 5e vidéo
- [x] Vidéos limitées à 6 s et 480p/720p
- [x] Moteur Fal.ai (Grok Imagine) images + vidéos, repli Flux Schnell
- [x] Bucket de stockage `generations` + règles d'accès
- [x] Suppression de l'affichage du quota dans le studio
- [x] Suppression de l'essai gratuit 7 jours dans les offres
- [x] Offre de lancement activable depuis l'administration (Super grok offert 30 jours)
- [x] Toasts sonorisés + Toaster monté globalement

## Notes
- Les clés API (dont FAL_KEY) sont fournies via les variables d'environnement de l'hébergeur.
