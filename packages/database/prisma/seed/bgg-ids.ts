/**
 * BGG Top 100 게임 ID 목록
 * 출처: boardgamegeek.com/browse/boardgame
 */
export const BGG_IDS: number[] = [
  // Top 10
  224517, // Brass: Birmingham
  161936, // Pandemic Legacy: Season 1
  174430, // Gloomhaven
  167791, // Terraforming Mars
  233078, // Twilight Imperium 4th Ed.
  220308, // Gaia Project
  115746, // War of the Ring 2nd Ed.
  169786, // Scythe
  187645, // Spirit Island
  316554, // Dune: Imperium

  // Top 11-30
  182028, // Through the Ages: New Story
  271320, // Sleeping Gods
  266192, // Wingspan
  237182, // Root
  342942, // Ark Nova
  12333,  // Twilight Struggle
  291457, // Gloomhaven: Jaws of the Lion
  28143,  // Race for the Galaxy
  256916, // The Quacks of Quedlinburg
  31260,  // Agricola

  // Strategy 중량급
  36218,  // Dominion
  68448,  // 7 Wonders
  13,     // Catan
  9209,   // Ticket to Ride
  822,    // Carcassonne
  40834,  // Agricola (2nd)
  124361, // Concordia
  148228, // Viticulture Essential Edition
  205896, // Pandemic: Iberia
  163412, // Patchwork

  // 전략 중간 무게
  110327, // Lords of Waterdeep
  120677, // Terra Mystica
  177736, // A Feast for Odin
  14996,  // Ticket to Ride Europe
  3076,   // Puerto Rico
  25613,  // Hanabi
  68448,  // 7 Wonders Duel (167354)
  167354, // 7 Wonders Duel
  230802, // Azul
  209010, // Pandemic: Fall of Rome

  // 파티 / 가벼운 게임
  178900, // Codenames
  190457, // Pandemic: Reign of Cthulhu
  131357, // Coup
  161417, // Love Letter
  364073, // Wavelength
  223040, // Point Salad
  192291, // Just One
  274841, // The Crew
  244521, // Horrified
  295947, // The Crew: The Quest for Planet Nine

  // 협력 게임
  156129, // Pandemic Legacy: Season 2
  174430, // Gloomhaven (dup remove)
  234669, // Nemesis
  262543, // Cartographers
  205896, // Pandemic Iberia (dup)
  283864, // Wingspan Asia
  324856, // Ark Nova Marine Worlds
  359970, // Heat: Pedal to the Metal

  // 카드 게임
  40834,  // Dominion Intrigue
  65244,  // Innovation
  128882, // Netrunner
  120677, // Terra Mystica (dup)
  15512,  // Pandemic
  30549,  // Pandemic On the Brink

  // 유로 게임
  246900, // Lisboa
  199792, // Architects of the West Kingdom
  262211, // Everdell
  220877, // Wingspan (dup)
  269144, // Parks
  266524, // Orléans
  237182, // Root (dup)
  291453, // Maracaibo
  224517, // Brass Birmingham (dup)
  39856,  // Power Grid

  // 덱빌딩
  36218,  // Dominion (dup)
  110327, // Clank!
  208983, // Star Realms
  271217, // Aeon's End
  172225, // Century Spice Road
  264220, // Hadara

  // 한국 인기 게임
  9216,   // Tichu
  39463,  // Ticket to Ride Nordic Countries
  70323,  // King of Tokyo
  136888, // Mysterium
  158600, // Codenames (dup)
  203993, // Pandemic: Rapid Response
  251724, // Villagers
  284108, // Wingspan European Expansion

  // 추가
  316554, // Dune Imperium (dup)
  224037, // Brass: Lancashire
  251247, // Tainted Grail
  37111,  // Pandemic (2nd)
  173346, // 7 Wonders: Armada
  184267, // Dead of Winter
  150376, // Dead of Winter Long Night
  126042, // Splendor
  148949, // Istanbul
  2655,   // Hive
  9609,   // Ticket to Ride USA (dup of 9209)
  171623, // The Castles of Burgundy
  199478, // Pandemic: Contagion
  205637, // Decrypto
  263918, // Tainted Grail 2
]

// 중복 제거 + 100개 제한
export const UNIQUE_BGG_IDS = [...new Set(BGG_IDS)].slice(0, 100)
