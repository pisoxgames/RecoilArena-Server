'use strict';
/* RECOIL ARENA 3D - i18n.js (ENTREGA 2)
   API: I18N.t(key, {param}) | I18N.setLang('es'|'en'|'fr') | I18N.lang | I18N.apply(root)
   HTML: data-i18n="key"  data-i18n-ph="key" (placeholder)  data-i18n-title="key" (tooltip)
   El servidor envía claves (ej. player_joined) + params; el cliente las traduce con I18N.t(). */
const translations = {
  es: {
    game_title: 'RECOIL ARENA', loading: 'Cargando...', connecting: 'Conectando...', reconnecting: 'Reconectando...', connected: 'Conectado',
    play: 'JUGAR', shop: 'TIENDA', friends: 'AMIGOS', settings: 'AJUSTES', coins: 'Monedas', language: 'Idioma', close: 'Cerrar', back: 'Volver', save: 'Guardar', cancel: 'Cancelar', copy: 'Copiar', copied: '¡Copiado!',
    username: 'Nombre de usuario', username_hint: '3-16 caracteres: letras, números y _', welcome_title: '¡Bienvenido!', enter: 'ENTRAR',
    play_title: 'Elige cómo jugar', quick: 'Partida Rápida', quick_desc: 'Entra automáticamente a una sala', create: 'Crear Sala', create_desc: 'Crea una sala y comparte el código',
    join_code: 'Unirse con Código', join_desc: 'Introduce el código de un amigo', browse: 'Buscar Partida', browse_desc: 'Lista de salas públicas', code_placeholder: 'CÓDIGO', join: 'UNIRSE', no_rooms: 'No hay salas públicas ahora mismo', refresh: 'Actualizar', in_lobby: 'En lobby', in_game: 'En partida',
    room_code: 'CÓDIGO DE SALA', players: 'Jugadores', host_badge: 'HOST', bot_badge: 'BOT', map: 'Mapa', room_public: 'Sala pública', room_private: 'Sala privada', visibility: 'Visibilidad', max_players: 'Máx. jugadores', bots: 'Bots', start_game: 'INICIAR PARTIDA', leave: 'SALIR', waiting_host: 'Esperando al host...',
    map_arena: 'Arena Clásica', map_sky: 'Cielo Infinito', map_maze: 'Laberinto de Cajas', map_volcano: 'Volcán Cartoon',
    hud_kills: 'KILLS', next_roulette: 'PRÓXIMA RULETA', roulette_go: '¡RULETA!', ping: 'Ping', ability_dash: 'Dash', ability_bomb: 'Bomba', ability_grapple: 'Gancho', nuke_ready: '¡NUCLEAR LISTA! (R)', top3: 'TOP 3',
    scoreboard: 'MARCADOR', sb_player: 'Jugador', sb_kills: 'Kills', sb_deaths: 'Muertes', sb_ping: 'Ping',
    eliminated: '¡ELIMINADO!', killed_by: 'Te eliminó {name}', killed_by_lava: 'Te derritió la lava', respawn_in: 'Reapareces en {s}', spectating: 'Modo espectador: WASD para mover la cámara', void_fall: '¡Caída al infinito!',
    victory: '¡VICTORIA!', winner_is: 'Ganador: {name}', stats: 'Estadísticas', st_kills: 'Kills', st_deaths: 'Muertes', st_kd: 'K/D', st_damage: 'Daño', st_distance: 'Distancia', st_powerups: 'Power-ups', st_coins: 'Monedas ganadas', play_again: 'Jugar de Nuevo', back_lobby: 'Volver al Lobby',
    double_kill: '¡DOBLE KILL!', triple_kill: '¡TRIPLE KILL!', mega_kill: '¡MEGA KILL!', fever_mode: '¡MODO FIEBRE!', killed: 'eliminó a', cause_lava: 'lava', cause_void: 'vacío',
    pu_shield: 'Escudo Burbuja', pu_invisible: 'Invisibilidad', pu_giant: 'Balas Gigantes', pu_speed: 'Velocidad Relámpago', pu_magnet: 'Imán de Monedas', pu_nuke: 'Bomba Nuclear', pu_fever: 'Modo Fiebre', pu_expired: 'Power-up terminado', pu_got: '¡Has obtenido {name}!', pu_expiring: '¡Se acaba!',
    shop_featured: 'DESTACADOS', shop_daily: 'DIARIOS', tab_all: 'TODO', tab_skins: 'SKINS', tab_dances: 'BAILES', tab_owned: 'OBTENIDOS', buy: 'COMPRAR', equip: 'EQUIPAR', equipped: 'EQUIPADO', owned: 'OBTENIDO', not_enough: 'No tienes suficientes monedas', purchased: '¡Compra realizada!', slot: 'Ranura {n}', empty_tab: 'Nada por aquí todavía',
    rarity_common: 'Común', rarity_rare: 'Raro', rarity_epic: 'Épico', rarity_legendary: 'Legendario',
    skin_default: 'Clásico', skin_robot: 'Robot', skin_ghost: 'Fantasma', skin_ninja: 'Ninja', skin_clown: 'Payaso', skin_alien: 'Alien', skin_gold: 'Dorado',
    emote_robot: 'El Robot', emote_wave: 'La Ola', emote_spin: 'Giro Loco', emote_moonwalk: 'El Moonwalk', emote_floss: 'Floss', emote_breakdance: 'Breakdance', emote_kpop: 'K-Pop', emote_victory: 'Victoria Royale',
    set_sfx: 'Volumen de efectos', set_music: 'Volumen de música', set_sens: 'Sensibilidad del ratón', set_blur: 'Motion blur', set_shake: 'Screen shake', set_quality: 'Calidad gráfica', q_low: 'Baja', q_mid: 'Media', q_high: 'Alta', set_hud: 'Tamaño del HUD', set_cb: 'Modo daltonismo', cb_none: 'Ninguno', cb_prot: 'Protanopia', cb_deut: 'Deuteranopia', cb_trit: 'Tritanopia', set_reduce: 'Reducción de movimiento', set_name: 'Cambiar nombre', on: 'Sí', off: 'No',
    tut_title: 'Tutorial', ctrl_title: "Controles táctiles", ctrl_edit: "🎮 Personalizar", aim_assist: "Ayuda de puntería (aim assist)", ctrl_hint: "Arrastra los botones donde quieras · toca uno para cambiar su tamaño", ctrl_size: "Tamaño", ctrl_opacity: "Opacidad", ctrl_reset: "Restablecer", ctrl_saved: "¡Controles guardados!", ctrl_fire: "Disparo", ctrl_jump: "Salto", ctrl_emote: "Bailes", ctrl_board: "Marcador", set_server: "Servidor online", set_server_hint: "Deja vacío para usar el servidor por defecto. Se recargará el juego.", rotate_phone: 'Gira el móvil en horizontal', tut_shoot_t: 'Mantén 🔥 para disparar. ¡El retroceso te mueve!', tut_dash_t: 'Toca ⚡ para hacer dash', tut_bomb_t: 'Toca 💥 para la bomba de retroceso', tut_grapple_t: 'Toca 🪝 para lanzar el gancho', tut_jump_t: 'Toca ⤒ en el aire para doble salto', tut_emote_t: 'Toca 😀 y elige un baile',  tut_shoot: 'Haz clic para disparar. ¡El retroceso te mueve!', tut_dash: 'Pulsa Shift para hacer dash', tut_bomb: 'Pulsa Q para la bomba de retroceso', tut_grapple: 'Pulsa E para lanzar el gancho', tut_jump: 'Pulsa Espacio en el aire para un doble salto', tut_emote: 'Pulsa 1-4 para bailar (cámara en tercera persona)', tut_skip: 'Saltar', tut_next: 'Siguiente', tut_done: '¡A jugar!',
    friends_title: 'Amigos', add_friend: 'Añadir', search_player: 'Buscar jugador...', st_online: 'En línea', st_offline: 'Desconectado', st_ingame: 'En partida', invite: 'Invitar', join_friend: 'Unirse', remove: 'Eliminar', accept: 'Aceptar', decline: 'Rechazar', requests: 'Solicitudes', no_friends: 'Aún no tienes amigos', request_sent: 'Solicitud enviada', request_from: '{name} quiere ser tu amigo', friend_online: '🟢 {name} se ha conectado', friend_offline: '🔴 {name} se ha desconectado', invite_received: '{name} te invita a jugar', invite_sent: 'Invitación enviada', friend_added: '¡{name} ahora es tu amigo!',
    player_joined: '{name} se ha unido', player_left: '{name} se ha ido', new_host: '{name} es el nuevo host', game_starting: 'La partida empieza en {s}',
    err_auth: 'No has iniciado sesión', err_name_invalid: 'Nombre no válido (3-16 caracteres: letras, números y _)', err_name_taken: 'Ese nombre ya está en uso', err_room_full: 'La sala está llena', err_code_invalid: 'Código no válido', err_room_not_found: 'Sala no encontrada', err_not_host: 'Solo el host puede hacer eso', err_in_game: 'La partida ya está en curso', err_need_players: 'Se necesitan al menos 2 jugadores (añade bots)',
    err_self: 'No puedes añadirte a ti mismo', err_already_friends: 'Ya sois amigos', err_user_not_found: 'Jugador no encontrado', err_no_request: 'Solicitud no encontrada', err_no_room: 'No estás en una sala', err_not_friends: 'No sois amigos', err_friend_offline: 'Tu amigo está desconectado', err_friend_not_in_room: 'Tu amigo no está en una sala', err_room_private: 'La sala es privada'
  },
  en: {
    game_title: 'RECOIL ARENA', loading: 'Loading...', connecting: 'Connecting...', reconnecting: 'Reconnecting...', connected: 'Connected',
    play: 'PLAY', shop: 'SHOP', friends: 'FRIENDS', settings: 'SETTINGS', coins: 'Coins', language: 'Language', close: 'Close', back: 'Back', save: 'Save', cancel: 'Cancel', copy: 'Copy', copied: 'Copied!',
    username: 'Username', username_hint: '3-16 characters: letters, numbers and _', welcome_title: 'Welcome!', enter: 'ENTER',
    play_title: 'Choose how to play', quick: 'Quick Match', quick_desc: 'Automatically join a room', create: 'Create Room', create_desc: 'Create a room and share the code',
    join_code: 'Join with Code', join_desc: "Enter a friend's code", browse: 'Browse Games', browse_desc: 'List of public rooms', code_placeholder: 'CODE', join: 'JOIN', no_rooms: 'No public rooms right now', refresh: 'Refresh', in_lobby: 'In lobby', in_game: 'In game',
    room_code: 'ROOM CODE', players: 'Players', host_badge: 'HOST', bot_badge: 'BOT', map: 'Map', room_public: 'Public room', room_private: 'Private room', visibility: 'Visibility', max_players: 'Max players', bots: 'Bots', start_game: 'START GAME', leave: 'LEAVE', waiting_host: 'Waiting for the host...',
    map_arena: 'Classic Arena', map_sky: 'Infinite Sky', map_maze: 'Box Maze', map_volcano: 'Cartoon Volcano',
    hud_kills: 'KILLS', next_roulette: 'NEXT ROULETTE', roulette_go: 'ROULETTE!', ping: 'Ping', ability_dash: 'Dash', ability_bomb: 'Bomb', ability_grapple: 'Grapple', nuke_ready: 'NUKE READY! (R)', top3: 'TOP 3',
    scoreboard: 'SCOREBOARD', sb_player: 'Player', sb_kills: 'Kills', sb_deaths: 'Deaths', sb_ping: 'Ping',
    eliminated: 'ELIMINATED!', killed_by: 'Eliminated by {name}', killed_by_lava: 'You melted in lava', respawn_in: 'Respawning in {s}', spectating: 'Spectator mode: WASD to move the camera', void_fall: 'Falling into infinity!',
    victory: 'VICTORY!', winner_is: 'Winner: {name}', stats: 'Statistics', st_kills: 'Kills', st_deaths: 'Deaths', st_kd: 'K/D', st_damage: 'Damage', st_distance: 'Distance', st_powerups: 'Power-ups', st_coins: 'Coins earned', play_again: 'Play Again', back_lobby: 'Back to Lobby',
    double_kill: 'DOUBLE KILL!', triple_kill: 'TRIPLE KILL!', mega_kill: 'MEGA KILL!', fever_mode: 'FEVER MODE!', killed: 'eliminated', cause_lava: 'lava', cause_void: 'the void',
    pu_shield: 'Bubble Shield', pu_invisible: 'Invisibility', pu_giant: 'Giant Bullets', pu_speed: 'Lightning Speed', pu_magnet: 'Coin Magnet', pu_nuke: 'Nuclear Bomb', pu_fever: 'Fever Mode', pu_expired: 'Power-up ended', pu_got: 'You got {name}!', pu_expiring: 'Running out!',
    shop_featured: 'FEATURED', shop_daily: 'DAILY', tab_all: 'ALL', tab_skins: 'SKINS', tab_dances: 'DANCES', tab_owned: 'OWNED', buy: 'BUY', equip: 'EQUIP', equipped: 'EQUIPPED', owned: 'OWNED', not_enough: 'Not enough coins', purchased: 'Purchase complete!', slot: 'Slot {n}', empty_tab: 'Nothing here yet',
    rarity_common: 'Common', rarity_rare: 'Rare', rarity_epic: 'Epic', rarity_legendary: 'Legendary',
    skin_default: 'Classic', skin_robot: 'Robot', skin_ghost: 'Ghost', skin_ninja: 'Ninja', skin_clown: 'Clown', skin_alien: 'Alien', skin_gold: 'Golden',
    emote_robot: 'The Robot', emote_wave: 'The Wave', emote_spin: 'Crazy Spin', emote_moonwalk: 'The Moonwalk', emote_floss: 'Floss', emote_breakdance: 'Breakdance', emote_kpop: 'K-Pop', emote_victory: 'Victory Royale',
    set_sfx: 'Effects volume', set_music: 'Music volume', set_sens: 'Mouse sensitivity', set_blur: 'Motion blur', set_shake: 'Screen shake', set_quality: 'Graphics quality', q_low: 'Low', q_mid: 'Medium', q_high: 'High', set_hud: 'HUD size', set_cb: 'Colorblind mode', cb_none: 'None', cb_prot: 'Protanopia', cb_deut: 'Deuteranopia', cb_trit: 'Tritanopia', set_reduce: 'Reduced motion', set_name: 'Change name', on: 'On', off: 'Off',
    tut_title: 'Tutorial', ctrl_title: "Touch controls", ctrl_edit: "🎮 Customize", aim_assist: "Aim assist", ctrl_hint: "Drag the buttons anywhere you like · tap one to change its size", ctrl_size: "Size", ctrl_opacity: "Opacity", ctrl_reset: "Reset", ctrl_saved: "Controls saved!", ctrl_fire: "Fire", ctrl_jump: "Jump", ctrl_emote: "Dances", ctrl_board: "Scoreboard", set_server: "Online server", set_server_hint: "Leave empty for the default server. The game will reload.", rotate_phone: 'Rotate your phone to landscape', tut_shoot_t: 'Hold 🔥 to shoot. Recoil moves you!', tut_dash_t: 'Tap ⚡ to dash', tut_bomb_t: 'Tap 💥 for the recoil bomb', tut_grapple_t: 'Tap 🪝 to fire the grapple', tut_jump_t: 'Tap ⤒ in mid-air to double jump', tut_emote_t: 'Tap 😀 and pick a dance',  tut_shoot: 'Click to shoot. Recoil moves you!', tut_dash: 'Press Shift to dash', tut_bomb: 'Press Q for the recoil bomb', tut_grapple: 'Press E to fire the grapple', tut_jump: 'Press Space in mid-air for a double jump', tut_emote: 'Press 1-4 to dance (third-person camera)', tut_skip: 'Skip', tut_next: 'Next', tut_done: "Let's play!",
    friends_title: 'Friends', add_friend: 'Add', search_player: 'Search player...', st_online: 'Online', st_offline: 'Offline', st_ingame: 'In game', invite: 'Invite', join_friend: 'Join', remove: 'Remove', accept: 'Accept', decline: 'Decline', requests: 'Requests', no_friends: 'You have no friends yet', request_sent: 'Request sent', request_from: '{name} wants to be your friend', friend_online: '🟢 {name} is now online', friend_offline: '🔴 {name} went offline', invite_received: '{name} invites you to play', invite_sent: 'Invitation sent', friend_added: '{name} is now your friend!',
    player_joined: '{name} joined', player_left: '{name} left', new_host: '{name} is the new host', game_starting: 'Game starts in {s}',
    err_auth: 'You are not signed in', err_name_invalid: 'Invalid name (3-16 characters: letters, numbers and _)', err_name_taken: 'That name is already in use', err_room_full: 'The room is full', err_code_invalid: 'Invalid code', err_room_not_found: 'Room not found', err_not_host: 'Only the host can do that', err_in_game: 'The game is already in progress', err_need_players: 'At least 2 players needed (add bots)',
    err_self: "You can't add yourself", err_already_friends: 'You are already friends', err_user_not_found: 'Player not found', err_no_request: 'Request not found', err_no_room: "You're not in a room", err_not_friends: 'You are not friends', err_friend_offline: 'Your friend is offline', err_friend_not_in_room: 'Your friend is not in a room', err_room_private: 'The room is private'
  },
  fr: {
    game_title: 'RECOIL ARENA', loading: 'Chargement...', connecting: 'Connexion...', reconnecting: 'Reconnexion...', connected: 'Connecté',
    play: 'JOUER', shop: 'BOUTIQUE', friends: 'AMIS', settings: 'PARAMÈTRES', coins: 'Pièces', language: 'Langue', close: 'Fermer', back: 'Retour', save: 'Enregistrer', cancel: 'Annuler', copy: 'Copier', copied: 'Copié !',
    username: "Nom d'utilisateur", username_hint: '3-16 caractères : lettres, chiffres et _', welcome_title: 'Bienvenue !', enter: 'ENTRER',
    play_title: 'Choisis comment jouer', quick: 'Partie Rapide', quick_desc: 'Rejoins automatiquement un salon', create: 'Créer un Salon', create_desc: 'Crée un salon et partage le code',
    join_code: 'Rejoindre avec un Code', join_desc: "Saisis le code d'un ami", browse: 'Chercher une Partie', browse_desc: 'Liste des salons publics', code_placeholder: 'CODE', join: 'REJOINDRE', no_rooms: 'Aucun salon public pour le moment', refresh: 'Actualiser', in_lobby: 'Au salon', in_game: 'En partie',
    room_code: 'CODE DU SALON', players: 'Joueurs', host_badge: 'HÔTE', bot_badge: 'BOT', map: 'Carte', room_public: 'Salon public', room_private: 'Salon privé', visibility: 'Visibilité', max_players: 'Joueurs max', bots: 'Bots', start_game: 'LANCER LA PARTIE', leave: 'QUITTER', waiting_host: "En attente de l'hôte...",
    map_arena: 'Arène Classique', map_sky: 'Ciel Infini', map_maze: 'Labyrinthe de Caisses', map_volcano: 'Volcan Cartoon',
    hud_kills: 'KILLS', next_roulette: 'PROCHAINE ROULETTE', roulette_go: 'ROULETTE !', ping: 'Ping', ability_dash: 'Dash', ability_bomb: 'Bombe', ability_grapple: 'Grappin', nuke_ready: 'NUCLÉAIRE PRÊTE ! (R)', top3: 'TOP 3',
    scoreboard: 'TABLEAU', sb_player: 'Joueur', sb_kills: 'Kills', sb_deaths: 'Morts', sb_ping: 'Ping',
    eliminated: 'ÉLIMINÉ !', killed_by: 'Éliminé par {name}', killed_by_lava: 'Tu as fondu dans la lave', respawn_in: 'Retour dans {s}', spectating: 'Mode spectateur : ZQSD pour bouger la caméra', void_fall: "Chute vers l'infini !",
    victory: 'VICTOIRE !', winner_is: 'Vainqueur : {name}', stats: 'Statistiques', st_kills: 'Kills', st_deaths: 'Morts', st_kd: 'K/D', st_damage: 'Dégâts', st_distance: 'Distance', st_powerups: 'Bonus', st_coins: 'Pièces gagnées', play_again: 'Rejouer', back_lobby: 'Retour au Salon',
    double_kill: 'DOUBLE KILL !', triple_kill: 'TRIPLE KILL !', mega_kill: 'MEGA KILL !', fever_mode: 'MODE FIÈVRE !', killed: 'a éliminé', cause_lava: 'la lave', cause_void: 'le vide',
    pu_shield: 'Bouclier Bulle', pu_invisible: 'Invisibilité', pu_giant: 'Balles Géantes', pu_speed: 'Vitesse Éclair', pu_magnet: 'Aimant à Pièces', pu_nuke: 'Bombe Nucléaire', pu_fever: 'Mode Fièvre', pu_expired: 'Bonus terminé', pu_got: 'Tu as obtenu {name} !', pu_expiring: 'Bientôt fini !',
    shop_featured: 'À LA UNE', shop_daily: 'QUOTIDIENS', tab_all: 'TOUT', tab_skins: 'SKINS', tab_dances: 'DANSES', tab_owned: 'POSSÉDÉS', buy: 'ACHETER', equip: 'ÉQUIPER', equipped: 'ÉQUIPÉ', owned: 'POSSÉDÉ', not_enough: "Pas assez de pièces", purchased: 'Achat effectué !', slot: 'Emplacement {n}', empty_tab: 'Rien ici pour le moment',
    rarity_common: 'Commun', rarity_rare: 'Rare', rarity_epic: 'Épique', rarity_legendary: 'Légendaire',
    skin_default: 'Classique', skin_robot: 'Robot', skin_ghost: 'Fantôme', skin_ninja: 'Ninja', skin_clown: 'Clown', skin_alien: 'Alien', skin_gold: 'Doré',
    emote_robot: 'Le Robot', emote_wave: 'La Vague', emote_spin: 'Toupie Folle', emote_moonwalk: 'Le Moonwalk', emote_floss: 'Floss', emote_breakdance: 'Breakdance', emote_kpop: 'K-Pop', emote_victory: 'Victory Royale',
    set_sfx: 'Volume des effets', set_music: 'Volume de la musique', set_sens: 'Sensibilité de la souris', set_blur: 'Flou de mouvement', set_shake: 'Tremblement écran', set_quality: 'Qualité graphique', q_low: 'Basse', q_mid: 'Moyenne', q_high: 'Haute', set_hud: "Taille de l'ATH", set_cb: 'Mode daltonien', cb_none: 'Aucun', cb_prot: 'Protanopie', cb_deut: 'Deutéranopie', cb_trit: 'Tritanopie', set_reduce: 'Réduction des mouvements', set_name: 'Changer de nom', on: 'Oui', off: 'Non',
    tut_title: 'Tutoriel', ctrl_title: "Commandes tactiles", ctrl_edit: "🎮 Personnaliser", aim_assist: "Aide à la visée (aim assist)", ctrl_hint: "Fais glisser les boutons où tu veux · touche-en un pour changer sa taille", ctrl_size: "Taille", ctrl_opacity: "Opacité", ctrl_reset: "Réinitialiser", ctrl_saved: "Commandes enregistrées !", ctrl_fire: "Tir", ctrl_jump: "Saut", ctrl_emote: "Danses", ctrl_board: "Classement", set_server: "Serveur en ligne", set_server_hint: "Laisse vide pour le serveur par défaut. Le jeu va se recharger.", rotate_phone: 'Tourne ton téléphone en paysage', tut_shoot_t: 'Maintiens 🔥 pour tirer. Le recul te fait avancer !', tut_dash_t: 'Touche ⚡ pour dasher', tut_bomb_t: 'Touche 💥 pour la bombe de recul', tut_grapple_t: 'Touche 🪝 pour lancer le grappin', tut_jump_t: "Touche ⤒ en l'air pour un double saut", tut_emote_t: 'Touche 😀 et choisis une danse',  tut_shoot: 'Clique pour tirer. Le recul te fait avancer !', tut_dash: 'Appuie sur Maj pour dasher', tut_bomb: 'Appuie sur A pour la bombe de recul', tut_grapple: 'Appuie sur E pour lancer le grappin', tut_jump: 'Appuie sur Espace en l\'air pour un double saut', tut_emote: 'Appuie sur 1-4 pour danser (caméra à la 3e personne)', tut_skip: 'Passer', tut_next: 'Suivant', tut_done: 'On joue !',
    friends_title: 'Amis', add_friend: 'Ajouter', search_player: 'Chercher un joueur...', st_online: 'En ligne', st_offline: 'Hors ligne', st_ingame: 'En partie', invite: 'Inviter', join_friend: 'Rejoindre', remove: 'Supprimer', accept: 'Accepter', decline: 'Refuser', requests: 'Demandes', no_friends: "Tu n'as pas encore d'amis", request_sent: 'Demande envoyée', request_from: '{name} veut devenir ton ami', friend_online: '🟢 {name} vient de se connecter', friend_offline: '🔴 {name} s\'est déconnecté', invite_received: '{name} t\'invite à jouer', invite_sent: 'Invitation envoyée', friend_added: '{name} est maintenant ton ami !',
    player_joined: '{name} a rejoint la partie', player_left: '{name} est parti', new_host: '{name} est le nouvel hôte', game_starting: 'La partie commence dans {s}',
    err_auth: "Tu n'es pas connecté", err_name_invalid: 'Nom invalide (3-16 caractères : lettres, chiffres et _)', err_name_taken: 'Ce nom est déjà utilisé', err_room_full: 'Le salon est plein', err_code_invalid: 'Code invalide', err_room_not_found: 'Salon introuvable', err_not_host: "Seul l'hôte peut faire ça", err_in_game: 'La partie est déjà en cours', err_need_players: 'Il faut au moins 2 joueurs (ajoute des bots)',
    err_self: 'Tu ne peux pas t\'ajouter toi-même', err_already_friends: 'Vous êtes déjà amis', err_user_not_found: 'Joueur introuvable', err_no_request: 'Demande introuvable', err_no_room: "Tu n'es pas dans un salon", err_not_friends: "Vous n'êtes pas amis", err_friend_offline: 'Ton ami est hors ligne', err_friend_not_in_room: "Ton ami n'est pas dans un salon", err_room_private: 'Le salon est privé'
  }
};

const I18N = {
  langs: ['es', 'en', 'fr'],
  lang: 'es',
  init() {
    let l = null;
    try { l = localStorage.getItem('ra_lang'); } catch (e) {}
    if (!translations[l]) { const nav = (navigator.language || 'es').slice(0, 2).toLowerCase(); l = translations[nav] ? nav : 'es'; }
    this.lang = l; this.apply(document);
  },
  t(key, params) {
    let s = (translations[this.lang] && translations[this.lang][key]) || translations.es[key] || key;
    if (params) for (const k in params) s = s.split('{' + k + '}').join(params[k]);
    return s;
  },
  setLang(l) {
    if (!translations[l]) return;
    this.lang = l;
    try { localStorage.setItem('ra_lang', l); } catch (e) {}
    this.apply(document);
    window.dispatchEvent(new CustomEvent('langchange', { detail: l }));
  },
  apply(root) { // cambio instantáneo sin recargar
    root = root || document;
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = this.t(el.dataset.i18nPh); });
    root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = this.t(el.dataset.i18nTitle); });
    document.documentElement.lang = this.lang;
    document.querySelectorAll('.langSel').forEach(s => { s.value = this.lang; });
  }
};
window.I18N = I18N; window.translations = translations;
