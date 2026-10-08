/*! pixel-cast.js · Plateforme de suivi - Lamia · Lamia & Memeow en pixel art
 *
 * Script classique (pas de module ES, aucune requête réseau) : fonctionne en file://.
 * Expose window.PixelCast, cf. docs/00-cahier-des-charges.md §8 :
 *
 *   const ctrl = PixelCast.mount(canvas, 'lamia' | 'memeow', { scale: 4, animation: 'idle' });
 *   ctrl.play('wave'); ctrl.stop(); ctrl.destroy();
 *   PixelCast.animations            // { lamia: [...], memeow: [...] }
 *   PixelCast.size('lamia')         // { width, height } en pixels « art »
 *   PixelCast.icon('heart', 4)      // -> HTMLCanvasElement
 *   PixelCast.iconDataURL('heart', 4) // -> 'data:image/png;base64,...'
 *   Option de mount facultative : flip: true (miroir). Liseré en mode sombre : --pixel-cast-rim.
 *
 * FORMAT DES SPRITES (détails dans design/sprites/README.md)
 * - Chaque personnage a une palette : un caractère = une couleur ('#RRGGBB' ou '#RRGGBBAA').
 * - Les « calques » (parts) sont des grilles de texte, une chaîne par ligne, sur toute la
 *   largeur du personnage. `y` indique la ligne où commence la grille.
 *     '.' = rien (on voit ce qu'il y a dessous)    '_' = gomme (rend le pixel transparent)
 * - Une image d'animation = [durée en ms, 'calque calque@dx,dy ...'] : les calques sont
 *   empilés de gauche à droite (le premier est au fond). '@dx,dy' décale un calque.
 */
(function (root) {
  'use strict';

  /* =======================================================================
     1. LES PERSONNAGES
     ======================================================================= */

  var CAST = {};

  /* ---------------------------------------------------------------------
     LAMIA · 32 × 48
     --------------------------------------------------------------------- */
  CAST.lamia = {
    width: 32,
    height: 48,
    palette: {
      o: '#2B2150', // contour indigo
      O: '#130F21', // contour des cheveux (le plus sombre)
      A: '#1C1830', // cheveux, ombre (sépare les boucles)
      a: '#28233F', // cheveux, base (noir bleuté)
      b: '#3C4581', // cheveux, reflet bleu nuit
      c: '#6D80C6', // cheveux, brillance
      s: '#F9DCCB', // peau
      S: '#EBB49E', // peau, ombre
      r: '#F4A3A6', // joues
      m: '#B84E6A', // bouche
      e: '#191329', // yeux
      w: '#FFFFFF', // reflet des yeux
      g: '#C97A6E', // lunettes rose gold
      G: '#F2C3B2', // lunettes, reflet
      t: '#EAD8BC', // tee-shirt beige
      T: '#CDB590', // tee-shirt, ombre
      u: '#F8F0E2', // tee-shirt, lumière
      j: '#5878BD', // jean
      J: '#3D5795', // jean, ombre
      i: '#86A3DA', // jean, lumière
      W: '#FFFFFF', // Converse blanches
      x: '#C9CDE0', // Converse, ombre / lacets
      z: '#2E3466', // Converse, liseré de semelle
      d: '#36305C', // tablette graphique
      D: '#DCE9FF', // écran de la tablette
      n: '#F2F1FA', // stylet
      k: '#F27BA8', // rose (dessin, étincelles)
      y: '#FFCF4D', // étincelle dorée
      Y: '#FFF7D6', // étincelle, cœur lumineux
      '%': '#2B215030' // ombre portée au sol
    },
    parts: {
      pen: { y: 21, rows: [
        '................................',
        '...........noo..................',
        '..........osso..................',
        '.........ossSSo.................',
        '........ossoon..................',
        '.......osSo...n.................',
        '........oo.....o................'
      ]},
      shadowSmall: { y: 46, rows: [
        '................................',
        '..........%%%%%%%%%%%%..........'
      ]},
      armsTablet: { y: 21, rows: [
        '........ou..............to......',
        '.......outt............ttto.....',
        '......outttT..........TtttTo....',
        '......oTTTTo..........oTTTTo....',
        '.......osSo............osSo.....',
        '.......osSo............osSo.....',
        '.......osSo............osSo.....',
        '........oo............osSSo.....',
        '...................oossso.......',
        '...................osssSo.......',
        '....................oooo........'
      ]},
      tablet4: { y: 21, rows: [
        '................................',
        '................................',
        '................................',
        '................................',
        '.............ddddddddd..........',
        '............dDyDkDkDYd..........',
        '............dDDkkkkkDd..........',
        '............dDDDkkkDDd..........',
        '............dDyDDkDDDd..........',
        '............dDDDDDDDDd..........',
        '............dddddddddd..........'
      ]},
      tablet3: { y: 21, rows: [
        '................................',
        '................................',
        '................................',
        '................................',
        '.............ddddddddd..........',
        '............dDDDkDkDDd..........',
        '............dDDkkkkkDd..........',
        '............dDDDkkkDDd..........',
        '............dDDDDDDDDd..........',
        '............dDDDDDDDDd..........',
        '............dddddddddd..........'
      ]},
      tablet2: { y: 21, rows: [
        '................................',
        '................................',
        '................................',
        '................................',
        '.............ddddddddd..........',
        '............dDDDkDDDDd..........',
        '............dDDkkkDDDd..........',
        '............dDDDkkDDDd..........',
        '............dDDDDDDDDd..........',
        '............dDDDDDDDDd..........',
        '............dddddddddd..........'
      ]},
      tablet1: { y: 21, rows: [
        '................................',
        '................................',
        '................................',
        '................................',
        '.............ddddddddd..........',
        '............dDDDkDDDDd..........',
        '............dDDkkDDDDd..........',
        '............dDDDDDDDDd..........',
        '............dDDDDDDDDd..........',
        '............dDDDDDDDDd..........',
        '............dddddddddd..........'
      ]},
      tablet0: { y: 21, rows: [
        '................................',
        '................................',
        '................................',
        '................................',
        '.............ddddddddd..........',
        '............dDDDDDDDDd..........',
        '............dDDDDDDDDd..........',
        '............dDDDDDDDDd..........',
        '............dDDDDDDDDd..........',
        '............dDDDDDDDDd..........',
        '............dddddddddd..........'
      ]},
      mouthFocus: { y: 16, rows: [
        '...............mm...............',
        '................r...............'
      ]},
      mouthOpen: { y: 16, rows: [
        '..............mmmm..............',
        '...............rr...............'
      ]},
      eyesDown: { y: 11, rows: [
        '..........ssss....ssss..........',
        '..........sees....sees..........',
        '..........sees....sees..........'
      ]},
      eyesHappy: { y: 11, rows: [
        '..........ssss....ssss..........',
        '..........sees....sees..........',
        '..........esse....esse..........'
      ]},
      sparkB: { y: 0, rows: [
        '.....y......k...................',
        '....yYy................y........',
        '.....y.................y........',
        '.....................yyYyy......',
        '.......................y........',
        '.......................y........',
        '..............................k.',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '..y.............................',
        '.yYy............................'
      ]},
      sparkA: { y: 0, rows: [
        '........y............k..........',
        '........y.................y.....',
        '......yyYyy..............yYy....',
        '.k......y.................y.....',
        '........y.......................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '................................',
        '.............................y..',
        '............................yYy.',
        '.............................y..'
      ]},
      armsUp: { y: 7, rows: [
        '..ooo......................ooo..',
        '.ossso....................ossso.',
        '.ossso....................ossso.',
        '.oSsso....................ossSo.',
        '..osSo....................oSso..',
        '..osSo....................oSso..',
        '...osSo..................oSso...',
        '...osSo..................oSso...',
        '....osSo................oSso....',
        '....osSo................oSso....',
        '....ouuto..............ottto....',
        '.....ottto............ottto.....',
        '.....ottTo............oTtto.....',
        '......oTTto..........otTTo......',
        '.......oTtt..........ttTo.......',
        '........oTT..........TTo........'
      ]},
      armsWaveB: { y: 10, rows: [
        '.ooo............................',
        'ossso...........................',
        'ossso...........................',
        'oSsso...........................',
        '.osSo...........................',
        '..osSo..........................',
        '..osSo..........................',
        '..osSo..........................',
        '..ossSo.........................',
        '...ossuo........................',
        '....outto.......................',
        '.....outtt............to........',
        '......oTTTT..........ttto.......',
        '.......oTTo.........Ttttto......',
        '....................oTTTTo......',
        '.....................oSso.......',
        '.....................oSso.......',
        '.....................oSso.......',
        '.....................oSso.......',
        '.....................osso.......',
        '.....................osso.......',
        '......................oo........'
      ]},
      armsWaveA: { y: 10, rows: [
        '..ooo...........................',
        '.ossso..........................',
        '.ossso..........................',
        '.oSsso..........................',
        '..osSo..........................',
        '..osSo..........................',
        '..osSo..........................',
        '..osSo..........................',
        '..ossSo.........................',
        '...ossuo........................',
        '....outto.......................',
        '.....outtt............to........',
        '......oTTTT..........ttto.......',
        '.......oTTo.........Ttttto......',
        '....................oTTTTo......',
        '.....................oSso.......',
        '.....................oSso.......',
        '.....................oSso.......',
        '.....................oSso.......',
        '.....................osso.......',
        '.....................osso.......',
        '......................oo........'
      ]},
      curl: { y: 11, rows: [
        '.........................Aa.....',
        '..............................bO',
        '............................A...',
        '........................Aa..b.AO',
        '...........................aaaO_',
        '...........................Aa...',
        '.........................Aa.AAO_',
        '..............................bO',
        '............................A...',
        '...............................O'
      ]},
      shadow: { y: 46, rows: [
        '.......%%%%%%%%%%%%%%%%%%.......',
        '........%%%%%%%%%%%%%%%%........'
      ]},
      hairBack: { y: 16, rows: [
        '..OOOOOOOOOOOOOOOOOOOOOOOOOOOOO.',
        '.OaabbabaaaAAAAAAAAAAAaaababbaaO',
        '..ObaaaAaAAAAAAAAAAAAAAAaAaaabO.',
        '.OaaaAAbaaAAAAAAAAAAAAAaabAAaaaO',
        'OaaaAbbaaaAAAAAAAAAAAAAaaabbAaaO',
        '.OAAbaaaAAAAAAAAAAAAAAAAAaaabAAO',
        '..ObaaAAbbaAAAAAAAAAAAabbAAaabO.',
        '.OaabbabaaaAAAAAAAAAAAaaababbaaO',
        '..ObaaaAaAAAAAAAAAAAAAAAaAaaabO.',
        '.OaaaAAbaaAAAAAAAAAAAAAaabAAaaaO',
        'OaaaAbbaaaOOOOOOOOOOOOOaaabbAaaO',
        '.OAAbaaaOO.............OOaaabAAO',
        '..ObaaAO.................OAaabO.',
        '.OaabbO...................ObbaaO',
        '..OOaaaO.................OaaaOO.',
        '....OOO...................OOO...'
      ]},
      legs: { y: 30, rows: [
        '..........oijjjjJjjjJo..........',
        '..........oijjjjJjjjJo..........',
        '..........oijjjjJjjjJo..........',
        '..........oijjjJojjjJo..........',
        '..........oijjjJojjjJo..........',
        '..........oijjjJojjjJo..........',
        '..........oijjjJojjjJo..........',
        '..........oijjjJojjjJo..........',
        '..........oiiiiJoiiiio..........',
        '..........ojjjjJojjjJo..........',
        '..........oWxWWooWWxWo..........',
        '..........oWWxWooWxWWo..........',
        '.........oWWxWWooWWxWWo.........',
        '.........oxxxxxooxxxxxo.........',
        '........oWWWWWxooxWWWWWo........',
        '........ozzzzzzoozzzzzzo........',
        '........oWWWWWWooWWWWWWo........',
        '.........oooooo..oooooo.........'
      ]},
      torso: { y: 19, rows: [
        '..............oSSo..............',
        '..............osso..............',
        '........ouuttTTssTTtttto........',
        '.......ouuttttTTTTtttttTo.......',
        '.........outtttttttttTTo........',
        '.........outtttttttttTTo........',
        '.........outtttttttttTo.........',
        '.........outtttttttttTTo........',
        '.........outtttttttttTo.........',
        '.........outtttttttttTTo........',
        '.........oTTTTTTTTTTTTo.........'
      ]},
      arms: { y: 21, rows: [
        '........ou............to........',
        '.......outt..........ttto.......',
        '......outttT........Ttttto......',
        '......oTTTTo........oTTTTo......',
        '.......osSo..........oSso.......',
        '.......osSo..........oSso.......',
        '.......osSo..........oSso.......',
        '.......osSo..........oSso.......',
        '.......osso..........osso.......',
        '.......osso..........osso.......',
        '........oo............oo........'
      ]},
      head: { y: 0, rows: [
        '................................',
        '............OOOOOOOO............',
        '..........OOabcccbbaOOOO........',
        '........OOaaaabbaabbSaaaOO......',
        '.......OaaaabbaabbaaSaaabaO.....',
        '......OaaabbaabbaaaOssOaabbO....',
        '.....OaabbaabbaaaOOssssOaaAO....',
        '....ObbaaabbaOOOsssssssOaabO....',
        '....OaaaAbaOOsssssOOOssOAaaaO...',
        '.OOOAaAAaOOssssssssssssOAAAO.OOO',
        'OaaabaabbOGgggssssGgggsabbaaOaaO',
        '.OAbaabaagseesggggseesgaaabaabAO',
        '..OaaAAaAgswesgssgswesgAAaAAaaO.',
        '.OaaabbabgseesgssgseesgababbaaaO',
        '..OAbaabasggggssssggggsaabaaOAO.',
        '.ObaAaAAasrrssSssSssrrsAaAAO.ObO',
        'OaaabaabbAsssssmmsssssAabbaaOaaO',
        '.OAbaabaaO.ssssssssss.OaaabaabAO',
        '..OaaAAaO...ssssssss...OOaAAaaO.',
        '.OaaabbO....ooSSSSoo.....ObbaaaO',
        '..OOOaaaO...............OaaaOOO.',
        '.....OOO.................OOO....',
        '................................'
      ]},
      blink: { y: 11, rows: [
        '..........ssss....ssss..........',
        '..........seeS....seeS..........',
        '..........ssss....ssss..........'
      ]}
    },
    // Pile de calques commune : ombre, cheveux de dos, jambes, torse, tête, puis bras.
    // « @0,1 » = respiration (le haut du corps descend d'1 pixel).
    animations: {
      idle: { loop: true, still: 0, blink: 5, frames: [
        [520, 'shadow hairBack legs torso head arms'],
        [520, 'shadow hairBack@0,1 legs torso@0,1 head@0,1 arms@0,1'],
        [520, 'shadow hairBack legs torso head curl arms'],
        [520, 'shadow hairBack@0,1 legs torso@0,1 head@0,1 curl@0,1 arms@0,1'],
        [520, 'shadow hairBack legs torso head arms'],
        [130, 'shadow hairBack legs torso head arms blink'],
        [520, 'shadow hairBack@0,1 legs torso@0,1 head@0,1 arms@0,1'],
        [520, 'shadow hairBack legs torso head arms']
      ]},
      wave: { loop: false, still: 1, frames: [
        [140, 'shadow hairBack legs torso head arms mouthOpen'],
        [170, 'shadow hairBack legs torso head armsWaveA mouthOpen'],
        [170, 'shadow hairBack legs torso head armsWaveB mouthOpen'],
        [170, 'shadow hairBack legs torso head armsWaveA mouthOpen'],
        [170, 'shadow hairBack legs torso head armsWaveB mouthOpen'],
        [170, 'shadow hairBack legs torso head armsWaveA mouthOpen'],
        [170, 'shadow hairBack legs torso head armsWaveB mouthOpen'],
        [130, 'shadow hairBack legs torso head armsWaveA blink'],
        [380, 'shadow hairBack legs torso head armsWaveA']
      ]},
      cheer: { loop: false, still: 2, frames: [
        [140, 'shadow hairBack@0,1 legs torso@0,1 head@0,1 arms@0,1 eyesHappy@0,1'],
        [170, 'shadowSmall hairBack@0,-3 legs@0,-3 torso@0,-3 head@0,-3 eyesHappy@0,-3 mouthOpen@0,-3 armsUp@0,-3 sparkA'],
        [170, 'shadow hairBack legs torso head eyesHappy mouthOpen armsUp sparkB'],
        [170, 'shadowSmall hairBack@0,-3 legs@0,-3 torso@0,-3 head@0,-3 eyesHappy@0,-3 mouthOpen@0,-3 armsUp@0,-3 sparkA'],
        [200, 'shadow hairBack legs torso head eyesHappy mouthOpen armsUp sparkB'],
        [220, 'shadow hairBack legs torso head eyesHappy mouthOpen armsUp@0,1 sparkA'],
        [360, 'shadow hairBack legs torso head eyesHappy armsUp']
      ]},
      typing: { loop: false, still: 4, frames: [
        [320, 'shadow hairBack legs torso head eyesDown mouthFocus tablet0 armsTablet pen@-1,0'],
        [220, 'shadow hairBack legs torso head eyesDown mouthFocus tablet1 armsTablet pen'],
        [220, 'shadow hairBack@0,1 legs torso@0,1 head@0,1 eyesDown@0,1 mouthFocus@0,1 tablet1 armsTablet@0,1 pen@1,0'],
        [220, 'shadow hairBack legs torso head eyesDown mouthFocus tablet2 armsTablet pen@1,1'],
        [220, 'shadow hairBack legs torso head eyesDown mouthFocus tablet2 armsTablet pen@0,1'],
        [220, 'shadow hairBack@0,1 legs torso@0,1 head@0,1 eyesDown@0,1 mouthFocus@0,1 tablet3 armsTablet@0,1 pen@2,0'],
        [220, 'shadow hairBack legs torso head eyesDown mouthFocus tablet3 armsTablet pen@2,1'],
        [300, 'shadow hairBack legs torso head eyesDown tablet4 armsTablet pen@1,2'],
        [700, 'shadow hairBack legs torso head eyesHappy mouthOpen tablet4 armsTablet pen@1,2']
      ]}
    }
  };

  /* ---------------------------------------------------------------------
     MEMEOW · 32 × 24
     --------------------------------------------------------------------- */
  CAST.memeow = {
    width: 32,
    height: 24,
    palette: {
      o: '#2B2150', // contour indigo
      k: '#2C2637', // pelage noir
      K: '#4A4358', // noir, reflet
      n: '#7A5236', // brun
      N: '#57392A', // brun foncé (rayures)
      g: '#8F8A9C', // gris
      G: '#6B6679', // gris, rayures
      r: '#E8893C', // roux
      R: '#C2632A', // roux, rayures
      y: '#F5B66E', // roux clair (museau, pattes)
      e: '#7DD35A', // yeux verts
      E: '#4E9E3A', // yeux verts, ombre
      p: '#1A1430', // pupille
      w: '#FFFFFF', // reflet des yeux
      P: '#F49AB2', // truffe rose
      q: '#E9A0B4', // intérieur des oreilles
      M: '#5A2342', // bouche ouverte
      t: '#F27F9C', // langue
      b: '#8C7BE8', // gamelle violette
      B: '#6553C4', // gamelle, ombre
      v: '#C4B8FF', // gamelle, reflet
      c: '#B8763A', // croquette
      C: '#875125', // croquette, ombre
      h: '#C9CDE2', // clavier, interstices
      H: '#F7F8FD', // touches du clavier
      j: '#A3A8C6', // clavier, tranche
      z: '#8B79F2', // « z » du sommeil
      '%': '#2B215030' // ombre portée
    },
    parts: {
      zC: { y: 0, rows: [
        '.....................zzzzz......',
        '........................z.......',
        '.......................z........',
        '......................z.........',
        '.....................zzzzz......'
      ]},
      zB: { y: 0, rows: [
        '...................zzzzz........',
        '......................z.........',
        '..............zzzz...z..........',
        '................z...z...........',
        '...............z...zzzzz........',
        '..............zzzz..............'
      ]},
      zA: { y: 4, rows: [
        '............zzzz................',
        '..............z.................',
        '.............z..................',
        '............zzzz................'
      ]},
      sleepTail: { y: 14, rows: [
        '...........................oo...',
        '................ooooooooooorro..',
        '...............orrggggkkkkrrro..',
        '...............orrggggkkkkrro...',
        '................oooooooooooo....'
      ]},
      sleepHead: { y: 8, rows: [
        '....o.......o...................',
        '....oko....oro..................',
        '...oqkkooooorqo.................',
        '...okknkkrRrrrro................',
        '..okknkkkrrRrrrro...............',
        '..oknoonkrroorrro...............',
        '..okkkkyyPyyrrrro...............',
        '...okkyyoyyyrrro................',
        '...ooyyyyyyyygoo................',
        '..oyyyoyyyggogggo...............',
        '..ooooooooooooooo...............'
      ]},
      sleepBodyIn: { y: 6, rows: [
        '...............oooooo...........',
        '............oooRrrRrrooo........',
        '...........onkknrrRrrRrro.......',
        '..........oknkknkrRrrRrrRo......',
        '.........okknkknkkRrrRrgGgo.....',
        '........oRkknkknkrRrrRggGggo....',
        '.......onNnknkknrrRrrRggGggRo...',
        '.......onNnrRkrRrrRrrRggGggRo...',
        '.......onNnrRrrRrrRrrRrgGgrRo...',
        '.......onNnrRrrRrrRrrRrrRrrRo...',
        '.......onNnrRrrRrrRrrRrrRrrRo...'
      ]},
      sleepBody: { y: 7, rows: [
        '..............oooooooo..........',
        '............ooknrrRrrRoo........',
        '..........oonkknkrRrrRrroo......',
        '.........okknkknkkRrrRrgGgo.....',
        '........oRkknkknkrRrrRggGggo....',
        '........oNnknkknrrRrrRggGggo....',
        '.......onNnrRkrRrrRrrRggGggRo...',
        '.......onNnrRrrRrrRrrRrgGgrRo...',
        '.......onNnrRrrRrrRrrRrrRrrRo...',
        '.......onNnrRrrRrrRrrRrrRrrRo...'
      ]},
      keyboard: { y: 16, rows: [
        '..oooooooooooooooooooooooooooo..',
        '.ohHHhHHhHHhHHhHHhHHhHHhHHhHHho.',
        '.ohhHHhHHhHHhHHhHHhHHhHHhHHhhho.',
        '.ohHHhhhHHHHHHHHHHHHHhhhHHhHHho.',
        '.ojjjjjjjjjjjjjjjjjjjjjjjjjjjjo.',
        '..oooooooooooooooooooooooooooo..',
        '..%%%%%%%%%%%%%%%%%%%%%%%%%%%%..'
      ]},
      bowl: { y: 17, rows: [
        '.....................ooooooooo..',
        '....................ovBBBBBBBvo.',
        '....................ovvvvvvvvvo.',
        '.....................obbvbvbbo..',
        '.....................obbbvbbbo..',
        '......................oBBBBBo...',
        '.....................%%ooooo%%..'
      ]},
      pawUp: { y: 9, rows: [
        '.........ooo....................',
        '........oyyyo...................',
        '........oyoyo...................',
        '........orrRo...................',
        '........oRrro...................',
        '........orRRo...................',
        '........oRrro...................'
      ]},
      bodyPaw: { y: 13, rows: [
        '.....okkkggyygrrrro.............',
        '.....okkkgGggGrrRro.............',
        '....oknkkkNNGggGrRro............',
        '....onknkNNNNGGGorRo............',
        '...okknkkNNNNGggorrRo...........',
        '...onkknkkNNNGggoRrro...........',
        '...okknkkNNNNGGGorRro...........',
        '...oknknkNNNoggggorRro..........',
        '...okkkkkkkoogogorrro...........',
        '....oooooooooooooooo............'
      ]},
      tongue: { y: 12, rows: [
        '............t...................',
        '............o...................'
      ]},
      mouthMeow: { y: 11, rows: [
        '..........oMMo..................',
        '..........ytty..................',
        '...........oo...................'
      ]},
      earTwitch: { y: 1, rows: [
        '..................._............',
        '..................ooo...........',
        '...................ro...........'
      ]},
      eyesUp: { y: 8, rows: [
        '.......ppw....ppw...............',
        '.......eeE....eeE...............'
      ]},
      eyesSquint: { y: 8, rows: [
        '.......non....ror...............',
        '.......ono....oro...............'
      ]},
      blink: { y: 8, rows: [
        '.......nnn....rrr...............',
        '.......ooo....ooo...............'
      ]},
      tailC: { y: 9, rows: [
        '...........................oo...',
        '..........................orro..',
        '..........................orro..',
        '.........................okkro..',
        '.........................okko...',
        '........................oggko...',
        '.......................ogggo....',
        '......................orrgo.....',
        '......................orro......',
        '.....................okkro......',
        '...................ookkko.......',
        '..................orrrko........',
        '..................orrro.........',
        '...................ooo..........'
      ]},
      tailB: { y: 9, rows: [
        '........................oo......',
        '.......................orro.....',
        '.......................orrro....',
        '........................okko....',
        '........................okko....',
        '........................oggo....',
        '.......................ogggo....',
        '......................orrgo.....',
        '......................orro......',
        '.....................okkro......',
        '...................ookkko.......',
        '..................orrrko........',
        '..................orrro.........',
        '...................ooo..........'
      ]},
      tailA: { y: 10, rows: [
        '......................ooo.......',
        '.....................orrro......',
        '.....................orrkko.....',
        '......................ookko.....',
        '.......................oggo.....',
        '.......................oggo.....',
        '......................orrgo.....',
        '......................orro......',
        '.....................okkro......',
        '...................ookkko.......',
        '..................orrrko........',
        '..................orrro.........',
        '...................ooo..........'
      ]},
      body: { y: 13, rows: [
        '.....okkkggyygrrrro.............',
        '.....okkkgGggGrrRro.............',
        '....oknkrrRGGggGrRro............',
        '....onkoRRRNNGGGorRo............',
        '...okknorrRNNGggorrRo...........',
        '...onkkorrRNNGggoRrro...........',
        '...okknoRRRNNGGGorRro...........',
        '...oknkoyyyooggggorRro..........',
        '...okkkoyoyoogogorrro...........',
        '....oooooooooooooooo............'
      ]},
      head: { y: 1, rows: [
        '....o..............o............',
        '....oo............oo............',
        '....oko..........oro............',
        '....oqko........orqo............',
        '....oqkkoooooooorRqo............',
        '...okknNnkNrRrRrrRrro...........',
        '...oknnNnnkrrRrrRrryo...........',
        '...oknnwpenkrrwpeRrro...........',
        '...oknnEpEnkrREpERrro...........',
        '..okknNnnnyPPyrrRrrRro..........',
        '..oknkkknyyooyyrrRrrro..........',
        '...okkkkkyyyyyyrrrRro...........',
        '....oooo........oooo............'
      ]},
      shadow: { y: 23, rows: [
        '...%%%%%%%%%%%%%%%%%%...........'
      ]},
    },
    animations: {
      idle: { loop: true, still: 0, blink: 4, frames: [
        [420, 'shadow tailA body head'],
        [420, 'shadow tailB body head'],
        [420, 'shadow tailC body head'],
        [420, 'shadow tailB body head'],
        [140, 'shadow tailA body head blink'],
        [420, 'shadow tailA body head'],
        [420, 'shadow tailB body head'],
        [160, 'shadow tailC body head earTwitch'],
        [420, 'shadow tailC body head'],
        [420, 'shadow tailB body head']
      ]},
      // En boule sur le clavier : respiration (le dos se soulève) et petits « z ».
      sleep: { loop: true, still: 0, frames: [
        [700, 'keyboard sleepBody sleepTail sleepHead zA'],
        [700, 'keyboard sleepBodyIn sleepTail sleepHead zB'],
        [700, 'keyboard sleepBodyIn sleepTail sleepHead zC'],
        [700, 'keyboard sleepBody sleepTail sleepHead']
      ]},
      lick: { loop: false, still: 3, frames: [
        [220, 'shadow tailA body head'],
        [180, 'shadow tailA bodyPaw head@0,1 blink@0,1 pawUp@0,3'],
        [200, 'shadow tailA bodyPaw head@0,1 blink@0,1 pawUp@0,1'],
        [220, 'shadow tailB bodyPaw head@0,1 blink@0,1 pawUp tongue'],
        [200, 'shadow tailB bodyPaw head@0,1 blink@0,1 pawUp@0,1'],
        [220, 'shadow tailC bodyPaw head@0,1 blink@0,1 pawUp tongue'],
        [200, 'shadow tailC bodyPaw head@0,1 blink@0,1 pawUp@0,1'],
        [220, 'shadow tailB bodyPaw head@0,1 blink@0,1 pawUp tongue'],
        [200, 'shadow tailB bodyPaw head@0,1 blink@0,1 pawUp@0,3'],
        [300, 'shadow tailA body head blink']
      ]},
      // Assise à côté de sa gamelle (vide !), elle réclame ses croquettes.
      hungry: { loop: false, still: 1, repeat: 2, frames: [
        [320, 'shadow@-3,0 tailA@-3,0 bowl body@-3,0 head@-3,0 eyesUp@-3,0'],
        [380, 'shadow@-3,0 tailB@-3,0 bowl body@-3,0 head@-3,-1 eyesUp@-3,-1 mouthMeow@-3,-1'],
        [300, 'shadow@-3,0 tailC@-3,0 bowl body@-3,0 head@-3,0 eyesUp@-3,0'],
        [380, 'shadow@-3,0 tailB@-3,0 bowl body@-3,0 head@-3,-1 eyesSquint@-3,-1 mouthMeow@-3,-1'],
        [260, 'shadow@-3,0 tailA@-3,0 bowl body@-3,0 head@-3,0 blink@-3,0']
      ]},
      meow: { loop: false, still: 2, frames: [
        [200, 'shadow tailA body head'],
        [160, 'shadow tailB body head@0,-1 eyesUp@0,-1'],
        [520, 'shadow tailC body head@0,-1 eyesSquint@0,-1 mouthMeow@0,-1'],
        [260, 'shadow tailC body head@0,-1 eyesSquint@0,-1 mouthMeow@0,-1 earTwitch@0,-1'],
        [200, 'shadow tailB body head@0,-1 eyesUp@0,-1'],
        [240, 'shadow tailA body head']
      ]}
    }
  };

  /* =======================================================================
     2. LES ICÔNES · 16 × 16
     ======================================================================= */

  var ICONS = {
    size: 16,
    // Palette commune ; une icône peut ajouter/surcharger des couleurs (ex. les humeurs).
    // « token » : dans une page, la teinte f (et ses dérivées F, h) suit la variable CSS indiquée
    // (mode clair / sombre compris). Les valeurs écrites ici servent de repli (export PNG).
    palette: {
      o: '#2B2150', // contour indigo
      w: '#FFFFFF', // reflet
      r: '#F4A3B4', // joues
      m: '#5A2342', // bouche
      k: '#F2709A', // cœur rose / langue
      K: '#C9487A', // cœur, ombre
      d: '#A9DBFF', // goutte
      D: '#6FB8EE', // goutte, ombre
      a: '#86C8F2', // poisson
      A: '#4F8FC9', // poisson, ombre
      h: '#D6EEFF', // reflet clair
      z: '#8B79F2', // « z »
      Z: '#4B3AA8', // « z », ombre
      c: '#C07E3F', // croquette
      C: '#86501F', // croquette, ombre
      y: '#FFD24D', // étoile
      Y: '#FFF4C7', // étoile, reflet
      Q: '#E0A12A', // étoile, ombre
      n: '#8B79F2', // note de musique
      N: '#5A47C2'  // note, ombre
    },
    sprites: {
      'mood-1': { token: '--mood-1', palette: { f: '#9F9BBF', F: '#8580A7', h: '#CAC8DC' }, rows: [ // humeur 1/5 : f = teinte du token, F = ombre, h = reflet
        '................',
        '................',
        '.....oooooo.....',
        '....offffffo.d..',
        '...ohhhhffffdd..',
        '..ofhhhhffffDd..',
        '..ofhhhhfffffo..',
        '.offhhhhffffFFo.',
        '.offoooffoooFFo.',
        '.offfFffffFfFFo.',
        '..offffffffFFo..',
        '..offffoofFFFo..',
        '...offfmoFFFo...',
        '....ofFFFFFo....',
        '.....oooooo.....',
        '................'
      ]},
      'mood-2': { token: '--mood-2', palette: { f: '#7FA8F2', F: '#6D8ACE', h: '#B9CFF8' }, rows: [ // humeur 2/5 : f = teinte du token, F = ombre, h = reflet
        '................',
        '................',
        '.....oooooo.....',
        '....offffffo....',
        '...ohhhhffffo...',
        '..ofFFhhffFFfo..',
        '..ofhhhhfffffo..',
        '.offhohhffofFFo.',
        '.offfoffffofFFo.',
        '.offffffffffFFo.',
        '..offffffffFFo..',
        '..offffoofFFFo..',
        '...offoFFoFFo...',
        '....ofFFFFFo....',
        '.....oooooo.....',
        '................'
      ]},
      'mood-3': { token: '--mood-3', palette: { f: '#8E95F4', F: '#787BD0', h: '#C1C5F9' }, rows: [ // humeur 3/5 : f = teinte du token, F = ombre, h = reflet
        '................',
        '................',
        '.....oooooo.....',
        '....offffffo....',
        '...ohhhhffffo...',
        '..ofhhhhfffffo..',
        '..ofhhhhfffffo..',
        '.offhohhffofFFo.',
        '.offfoffffofFFo.',
        '.offffffffffFFo.',
        '..offffffffFFo..',
        '..offfooooFFFo..',
        '...offfFFFFFo...',
        '....ofFFFFFo....',
        '.....oooooo.....',
        '................'
      ]},
      'mood-4': { token: '--mood-4', palette: { f: '#AE8CF5', F: '#9174D1', h: '#D2C0FA' }, rows: [ // humeur 4/5 : f = teinte du token, F = ombre, h = reflet
        '................',
        '................',
        '.....oooooo.....',
        '....offffffo....',
        '...ohhhhffffo...',
        '..ofhhhhfffffo..',
        '..ofhhhhfffffo..',
        '.offhohhffofFFo.',
        '.offfoffffofFFo.',
        '.offffffffffFFo.',
        '..orfoffffoFro..',
        '..offfooooFFFo..',
        '...offfFFFFFo...',
        '....ofFFFFFo....',
        '.....oooooo.....',
        '................'
      ]},
      'mood-5': { token: '--mood-5', palette: { f: '#7C55EC', F: '#6A4ACA', h: '#B7A2F5' }, rows: [ // humeur 5/5 : f = teinte du token, F = ombre, h = reflet
        '..............y.',
        '.............yYy',
        '.....oooooo...y.',
        '....offffffo....',
        '...ohhhhffffo...',
        '..ofhhhhfffffo..',
        '..ofhhhhfffffo..',
        '.offhohhffofFFo.',
        '.offofoffofoFFo.',
        '.offffffffffFFo.',
        '..orfooooooFro..',
        '..offomkkmoFFo..',
        '...offooooFFo...',
        '....ofFFFFFo....',
        '.....oooooo.....',
        '................'
      ]},
      'heart': { rows: [
        '................',
        '................',
        '..oooo....oooo..',
        '.okkkko..okkkko.',
        'okwwkkkookkkkkko',
        'okwkkkkkkkkkkKko',
        'okkkkkkkkkkkkKko',
        'okkkkkkkkkkkKKko',
        '.okkkkkkkkkkKko.',
        '..okkkkkkkkKko..',
        '...okkkkkkKko...',
        '....okkkkKko....',
        '.....okkKko.....',
        '......okko......',
        '.......oo.......',
        '................'
      ]},
      'fish': { rows: [
        '................',
        '................',
        '................',
        '................',
        '.....oooooo.....',
        '...ooaaaaaaoo.oo',
        '..oahaaaaaaaaoAo',
        '.oaawoaaaaaaaoAo',
        '.oaaaaaaaaaaaAAo',
        '.oAaaaaaaaaaaoAo',
        '..oaaaAAAAaaaoAo',
        '...ooaaaaaaoo.oo',
        '.....oooooo.....',
        '................',
        '................',
        '................'
      ]},
      'zzz': { rows: [
        '.........ooooooo',
        '.........oZzzzzo',
        '.........oooozoo',
        '..........oozoo.',
        '.........oozoooo',
        '...ooooooozzzzzo',
        '...oZzzzzooooooo',
        '...oooozoo......',
        '....oozoo.......',
        '...oozoooo......',
        '...ozzzzzo......',
        'oooooooooo......',
        'Zzzzo...........',
        'oozoo...........',
        'ozooo...........',
        'zzzzo...........'
      ]},
      'kibble': { rows: [
        '................',
        '................',
        '................',
        '................',
        '......ooo.......',
        '.....ohcco......',
        '.....ocCCo......',
        '.....oCCCo......',
        '...ooooooooo....',
        '..ohcco.ohcco...',
        '..ocCCo.ocCCo...',
        '..oCCCo.oCCCo...',
        '...ooo...ooo....',
        '................',
        '................',
        '................'
      ]},
      'star': { rows: [
        '................',
        '.......oo.......',
        '......oyyo......',
        '......oYyo......',
        '.....oyYyyo.....',
        'oooooyyyyyyooooo',
        'oyyYyyyyyyyyyyQo',
        '.oyyyyyyyyyyyQo.',
        '..oyyyyyyyyyQo..',
        '...oyyyyyyyQo...',
        '...oyyyyyyyQo...',
        '..oyyyyooyyyQo..',
        '..oyyyo..oyyQo..',
        '.oyyo......oQQo.',
        '.ooo........ooo.',
        '................'
      ]},
      'note': { rows: [
        '................',
        '.......oo.......',
        '.......ono......',
        '.......onno.....',
        '.......onnno....',
        '.......ono.no...',
        '.......ono..no..',
        '.......ono...o..',
        '.......ono......',
        '.......ono......',
        '...ooooono......',
        '..onnnnnno......',
        '.onwnnnnno......',
        '.onnnnnNNo......',
        '..onnnNNo.......',
        '...ooooo........'
      ]}
    }
  };

  /* =======================================================================
     3. LE MOTEUR
     Rien à modifier ici pour retoucher les dessins.
     ======================================================================= */

  var TRANSPARENT = '.';
  var ERASE = '_';
  var VERSION = '1.0.0';

  function fail(msg) { throw new Error('PixelCast : ' + msg); }

  function parseColor(hex, where) {
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(hex).trim());
    if (!m) fail('couleur invalide « ' + hex + ' » (' + where + ')');
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      h.length === 8 ? parseInt(h.slice(6, 8), 16) : 255
    ];
  }

  function compilePalette(pal, where) {
    var out = {};
    for (var ch in pal) {
      if (!Object.prototype.hasOwnProperty.call(pal, ch)) continue;
      if (ch.length !== 1 || ch === TRANSPARENT || ch === ERASE) {
        fail('clé de palette invalide « ' + ch + ' » (' + where + ') : un seul caractère, ni « . » ni « _ »');
      }
      out[ch] = parseColor(pal[ch], where + ', « ' + ch + ' »');
    }
    return out;
  }

  // Peint une grille dans un tampon RGBA (alpha « source-over »).
  function paint(buf, w, h, rows, pal, x0, y0, where) {
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      var y = y0 + r;
      if (y < 0 || y >= h) continue;
      for (var c = 0; c < row.length; c++) {
        var ch = row.charAt(c);
        if (ch === TRANSPARENT) continue;
        var x = x0 + c;
        if (x < 0 || x >= w) continue;
        var i = (y * w + x) * 4;
        if (ch === ERASE) { buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0; continue; }
        var col = pal[ch];
        if (!col) fail('caractère « ' + ch + ' » absent de la palette (' + where + ', ligne ' + r + ', colonne ' + c + ')');
        var sa = col[3] / 255;
        if (sa >= 1) { buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]; buf[i + 3] = 255; continue; }
        var da = buf[i + 3] / 255;
        var oa = sa + da * (1 - sa);
        if (oa <= 0) continue;
        buf[i] = Math.round((col[0] * sa + buf[i] * da * (1 - sa)) / oa);
        buf[i + 1] = Math.round((col[1] * sa + buf[i + 1] * da * (1 - sa)) / oa);
        buf[i + 2] = Math.round((col[2] * sa + buf[i + 2] * da * (1 - sa)) / oa);
        buf[i + 3] = Math.round(oa * 255);
      }
    }
  }

  // 'hairBack@0,1' -> { name: 'hairBack', dx: 0, dy: 1 }
  function parseLayers(spec) {
    return String(spec).trim().split(/\s+/).map(function (tok) {
      var m = /^([A-Za-z0-9_-]+)(?:@(-?\d+),(-?\d+))?$/.exec(tok);
      if (!m) fail('calque mal écrit « ' + tok + ' » (attendu : nom ou nom@dx,dy)');
      return { name: m[1], dx: m[2] ? +m[2] : 0, dy: m[3] ? +m[3] : 0 };
    });
  }

  var compiled = {};

  function compileCharacter(id) {
    if (compiled[id]) return compiled[id];
    var def = CAST[id];
    if (!def) fail('personnage inconnu « ' + id + ' » (attendus : ' + Object.keys(CAST).join(', ') + ')');
    var pal = compilePalette(def.palette, id);
    var anims = {};
    Object.keys(def.animations).forEach(function (name) {
      var a = def.animations[name];
      if (!a.frames || !a.frames.length) fail(id + '.' + name + ' : aucune image');
      var frames = a.frames.map(function (f, n) {
        var where = id + '.' + name + '[' + n + ']';
        var ms = Math.max(16, Math.round(+f[0] || 0));
        var buf = new Uint8ClampedArray(def.width * def.height * 4);
        parseLayers(f[1]).forEach(function (l) {
          var part = def.parts[l.name];
          if (!part) fail('calque inconnu « ' + l.name + ' » (' + where + ')');
          paint(buf, def.width, def.height, part.rows, pal, (part.x || 0) + l.dx, (part.y || 0) + l.dy, id + '.' + l.name);
        });
        return { duration: ms, data: buf };
      });
      var clamp = function (v) { v = v | 0; return v >= 0 && v < frames.length ? v : -1; };
      anims[name] = {
        name: name,
        loop: !!a.loop,
        next: a.next || 'idle',
        repeat: Math.max(1, a.repeat | 0),
        still: Math.max(0, clamp(a.still)),
        blink: a.blink == null ? -1 : clamp(a.blink),
        frames: frames
      };
    });
    compiled[id] = { id: id, width: def.width, height: def.height, animations: anims, canvases: {} };
    return compiled[id];
  }

  var compiledIcons = {};
  function compileIcon(name) {
    if (compiledIcons[name]) return compiledIcons[name];
    var def = ICONS.sprites[name];
    if (!def) fail('icône inconnue « ' + name + ' » (attendues : ' + Object.keys(ICONS.sprites).join(', ') + ')');
    var palDef = {}, k;
    for (k in ICONS.palette) palDef[k] = ICONS.palette[k];
    if (def.palette) for (k in def.palette) palDef[k] = def.palette[k];
    var n = ICONS.size;
    var buf = new Uint8ClampedArray(n * n * 4);
    paint(buf, n, n, def.rows, compilePalette(palDef, 'icône ' + name), 0, 0, 'icône ' + name);
    compiledIcons[name] = { width: n, height: n, data: buf };
    return compiledIcons[name];
  }

  /* ---------- Rendu canvas ---------- */

  function hasDOM() { return typeof document !== 'undefined' && document.createElement; }

  function bufferToCanvas(w, h, data) {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(w, h);
    img.data.set(data);
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  function frameCanvas(ch, anim, index) {
    var key = anim + '#' + index;
    if (!ch.canvases[key]) {
      ch.canvases[key] = bufferToCanvas(ch.width, ch.height, ch.animations[anim].frames[index].data);
    }
    return ch.canvases[key];
  }

  /* ---------- Liseré (mode sombre) ----------
     Si la variable CSS --pixel-cast-rim vaut une couleur sur le canvas (ou un parent),
     un contour d'un pixel « art » de cette couleur entoure la silhouette : les cheveux
     noirs de Lamia et le pelage noir de Memeow restent lisibles sur un fond sombre.
     pixel-bubble.css l'active en mode sombre ; transparent = pas de liseré. */
  var cssColors = {};
  function cssColor(str) {
    if (cssColors[str]) return cssColors[str];
    var cv = document.createElement('canvas');
    cv.width = cv.height = 1;
    var c = cv.getContext('2d');
    c.fillStyle = 'rgba(0, 0, 0, 0)';
    c.fillStyle = str;
    c.fillRect(0, 0, 1, 1);
    var d = c.getImageData(0, 0, 1, 1).data;
    cssColors[str] = [d[0], d[1], d[2], d[3]];
    return cssColors[str];
  }
  function readRim(el) {
    if (!root.getComputedStyle) return null;
    var v = root.getComputedStyle(el).getPropertyValue('--pixel-cast-rim').trim();
    if (!v || v === 'transparent' || v === 'none') return null;
    var c = cssColor(v);
    return c[3] ? c : null;
  }
  function rimCanvas(ch, anim, index, rgba) {
    var key = anim + '#' + index + '#rim' + rgba.join(',');
    if (ch.canvases[key]) return ch.canvases[key];
    var w = ch.width, h = ch.height, src = ch.animations[anim].frames[index].data;
    var out = new Uint8ClampedArray(src.length);
    var solid = function (x, y) { return x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] >= 160; };
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var i = (y * w + x) * 4;
      if (src[i + 3] < 160 && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) {
        out[i] = rgba[0]; out[i + 1] = rgba[1]; out[i + 2] = rgba[2]; out[i + 3] = rgba[3];
      }
      var sa = src[i + 3] / 255;
      if (sa > 0) {
        var da = out[i + 3] / 255, oa = sa + da * (1 - sa);
        for (var k = 0; k < 3; k++) out[i + k] = Math.round((src[i + k] * sa + out[i + k] * da * (1 - sa)) / oa);
        out[i + 3] = Math.round(oa * 255);
      }
    }
    ch.canvases[key] = bufferToCanvas(w, h, out);
    return ch.canvases[key];
  }

  // Redessine toutes les instances quand le thème change (data-theme ou thème système).
  var live = [];
  var themeWatch = null;
  function watchTheme(redraw) {
    live.push(redraw);
    if (themeWatch) return;
    var all = function () { live.slice().forEach(function (fn) { fn(); }); };
    var mo = typeof MutationObserver === 'function' ? new MutationObserver(all) : null;
    if (mo) mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    var off = listen(mediaQuery('(prefers-color-scheme: dark)'), all);
    themeWatch = function () { if (mo) mo.disconnect(); off(); };
  }
  function unwatchTheme(redraw) {
    var i = live.indexOf(redraw);
    if (i >= 0) live.splice(i, 1);
    if (!live.length && themeWatch) { themeWatch(); themeWatch = null; }
  }

  function toScale(v, def) {
    var n = Math.round(+v);
    return isFinite(n) && n >= 1 ? Math.min(n, 64) : def;
  }

  function setPixelated(el) {
    el.style.imageRendering = 'pixelated';
    if (el.style.imageRendering !== 'pixelated') el.style.imageRendering = 'crisp-edges';
  }

  function mediaQuery(q) {
    return root.matchMedia ? root.matchMedia(q) : null;
  }
  function listen(mq, fn) {
    if (!mq) return function () {};
    if (mq.addEventListener) { mq.addEventListener('change', fn); return function () { mq.removeEventListener('change', fn); }; }
    if (mq.addListener) { mq.addListener(fn); return function () { mq.removeListener(fn); }; }
    return function () {};
  }

  var LABELS = { lamia: 'Lamia', memeow: 'Memeow, la chatte de Lamia' };
  var mounted = typeof WeakMap === 'function' ? new WeakMap() : null;

  function mount(canvas, id, options) {
    if (!hasDOM()) fail('mount() a besoin d’un navigateur');
    if (!canvas || typeof canvas.getContext !== 'function') fail('mount() attend un élément <canvas>');
    var ch = compileCharacter(id);
    var opts = options || {};
    var scale = toScale(opts.scale, 4);
    var flip = !!opts.flip;

    var previous = mounted && mounted.get(canvas);
    if (previous) previous.destroy();

    var ctx = canvas.getContext('2d');
    var state = {
      anim: ch.animations[opts.animation] ? opts.animation : 'idle',
      index: 0,
      cycle: 0,
      playing: false,
      timer: null,
      destroyed: false,
      k: 1,
      dpr: 1
    };
    var reduceMQ = mediaQuery('(prefers-reduced-motion: reduce)');
    var offReduce = function () {};
    var offDpr = function () {};

    if (!canvas.hasAttribute('role')) canvas.setAttribute('role', 'img');
    if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', LABELS[id] || id);

    function reduced() { return !!(reduceMQ && reduceMQ.matches); }

    function resize() {
      var dpr = root.devicePixelRatio || 1;
      // Un pixel « art » = un nombre entier de pixels physiques : le rendu reste net,
      // même avec un zoom Windows à 125 % ou 150 %.
      var k = Math.max(1, Math.round(scale * dpr));
      state.dpr = dpr; state.k = k;
      canvas.width = ch.width * k;
      canvas.height = ch.height * k;
      canvas.style.width = (ch.width * k / dpr) + 'px';
      canvas.style.height = (ch.height * k / dpr) + 'px';
      setPixelated(canvas);
      offDpr();
      offDpr = listen(mediaQuery('(resolution: ' + dpr + 'dppx)'), function () {
        if (!state.destroyed) { resize(); draw(); }
      });
    }

    function draw() {
      if (state.destroyed) return;
      var a = ch.animations[state.anim];
      var index = Math.min(state.index, a.frames.length - 1);
      var rim = readRim(canvas);
      var src = rim ? rimCanvas(ch, state.anim, index, rim) : frameCanvas(ch, state.anim, index);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (flip) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(src, 0, 0, ch.width, ch.height, 0, 0, ch.width * state.k, ch.height * state.k);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function clearTimer() {
      if (state.timer !== null) { clearTimeout(state.timer); state.timer = null; }
    }

    function after(ms, fn) {
      clearTimer();
      state.timer = setTimeout(function () { state.timer = null; if (!state.destroyed) fn(); }, ms);
    }

    function totalDuration(a) {
      var t = 0;
      for (var i = 0; i < a.frames.length; i++) t += a.frames[i].duration;
      return t * a.repeat;
    }

    function switchTo(name) {
      state.anim = ch.animations[name] ? name : 'idle';
      state.index = 0;
      state.cycle = 0;
      run();
    }

    // Mouvement réduit : une image fixe (la pose « still »), avec au plus un clignement rare.
    function runReduced() {
      var a = ch.animations[state.anim];
      state.index = a.still;
      draw();
      if (!a.loop) {
        after(Math.max(1200, totalDuration(a)), function () { switchTo(a.next); });
      } else if (a.blink >= 0) {
        after(6000 + Math.random() * 4000, function () {
          state.index = a.blink; draw();
          after(a.frames[a.blink].duration, runReduced);
        });
      }
    }

    function step() {
      var a = ch.animations[state.anim];
      draw();
      after(a.frames[state.index].duration, function () {
        state.index++;
        if (state.index >= a.frames.length) {
          state.index = 0;
          if (!a.loop) {
            state.cycle++;
            if (state.cycle >= a.repeat) { switchTo(a.next); return; }
          }
        }
        step();
      });
    }

    function run() {
      clearTimer();
      if (!state.playing) { draw(); return; }
      if (reduced()) runReduced(); else step();
    }

    var ctrl = {
      play: function (name) {
        if (state.destroyed) return ctrl;
        if (name != null && !ch.animations[name]) {
          if (typeof console !== 'undefined') console.warn('PixelCast : animation inconnue « ' + name + ' » pour ' + id + ' (disponibles : ' + Object.keys(ch.animations).join(', ') + ')');
          return ctrl;
        }
        var wasPlaying = state.playing;
        state.playing = true;
        if (name == null) { run(); return ctrl; }
        // Rejouer l’animation en boucle déjà en cours ne la fait pas sauter.
        if (name === state.anim && ch.animations[name].loop && wasPlaying) return ctrl;
        switchTo(name);
        return ctrl;
      },
      stop: function () {
        if (state.destroyed) return ctrl;
        state.playing = false;
        clearTimer();
        return ctrl;
      },
      destroy: function () {
        if (state.destroyed) return;
        state.playing = false;
        clearTimer();
        offReduce(); offDpr();
        unwatchTheme(draw);
        state.destroyed = true;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (mounted && mounted.get(canvas) === ctrl) mounted['delete'](canvas);
      }
    };

    offReduce = listen(reduceMQ, function () { if (!state.destroyed && state.playing) run(); });
    if (mounted) mounted.set(canvas, ctrl);
    watchTheme(draw);
    resize();
    state.playing = true;
    run();
    return ctrl;
  }

  function size(id) {
    var def = CAST[id];
    if (!def) fail('personnage inconnu « ' + id + ' » (attendus : ' + Object.keys(CAST).join(', ') + ')');
    return { width: def.width, height: def.height };
  }

  function icon(name, scale) {
    if (!hasDOM()) fail('icon() a besoin d’un navigateur');
    var ic = compileIcon(name);
    var s = toScale(scale, 1);
    var src = bufferToCanvas(ic.width, ic.height, ic.data);
    if (s === 1) { setPixelated(src); return src; }
    var cv = document.createElement('canvas');
    cv.width = ic.width * s; cv.height = ic.height * s;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 0, cv.width, cv.height);
    setPixelated(cv);
    return cv;
  }

  function iconDataURL(name, scale) {
    return icon(name, scale).toDataURL('image/png');
  }

  var animations = {};
  Object.keys(CAST).forEach(function (id) {
    animations[id] = Object.freeze(Object.keys(CAST[id].animations));
  });

  var PixelCast = {
    mount: mount,
    animations: Object.freeze(animations),
    size: size,
    icon: icon,
    iconDataURL: iconDataURL
  };

  // Outils internes (export PNG, planche de présentation). Hors contrat : non énumérable.
  Object.defineProperty(PixelCast, '_dev', {
    enumerable: false,
    value: Object.freeze({
      version: VERSION,
      cast: CAST,
      icons: ICONS,
      iconNames: function () { return Object.keys(ICONS.sprites); },
      animation: function (id, name) {
        var a = compileCharacter(id).animations[name];
        if (!a) fail('animation inconnue « ' + name + ' » pour ' + id);
        return { loop: a.loop, next: a.next, repeat: a.repeat, still: a.still, frames: a.frames };
      },
      iconPixels: function (name) { return compileIcon(name); }
    })
  });

  root.PixelCast = Object.freeze(PixelCast);
})(typeof window !== 'undefined' ? window : this);
