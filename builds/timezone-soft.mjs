const BASE = 36;
const seq = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const cache = seq.split('').reduce(function (h, c, i) {
  h[c] = i;
  return h
}, {});

// 0, 1, 2, ..., A, B, C, ..., 00, 01, ... AA, AB, AC, ..., AAA, AAB, ...
const toAlphaCode = function (n) {
  if (seq[n] !== undefined) {
    return seq[n]
  }
  let places = 1;
  let range = BASE;
  let s = '';
  for (; n >= range; n -= range, places++, range *= BASE) {}
  while (places--) {
    const d = n % BASE;
    s = String.fromCharCode((d < 10 ? 48 : 55) + d) + s;
    n = (n - d) / BASE;
  }
  return s
};

const fromAlphaCode = function (s) {
  if (cache[s] !== undefined) {
    return cache[s]
  }
  let n = 0;
  let places = 1;
  let range = BASE;
  let pow = 1;
  for (; places < s.length; n += range, places++, range *= BASE) {}
  for (let i = s.length - 1; i >= 0; i--, pow *= BASE) {
    let d = s.charCodeAt(i) - 48;
    if (d > 10) {
      d -= 7;
    }
    n += d * pow;
  }
  return n
};

var encoding = {
  toAlphaCode,
  fromAlphaCode
};

const symbols = function (t) {
  //... process these lines
  const reSymbol = new RegExp('([0-9A-Z]+):([0-9A-Z]+)');
  for (let i = 0; i < t.nodes.length; i++) {
    const m = reSymbol.exec(t.nodes[i]);
    if (!m) {
      t.symCount = i;
      break
    }
    t.syms[encoding.fromAlphaCode(m[1])] = encoding.fromAlphaCode(m[2]);
  }
  //remove from main node list
  t.nodes = t.nodes.slice(t.symCount, t.nodes.length);
};
var parseSymbols = symbols;

// References are either absolute (symbol) or relative (1 - based)
const indexFromRef = function (trie, ref, index) {
  const dnode = encoding.fromAlphaCode(ref);
  if (dnode < trie.symCount) {
    return trie.syms[dnode]
  }
  return index + dnode + 1 - trie.symCount
};

const toArray = function (trie) {
  const all = [];
  const crawl = (index, pref) => {
    let node = trie.nodes[index];
    if (node[0] === '!') {
      all.push(pref);
      node = node.slice(1); //ok, we tried. remove it.
    }
    const matches = node.split(/([A-Z0-9,]+)/g);
    for (let i = 0; i < matches.length; i += 2) {
      const str = matches[i];
      const ref = matches[i + 1];
      if (!str) {
        continue
      }
      const have = pref + str;
      //branch's end
      if (ref === ',' || ref === undefined) {
        all.push(have);
        continue
      }
      const newIndex = indexFromRef(trie, ref, index);
      crawl(newIndex, have);
    }
  };
  crawl(0, '');
  return all
};

//PackedTrie - Trie traversal of the Trie packed-string representation.
const unpack$2 = function (str) {
  const trie = {
    nodes: str.split(';'),
    syms: [],
    symCount: 0
  };
  //process symbols, if they have them
  if (str.match(':')) {
    parseSymbols(trie);
  }
  return toArray(trie)
};

var traverse = unpack$2;

const unpack = function (str) {
  if (!str) {
    return {}
  }
  //turn the weird string into a key-value object again
  const obj = str.split('|').reduce((h, s) => {
    const arr = s.split('¦');
    h[arr[0]] = arr[1];
    return h
  }, {});
  const all = {};
  Object.keys(obj).forEach(function (cat) {
    const arr = traverse(obj[cat]);
    //special case, for botched-boolean
    if (cat === 'true') {
      cat = true;
    }
    for (let i = 0; i < arr.length; i++) {
      const k = arr[i];
      if (all.hasOwnProperty(k) === true) {
        if (Array.isArray(all[k]) === false) {
          all[k] = [all[k], cat];
        } else {
          all[k].push(cat);
        }
      } else {
        all[k] = cat;
      }
    }
  });
  return all
};

var unpack$1 = unpack;

// these are the folk heuristics that timezones use to set their dst change dates
// for example, the US changes:
// the second Sunday of March -> first Sunday of November
// http://www.webexhibits.org/daylightsaving/g.html
let patterns = {
  usa: '2nd-sun-mar-2h|1st-sun-nov-2h',// (From 1987 to 2006)
  // mexico
  mex: '1st-sun-apr-2h|last-sun-oct-2h',

  // European Union zone
  eu0: 'last-sun-mar-0h|last-sun-oct-1h',
  eu1: 'last-sun-mar-1h|last-sun-oct-2h',
  eu2: 'last-sun-mar-2h|last-sun-oct-3h',
  eu3: 'last-sun-mar-3h|last-sun-oct-4h',
  //greenland
  green: 'last-sat-mar-22h|last-sat-oct-23h',

  // australia
  aus: '1st-sun-apr-3h|1st-sun-oct-2h',
  //lord howe australia
  lhow: '1st-sun-apr-2h|1st-sun-oct-2h',
  // new zealand
  chat: '1st-sun-apr-3h|last-sun-sep-2h', //technically 3:45h -> 2:45h
  // new Zealand, antarctica 
  nz: '1st-sun-apr-3h|last-sun-sep-2h',
  // casey - antarctica
  ant: '2nd-sun-mar-0h|1st-sun-oct-0h',
  // troll - antarctica
  troll: '3rd-sun-mar-1h|last-sun-oct-3h',

  //jordan
  jord: 'last-fri-feb-0h|last-fri-oct-1h',
  // lebanon
  leb: 'last-sun-mar-0h|last-sun-oct-0h',
  // syria
  syr: 'last-fri-mar-0h|last-fri-oct-0h',
  //israel
  // Start: Last Friday before April 2 -> The Sunday between Rosh Hashana and Yom Kippur
  isr: 'last-fri-mar-2h|last-sun-oct-2h',
  //palestine
  pal: 'last-sun-mar-0h|last-fri-oct-1h',

  // el aaiun
  //this one seems to be on arabic calendar?
  saha: 'last-sun-mar-3h|1st-sun-may-2h',

  // paraguay
  par: 'last-sun-mar-0h|1st-sun-oct-0h',
  //cuba
  cuba: '2nd-sun-mar-0h|1st-sun-nov-1h',
  //chile
  chile: '1st-sun-apr-0h|1st-sun-sep-0h',
  //easter island
  east: '1st-sat-apr-22h|1st-sat-sep-22h',
  //fiji
  fiji: '3rd-sun-jan-3h|2nd-sun-nov-2h',
};

var dstPatterns = patterns;

var pcked = {"Africa":{"Abidjan":["true¦a5bouake,coordinated universal4daloa,g1san ped0utc,yamoussouk0zulu;ro;h0mt,reenwich mean2;!a0;!na; ti4;b5frica1tlantic/st0;;!/0;accra,ba1conakry,dakar,freetown,lo0nouakchott,ouagadougou,timbuktu;me;mako,njul;idjan,obo"],"Algiers":["true¦a7b5c3dz2oran,s1t0;ebessa,iaret;etif,idi bel abbes;!a;e0hlef,onstantine;ntral european standard time,t;a0iskra,lida,oumerdas;b ezzouar,tna;frica,lg0nnaba;eria,iers"],"Bissau":["true¦africa,b2coordinated universal1g0utc,zulu;mt,nb,reenwich mean0uinea b1w; time;issau"],"Cairo":["true¦a6bani suwayf,c5damanhur,e2giza,halw8i1kafr ad dawwar,luxor,new c5port said,qina,s0tanta,zagazig;hibin al kawm,ohag,uez;dku,smail8;astern european standard time,et,g0;!y0;!pt;airo;frica,l2s0;w0yut;an; 1exandr0;ia;fayyum,m0;a0inya;hallah al kubra,nsurah"],"Casablanca":["true¦aDcasablanEfCkenitBm5oujda angad,rabat,sa3t1we0;stern european 7t;angier,e0;ma8touan;fi,le0;! al jadida;a3ekn6o0;hammedia,rocco0;! 0;standard time;!r0;!rakesh;ra;es;fri0gadir,l hoceima;ca","saha"],"Ceuta":["true¦africa,brussels,c1europe central,madrid,paris,romance0;! s4;e0openhagen;ntral european 1t,uta0;!melilla;s0t1;tandard t0;ime","eu2"],"El_Aaiun":["true¦afri6casablan6e4laayoune,morocco2we0;stern 0t;european 1sahara;! 0;standard time;h,l0sh;;ca","saha"],"Johannesburg":["true¦africaLbHcDdCeast londEharare,johannesKkAnewcastGp9r8s3tembisa,uitenhage,v2w1za0;!f;elkom,itbank;anderbijlpark,ereeniging;ast,o0prings;uth africa0weto;! 0;standard t0t0;ime;andBichards bay,oodepoort;aarl,ietermaritzAort elizabeth,retoria;lerk0ruger0;sdorp;iepsloot,urb5;a1enturi0;on;pe town,rletonvil0;le;enoni,loemfontein,o1rakp0;an;ks0tshabelo;burg;! southern,/m0;aseru,babane"],"Juba":["true¦africa,c2juba,s0winejok;outh sudan,s0;!d;at,entral africa time"],"Khartoum":["true¦a8c6el 5k3ny4omdurm2port sud2s0wad medani;d0inga,ud1;!n;an;ass0hartoum,osti;ala;dae3fasher,obeid;at,entral africa0;! time;d damaz0frica,l qadarif;in"],"Lagos":["true¦aYbWcUeTgSiOjNkaLlJmGnnewi,oDport harcourt,sCuAw0zarB; central africa6a5est0; 0ern1;africa1central0; africa;! 0;s2t3;rBst,t;! s0;tandard t0;ime;gep,muah0yo;ia;a7hagamu,okoto;kDn1w0yo;er3o;do,itsha;a0in5ubi;idugu0kurdi;ri;agos,ek0;ki;du0no,tsi0;na;imeLos;badan,jebu ode,k1l0seHwo;a orangun,eDor7;eHi8ot ekp0;ene;ombe,usau;bute ikorodu,fon alaaye,nugu;alabar,d,hakwama,o0;d,ngo;auchi,en0;in;b8do7frica1ku0tani;re;! western,/0;b2douala,kinsha1l0malabo,niamey,porto-novo;ibre2uanda;sa;angui,razza0;ville; ekiti;a,eoku1u0;ja;ta"],"Maputo":["true¦africaAbeiFc7ma5na2quelimaDwindhoek,z0;imbabwe,w0;!e;ca3m0;ibia0pu2;! standard 4;puto,to0;la;at,entral africa0himoio;! 0;time;! central,/0;b2gaboro1hara4kigali,lu0;bumbashi,saka;ne;lanty1ujumbu0;ra;re"],"Monrovia":["true¦africa,coordinated universal3g2l0monrov1utc,zulu;br,iber0r;ia;mt,reenwich mean0; time"],"Nairobi":["true¦africa9e4indian/2kisumu,m1na0thika,yt;irobi,kuru;a1ombasa,yt;antananarivo,comoro,ma0;yotte; africa standard 3a0ldoret;st0t; africa0ern africa;! 0;time;! eastern,/0;a1d0kampala,mogadishu;ar3jibouti;ddis2sm0;a0e0;ra;"],"Ndjamena":["true¦africaCchad,nAt9w0; central africa5a4est0; 0ern1;africa 1central0; africa;s2t3;st,t;! s0;tandard t0;ime;cd,d;'d0d0;jamena;! western"],"Sao_Tome":["true¦africa,coordinated universal3g2s0utc,zulu;ao to3t0;!p;mt,reenwich mean0; ti0;me"],"Tripoli":["true¦a4benghazi,e3l1misrat5t0zawi2;arhuna,ripoli;by,ib0y;ya;astern european standard time,et;frica,l khums,z zawiy0;ah"],"Tunis":["true¦africa,ce3sfax,t0;n,un0;!is0;!ia;ntral european standard time,t"],"Windhoek":["true¦africa3c2na0windhoek;!m0;!ibia;at,entral africa time;! central"]},"America":{"Adak":["true¦a1h0nwt,us/aleutian;awaii s4st;dak,leutian1merica0;!/atka;! 0;islands,s0;tandard time","usa"],"Anchorage":["true¦a0us/alaska;h6k5laska0merica,nchorage;! 1n0;! s1;s0t1;tandard t0;ime;dt,st,t;dt,st","usa"],"Araguaina":["true¦a6br1e0palmas,tocantins; south america s3ast south am6;asilia0t;! 0;s0t1;tandard t0;ime;m0raguaina;erica"],"Argentina/Buenos_Aires":["true¦a0b5;merica2r0;!g0;!e4;!/0;arge2b0;uenos0;;ntina"],"Argentina/Catamarca":["true¦a0c3;merica0rgentina;!/0;argentina/comodrivadavia,c0;atamarca"],"Argentina/Cordoba":["true¦a0c3;merica0rgentina;!/0;c0rosario;ordoba"],"Argentina/Jujuy":["true¦a0j2;merica0rgentina;!/j0;ujuy"],"Argentina/La_Rioja":["true¦a2b1city of b1la0;;uenos aires;merica,r0;gentina0st,t;! 0;standard t0t0;ime"],"Argentina/Mendoza":["true¦a0m2;merica0rgentina;!/m0;endoza"],"Argentina/Rio_Gallegos":["true¦a2b1city of b1rio0;;uenos aires;merica,r0;gentina0st,t;! 0;standard t0t0;ime"],"Argentina/Salta":["true¦a1b0city of b0salta;uenos aires;merica,r0;gentina0st,t;! 0;standard t0t0;ime"],"Argentina/San_Juan":["true¦a2b1city of b1san0;;uenos aires;merica,r0;gentina0st,t;! 0;standard t0t0;ime"],"Argentina/San_Luis":["true¦a2b1city of b1san0;;uenos aires;merica,r0;gentina0st,t;! 0;standard t0t0;ime"],"Argentina/Tucuman":["true¦a1b0city of b0tucuman;uenos aires;merica,r0;gentina0st,t;! 0;standard t0t0;ime"],"Argentina/Ushuaia":["true¦a1b0city of b0ushuaia;uenos aires;merica,r0;gentina0st,t;! 0;standard t0t0;ime"],"Asuncion":["true¦a6c5p0san lorenzo;araguay1ry,y0;!st,t;! 0;standard t0t0;ime;apiata,iudad del este;merica,suncion","par"],"Bahia":["true¦a8b2camacari,e1feira de santa0itabu0salvador,vitoria da conquista;na; south america s4ast south a6;ahia,r0;asilia0t;! 0;s0t1;tandard t0;ime;merica"],"Bahia_Banderas":["true¦america,bah6c1guadalajara,m0;exico city,onterrey;entral 0st;mexic0standard 2;an,o0;! 0;time;ia0ía de banderas;","mex"],"Barbados":["true¦a1b0;arbados,b,rb;merica,st,tlantic standard time"],"Belem":["true¦a8b2e1macapa,par0;auapebas,á east amapá; south america s4ast south am7;elem,r0;asilia0t;! 0;s0t1;tandard t0;ime;m0nanindeua;erica"],"Belize":["true¦america,b1c0;entral standard time,st;elize,lz,z"],"Boa_Vista":["true¦am3boa vista,c0roraima;entral brazil0uiaba;!ian0;! s3;azon0erica,t;! 0;s0t1;tandard t0;ime"],"Bogota":["true¦aJbEc7dosquebradas,floridablanLi6m5neiva,p3s1v0;alledupar,illavicencio;anta marFincelejo,o0;acha,ledad;a0ereiCopayan;lmiBsto;anizales,edellin,onterE;bague,taguei;a5o0ucu9;!l0st,t;!ombia0;! 0;standard t0t0;ime;li,rtagena;arran3ello,ogo2u0;caramanga,enaventu0;ra;ta;cabermeja,quilla;meri1rmen0;ia;ca"],"Boise":["true¦america4boise,m0;ountain0pt,st,t;! 0;id,standard t0t0;ime;! mountain","usa"],"Cambridge_Bay":["true¦america5cambridge4m0;ddt,ountain0st,t;! 0;standard t0t0;ime;;! mountain","usa"],"Campo_Grande":["true¦am0campo grande,mato grosso do sul;azon standard time,erica,t"],"Cancun":["true¦america,cancun,e0quintana roo;astern standard time,st"],"Caracas":["true¦aKbarJcDguaBm8p7san6turmeFv0;alencia,e0;!n0t;!ezuela0;! 0n;standard t0t0;ime; cristobal,ta teresa del tuy;eta4uerto la cruz;a0ucumpiz;raca0turin;ibo,y;ren9ti0;re;a4iudad 2o1u0;a,m2;ro;bolivar,guay0;ana;bim2rac2;in1quisimeto,uta;lto barin0merica;as"],"Cayenne":["true¦america,cayenne,french guiana2g0;f0uf;!t;! time"],"Chicago":["true¦aXbUcQdPfort worth,gOhNiLk01lImBn7o6plano,s3t1us/05wi0;chiFsconsX;ex0ulsa;!as;a0hreveport,ou4t 1;int 0n antonio;louGpaul;klahoZmaha,verland park;ashNe1or0;th dako7;braska,w 0;orleans,south me6;adisOe5i1o0;biJntgomery;lwaukee,nne1ss0;issippi,ouri;apol6so0;ta;mph4;aredo,i0ouisiana,ubb1;ncoln,ttle r0;ock;llino0owa,rving;is;oustCunts7;arland,rand prairie;allCes moines;dt,entral0hicago,orpus christi,st,t;! 0;standard t0t0;ime;aton rouge,rowns0;vil0;le;laba8m5r1ust0;in;k1lingt0;on;ans0;as;arillo,erica0;! 0;central;ma","usa"],"Chihuahua":["true¦america,chihuahua,h5la paz,m0;azatlan,exic1ountain 0;mexico,standard time (mexico);an pacific 0o pacific;standard t0t0;ime;np0p0;mx","mex"],"Costa_Rica":["true¦ame2c0sjmt;entral standard time,osta 1r0st;!i;rica"],"Cuiaba":["true¦am0cuiaba,mato grosso,varzea grande;azon standard time,erica,t"],"Danmarkshavn":["true¦america,coordinated universal1danmarkshavn,g0utc,zulu;mt,reenwich mean0; time"],"Dawson":["true¦america,dawson,m2y0;d0pt,wt;dt,t;ountain standard time,st"],"Dawson_Creek":["true¦america,dawson2m1p0;pt,wt;ountain standard time,st,t;"],"Denver":["true¦a4colorado springs,denver,el paso,m0navajo,salt lake,us/6;dt,ountain0st,t;! 0;standard t0t0;ime;lbuquerque,merica0urora;! 0/shiprock;mountain","usa"],"Detroit":["true¦america4detroit,e0grand rapids,us/michigan;astern0pt,st,t,wt;! 0;mi,standard t0t0;ime;! eastern","usa"],"Edmonton":["true¦a5ca4edmonton,m0;ountain0st,t;! 0;standard t0t0;ime;lgary,nada/2;lberta,merica0;! 0;mountain","usa"],"Eirunepe":["true¦a0eirunepe;c1m0;azonas west,erica;re0t;! 0;standard t0t0;ime"],"El_Salvador":["true¦america,c2el1s0;an0lv,oyapango,v; salvador;entral standard time,st"],"Fort_Nelson":["true¦america,fort1m0;ountain standard time,st,t;"],"Fortaleza":["true¦aAbr5ca4e3fortaleza,imperatriz,j2m0natal,sao luis,teresina;a0ossoro;picernpb,racanau;oao pessoa,uazeiro do norte; south america s4ast south a6;mpina grande,ucaia;asilia0t;! 0;s0t1;tandard t0;ime;merica"],"Glace_Bay":["true¦a1cape breton,glace0;;merica,st,t0;!lantic0;! 0;standard t0t0;ime","usa"],"Goose_Bay":["true¦a1goose0labrador,npt;;merica,st,t0;!lantic0;! 0;standard t0t0;ime","usa"],"Grand_Turk":["true¦america7e3grand2kmt,t0;c0urks and caicos;!a;;astern0st,t;! 0;standard t0t0;ime;! eastern","usa"],"Guatemala":["true¦america,c2g0mixco,villa nueva;t0uatemala;!m;entral standard time,st"],"Guayaquil":["true¦ameri6cuen6ec2guayaquil,ma1q0santo domingo de los colorados;mt,uito;chala,nta;!t,u0;!ador0;! 0;mainland,time;ca"],"Guyana":["true¦america,g0;eorgetown,uy1y0;!t;!ana0;! time"],"Halifax":["true¦a2canada/atlantic,halifax,n1p0;ei,rince edward island;ew brunswick,ova scotia;dt,merica,st,t0;!lantic0;! 0;ns,standard t0t0;ime","usa"],"Havana":["true¦aDbAc2diez de octubre,guantanCh1las tunas,pinar del rio,sant0;a clara,iago de cuba;avana,cu,ncu,olguin;amaguey,i5u0;!b0;!a0;! 0;standard t0t0;ime;e0udad camilo cie0;nfueg1;ay1oyer0;os;amo;merica,rroyo naranjo","cuba"],"Hermosillo":["true¦america,ciudad obregon,h0mexican pacific standard time,nogales,sonora;ermosillo,npmx"],"Indiana/Indianapolis":["true¦america2crawford,dadukmn,eastern in,i4p0star1us/east-indiana;erry,i0ulaski;ke;!/0;fort2i0;ndiana0;!polis;","usa"],"Indiana/Knox":["true¦america1c0indiana,knox,us/indiana-starke;entral standard time,st;!/knox0;","usa"],"Indiana/Marengo":["true¦america,e0indiana,marengo;astern standard time,st","usa"],"Indiana/Petersburg":["true¦america,e0indiana,petersburg;astern standard time,st","usa"],"Indiana/Tell_City":["true¦america,c1indiana,tell0;;entral standard time,st","usa"],"Indiana/Vevay":["true¦america,e0indiana,vevay;astern standard time,st","usa"],"Indiana/Vincennes":["true¦america,e0indiana,vincennes;astern standard time,st","usa"],"Indiana/Winamac":["true¦america,e0indiana,winamac;astern standard time,st","usa"],"Inuvik":["true¦america4inuvik,m0pddt;ountain0st,t;! 0;standard t0t0;ime;! mountain","usa"],"Iqaluit":["true¦america4e0iqaluit;astern0ddt,st,t;! 0;standard t0t0;ime;! eastern","usa"],"Jamaica":["true¦amer4e3j1k0new k0;ingston;am0m;!a1;astern standard time,st;ica"],"Juneau":["true¦a0juneau;k5laska0merica;! 1n0;! s1;juneau area,s0t1;tandard t0;ime;st,t","usa"],"Kentucky/Louisville":["true¦america0eastern 4k3l2wayne;!/0;k1l0;ouisville;entuc0;ky","usa"],"Kentucky/Monticello":["true¦america,e0kentucky,monticello;astern standard time,st","usa"],"La_Paz":["true¦america,bo1cochabamba,la paz,oruro,s0;anta cruz de la sierra,ucre;!l0t;!ivia0;! time"],"Lima":["true¦aDc9huancCi8juliaFlima,p2sant1t0;acna,rujillo;a anita   los ficus,iago de sur8;e0iura,ucallB;!r0t;!u0;! 0;standard t0t0;ime;ca,quitos;allao,hi1us0;co;cl0mbote;ayo;meri1requi0;pa;ca"],"Los_Angeles":["true¦a02ba00cXfTgarden grove,hQirviPlLmoInHoEp8r7s0tacoma,us/04washington state;a1eattle,f,p0tocktRunrise manor;okaNringH;cramenHn0; 1ta 0;aRclariT;bernardiPdiego,fran0jo4;!cisco;ancho cucamonga,eNiver7;a0dt,ort7st,t;cific1radi0;se;! 0;standard t0t0;ime;ak1cean0regDxnard;side;land;evada,orth las6;des1reno0; valley;to;a1o0;ng4s angeles;!s0; vegas;ne;enders1untington0; beach;on;onta2re0;mont,s0;no;na;ali1hula vis0;ta;!f1;ja calif0kersfield;ornia;merica0naheim;! 0;pacific","usa"],"Maceio":["true¦a6br1e0maceio; south america s3ast south am6;asilia0t;! 0;s0t1;tandard t0;ime;lagoassergipe,m0racaju;erica"],"Managua":["true¦america,c3man2ni0;!c0;!ar0;agua;entral standard time,st"],"Manaus":["true¦am3brazil/we5c0manaus;entral brazil0uiaba;!ian0;! s4;azon0erica,t;! 1as ea0;st;s0t1;tandard t0;ime"],"Martinique":["true¦a1ffmt,m0;artinique,q,tq;merica,st,tlantic standard time"],"Matamoros":["true¦america5c1heroica m0m0nuevo laredo,reynosa;atamoros;entral0st,t;! 0;standard t0t0;ime;! central","usa"],"Mazatlan":["true¦america,cAh8l7m0tep4;azatlAexic1ountain 0;mexico,standard time (mexico);an pacific 2o0; pacif0/bajasur;ic;standard t0t0;ime;a paz,os mochis;np0p0;mx;hihuahua,uliac0;an","mex"],"Menominee":["true¦america4c0menominee;entral0st,t;! 0;standard t0t0;ime;! central","usa"],"Merida":["true¦america,c2guadalajara,m0;e0onterrey;rida,xico city;ampeche4entral 0st;mexic0standard 2;an,o0;! 0;time;!yucatán","mex"],"Metlakatla":["true¦a0metlakatla;k5laska0merica;! 1n0;! s1;annette island,s0t1;tandard t0;ime;st,t","usa"],"Mexico_City":["true¦a0Jb0HcXduran0Aecatepec de morel08guShRiPjalis0Lleon de los alda04mInHoGpEqDs9t4uruap02v2x1yucat02za0;catec0Apop01;alapa de enriqu0Oi0Jochimil0J;e0illahermosa;nustiano carranza,racruz;a3e7la1o0uxt01;lu0Gna00;huac,l0quepaque,xcaZ;nepantYpU;bas0Cmaulip02pachuX;an0oledad de graciano sanch0G; luis potosi,t0;a maria chimal0iago de q1;huO;ueretaF;achuca de soHoza rica de7ue0;bQrto vallar02;axa05jo de agua;aucalpan06icolas romeBuevo le05;agdalena contrerSex4i2o0x;nterrey,rel0;ia,os;choFguel0; h4;!ico0;! city,/general;rap5xtapaluWzta0;cTpalapa;idalI;a1erre0stavo adolfo made0;ro;dalajara,naj0;ua0;to;ampeche,eEhiBiudad 9o2st,u0wt;au0ernavaN;htemoc,titlan izcalli;a4l2yo0;ac0;an;i0onia del valle;ma;cEhui0tzacoalc2;la;lopez mate0nezahualcoyotl;os;ap1lpancin0;go;as;laya,ntral 0;mexic0standard 2;an,o0;! 0;time;enito7uenavis0;ta;capulco4guascalientes,lvaro obreg3meri2zcapotz0;al0;co;ca;on; de0; juar0;ez","mex"],"Miquelon":["true¦america,hBmAp8s0;aint pierre2pm,t pierre 0;& miquelon 0a5;s2t3;! 0;a2s0;tandard t0;ime;nd1;ierre0m; m0;iquelon;npm,pm","usa"],"Moncton":["true¦a0moncton,new brunswick;merica,st,t0;!lantic0;! 0;standard t0t0;ime","usa"],"Monterrey":["true¦ameriDc7g5m3sa1t0victoria de durango;ampico,orreon;ltillo,n0; nicolas de los garza,ta catarina;exico city,on0;clova,terrey;omez palacio,uadal0;ajara,upe;entral 1iudad 0st;apoda4general escobedo,madero,victoria;mexic0standard 2;an,o0;! 0;time;ca","mex"],"Montevideo":["true¦america,montevideo5u0;r1y0;!st,t;uguay0y;! 0;s1t2;! s0;tandard t0;ime"],"New_York":["true¦a0Rb0Oc0Hd0Ge0Bf07g05hialeah,i02jZkYlexingtonXmTnMoKpIquHrDsAt7u5v3w0yonkers;ashington1est 0inston salem,orcD;raEvirgin04;! dc;ermont,irginia0;! beach;nited states,s0;!/0Ma;a0enne1he bronx,oleD;llaha0mpa;ssee;outh 1t0; petersburg,aten3;bo0CcC;a2hode1ichmo06och0;ester; is03;lei2;eens,intana roo;ennsylvanNhiladelphNittsbur0rovidence;gh;hio,rlan0;do;ew3or1y0;!c;folk,th c0;aroliE; 0ark,port news;hampshiYje8york0;! staU;a1eads,i0;ami,chig1;ine,nhatt0ryNssachusetts;an;! fayetP;entucky,noxA;a1e0;rsey;cks1maica;ndia1r0;on5;na;eorg0reensboro;ia;ayette1l0ort lauderda2;!orida;vil0;le;ast0dt,st,t; flatbush,ern0;! 0;standard t0t0;ime;elawa9urham;ape coral,h3incinnati,leve1o0;lumbus,nnecticut;la0;nd;a0esapeake;rlot0ttanooga;te;altimo1o0rooklyn,uffalo;st4;re;kr2merica0tlanta;! 0;eastern;on","usa"],"Nipigon":["true¦america4e0nipigon;astern0st,t;! 0;standard t0t0;ime;! eastern","usa"],"Nome":["true¦a0no5;k5laska0merica;! 1n0;! s1;s0ti1west;tandard ti0;me;st,t","usa"],"Noronha":["true¦a4brazil/den3f0n3;ernando de noronha 0nt;standard t0t0;ime;oronha;merica,tlantic islands"],"North_Dakota/Beulah":["true¦america,beulah,c1north0;;entral standard time,st","usa"],"North_Dakota/Center":["true¦america,c2merc1north0oliv1;;er;ent0st;er,ral standard time","usa"],"North_Dakota/New_Salem":["true¦america,c2n0;ew0orth0;;entral standard time,st","usa"],"Nuuk":["true¦america2g0nuuk;l,r0;eenland,l;!/godthab","green"],"Ojinaga":["true¦america5c4m0ojinaga;ountain0st,t;! 0;standard t0t0;ime;hihuahua,iudad juarez;! mountain","usa"],"Panama":["true¦a3coral h,e2pa0san miguelito;!n0;!ama;astern standard time,st;merica0t4;!/0;at2c0;aym2oral0;;ikok0;an"],"Pangnirtung":["true¦a4e0pangnirtung;astern0st,t;! 0;standard t0t0;ime;ddt,merica0;! eastern","usa"],"Paramaribo":["true¦america,paramaribo,s0;r2ur0;!iname0;! time;!t"],"Phoenix":["true¦aAc8g6idaho,m4n3phoenix,s2t1u0wyoming;s/arAtah;empe,ucsC;cottsd4inaloa,onora;ayarit,ew mexico;aryv2esa,o0st,t,wt;nta6untain standard time;ilbert,lend0;ale;h0olorado;andler,ihuahua;merica2r0;izo0;na;!/crest0;on"],"Port-au-Prince":["true¦americaBcAe6h4p0;etionville,ort0; 0-au-1;au 0de paix;prince;aiti,t0;!i;astern0st,t;! 0;standard t0t0;ime;arrefour,roix des bouquets;! eastern","usa"],"Porto_Velho":["true¦am3c0porto velho,rondônia;entral brazil0uiaba;!ian0;! s3;azon0erica,t;! 0;s0t1;tandard t0;ime"],"Puerto_Rico":["true¦a2bayam8p0;r0uerto rico;!i;merica0st,tlantic standard time;!/0;a4blanc-sabl3curacao,dominica,g2kralendijk,lower1m0port1st1torto6virgin;arigot,ontserrat;;renada,uadeloupe;on;n0ruba;guil0tigua;la"],"Punta_Arenas":["true¦america,c1punta0region of magallanes;;hile standard time,lt"],"Rainy_River":["true¦america5c1ft frances,rainy0;;entral0st,t;! 0;standard t0t0;ime;! central","usa"],"Rankin_Inlet":["true¦america5c1rankin0;;ddt,entral0st,t;! 0;standard t0t0;ime;! central","usa"],"Recife":["true¦a9br4caruaru,e3jaboatao2olinda,p0recife;aulista,e0;rnambuco,trolina;! dos guararapes; south america s3ast south a5;asilia0t;! 0;s0t1;tandard t0;ime;merica"],"Regina":["true¦america,c2regina,s0;askat0k;c1oon;anada/saskatc0entral standard time,st;hewan"],"Resolute":["true¦america4c0resolute;entral0st,t;! 0;standard t0t0;ime;! central","usa"],"Rio_Branco":["true¦a0brazil/acre,rio branco;c2merica0;!/porto0;;re0t;! 0;standard t0t0;ime"],"Santarem":["true¦a6br1e0pará west,santarem; south america s3ast south a5;asilia0t;! 0;s0t1;tandard t0;ime;merica"],"Santiago":["true¦aAc4iquique,la pintana,puente alto,rancagua,san3t1v0;alparaiso,ina del mar;alca0emuco;!huano; bernardo,tiago;h1l0oncepcion;!st,t;ile0l;! 0/continental;standard t0t0;ime;mer0ntofagasta,r0;ica","chile"],"Santo_Domingo":["true¦a8bella vista,do6la romana,s0;an0dmt; pedro de macoris,t0;iago de los caballeros,o domingo0;! 0;e0oe0;ste;!m0;!inican republic;merica,st,tlantic standard time"],"Sao_Paulo":["true¦a17b0Uc0Nd0Ke0If0Gg0Bhortol0Ai06j03l01mXnVosasco,pLriFs4ta3uber2v0;i0olta redon1B;amao,la velha,tor17;a0Nl07;boao da ser01uba11;a2e1oroNu0;maLzano;rYte lago0M;nt4o 0;bernardo do campo,carl04jo0leopolLpaulo,vicE;ao de meriti,se0;! do0; rio p8s camp01;a 1o0; andDs;barbara d'oes0Qluz0Umar0U;beirao 3o0;! 0;cla0de janei0g6ver7;ro;das nev08p0;reto;asso fun8e7iraci6lanaltGo4r0;aia g1esidente prud0;en0H;ran0;de;nta grossa,rto aleg0;re;caX;lotZtro0G;do;iteroi,ov0;aKo hamburgo;a1o0;gi das cruzTntes clarE;ri0ua;l08n7;imei3ondr0;ina;acarei,oinville,u0;iz de fo0ndi9;ra;ndaia2patin1ta0;bor6pevi,quaquece1;ga;tuG;andY;o3ravat2uaru0;ja,lh0;os;ai;iSvernador valadarC;loria5oz do0ran2; iguacu; south america sHast south ameri0mbu;ca;i0uque de caxi8;adema,vi0;noN;a1o0uriti2;ntagem,tK;choeiro de itapemirDmp1no3rapicui0scavel,xias do sul;ba;in1os dos goytacaz0;es;as;aBe7lumenau,r0;!a0st,t;!silia1zil0;!/east;! 0;s0t1;tandard t0;ime;l1t0;im;ford roxo,o horizon0;te;rueri,uru;lvora4merica3na2parecida de goi0;an0;ia;polis;!na;da"],"Scoresbysund":["true¦america,e1greenland eastern,h0ittoqqortoormiit,scoresbysund;eg,neg;ast greenland1g0;st,t;! 0;standard t0t0;ime","eu0"],"Sitka":["true¦a0sitka;k6laska0merica;! 1n0;! st2;s0t2;itka area,t0;andard t0;ime;st,t","usa"],"St_Johns":["true¦america,canada/newfoundland,h6n1st0;;d3ewfoundland0st,t;! 0;labrador,standard t0t0;ime;dt,t;ntn,tn","usa"],"Swift_Current":["true¦america,c1swift0;;entral standard time,st"],"Tegucigalpa":["true¦america,c2h0san pedro sula,tegucigalpa;n0onduras;!d;entral standard time,st"],"Thule":["true¦a0pituffik,thule;merica,st,t0;!lantic0;! 0;standard t0t0;ime","usa"],"Thunder_Bay":["true¦america4e0thunder bay;astern0st,t;! 0;standard t0t0;ime;! eastern","usa"],"Tijuana":["true¦america5baja california,e8mexic4p0tijuana;acific0st,t;! 0;standard t0t0;ime;ali,o/bajanorte;! pacific,/0;e1santa0;;nsenada","usa"],"Toronto":["true¦americaGbEcaBe7gatineIhamilFkitchener,l4m3nepe2o0quebec,richmond hill,toronto,vaugh2windsor;n5sh0tt0;awa;an;arkham,ississauga,oF;avFon0;don on0gueuil;tario;astern0st,t;! 0;standard t0t0;ime;!n0;!ada0;!/7;arrie,ramp0;ton;! 4/0;mo1nass0;au;ntre0;al;eastern","usa"],"Vancouver":["true¦america8b6canada/9ladn5okanagan,p1surrey,v0yukon;ancouv4ictor6;acific0st,t;! 0;bc,standard t0t0;ime;er;ritish columb0urnaby;ia;! 0;pacific","usa"],"Whitehorse":["true¦america,canada/yukon,m0whitehorse,yst;ountain standard time,st"],"Winnipeg":["true¦america6c2m1w0;est m0innipeg;anitoba;anada/4entral0st,t;! 0;standard t0t0;ime;! 0;central","usa"],"Yakutat":["true¦a0y4;k6laska0merica;! 1n0;! s2;s1t2y0;akutat;tandard t0;ime;st,t","usa"],"Yellowknife":["true¦america4m0yellowknife;ountain0st,t;! 0;standard t0t0;ime;! mountain","usa"]},"Antarctica":{"Casey":["true¦antarctica,cas0;ey,t","ant"],"Davis":["true¦a1dav0;is,t;ntarctica,q,ta"],"Macquarie":["true¦a2canberra,eastern australia6m0sydney;acquarie0elbourne;! island;e4ntarctica,us0; east0tralia eastern;!ern0;! standard0; time;st,t","aus"],"Mawson":["true¦antarctica,maw0;son,t"],"Rothera":["true¦a1b0city of b0rothera;uenos aires;ntarctica1r0;gentina,st,t;!/palmer"],"Troll":["true¦antarctica,g2troll0;! 0;research station,t1;mt,reenwich mean t0;ime","troll"],"Vostok":["true¦antarctica,vost0;!ok"]},"Asia":{"Almaty":["true¦a6central asia,east kazakhstan time,k2nur sultan,p1s0taraz,ust kamenogorsk;emey,hymkent;avlodar,etropavl;a0z;ragandy,z0;!akhstan0;! eastern;lm1s0;ia,tana;a0t; ata,ty"],"Amman":["true¦a2eet,irbid,jo0russeifa,wadi as sir,zarqa;!r0;!d1;mm0sia;an","jord"],"Anadyr":["true¦a0petropavlovsk kamchatsky;na0sia;dyr0t;! time"],"Aqtau":["true¦a1kazakhstan western,mangghystaū/mankis3tashkent,west 0;asia,kazakhstan5;lm2q1s0;hgabat,ia;tau;a0t; ata,-ata0; time"],"Aqtobe":["true¦a1kazakhstan western,tashkent,west 0;asia,kazakhstan5;kto5lm2qt1s0;hgabat,ia;o3ö3;a0t; ata,-ata0; time;be"],"Ashgabat":["true¦as4t0;km,m2urkmen0;a4istan0;! time;!st,t;hga1ia0;!/ashkhabad;bat"],"Atyrau":["true¦a1gur'yev,kazakhstan western,tashkent,west 0;asia,kazakhstan6;lm3s2t0;irau,yra0;u,ū;hgabat,ia;a0t; ata,-ata0; time"],"Baghdad":["true¦a6ba5dihok,erbil,i3k2mosul,na1r0;amadi,iyadh;jaf,sirC;arbala,irkuk,uwait;q,r0;aq,q;ghdad,sr9;bu ghurayb,d diw6l 5rab1s0; sulaym5ia,t;!i0;a0c;!n0;! time;amar2basrah al qadim2falluj2hill2kut,mawsil al jadid2;an0;iy0;ah"],"Baku":["true¦a0baku,ganja,lankaran,sumqayit;sia,z0;!e0t;!rbaijan0;! time"],"Bangkok":["true¦asiaAbangkok,ch7h5i3jakarta,mueang nontha8na2pak kret,s0udon thani;amut prakan,e0i racha,outh east0; asia;khon ratchasima,m dinh;ct,ndochina0;! time;a0ue;iphong,noi,t y2;iang m1on 0;buri;ai;!/0;phnom0vientiane;"],"Barnaul":["true¦a3b2kra0north a3;snoyarsk0t;! time;arnaul,iysk;sia"],"Beirut":["true¦asia,bei3e2l0ra's bay3;b0ebanon;!n;astern european time,et,urope eastern;rut","leb"],"Bishkek":["true¦asia,bishkek,k0osh;g2yrgy0;stan,zstan0;! time;!t,z"],"Brunei":["true¦asia,b0;dt,n2r0;n,unei0;! darussalam time;!t"],"Chita":["true¦asia,chita,yak0;t,utsk0;! time"],"Choibalsan":["true¦as2choibalsan,dornodsükhbaatar,mongol2ula0;anbaatar0t;! time;ia"],"Colombo":["true¦as6c4dehiwala mount lavin6i2kolkata,lk1m0new delhi,sri lanka;oratuwa,umb4;!a;ndia0st;! time,n;henn0olombo;ai;ia"],"Damascus":["true¦a4d3eet,h2latak5sy0;!r0;!ia;am3oms;amascus,eir ez zor;leppo,r raqq1s0;ia;ah","syr"],"Dhaka":["true¦asiaGbDcBd9jess8khul7mymensingh,na4pa3ra2s1t0;angail,ungi;aid8hib4ylhet;jshahi,ng7;b3ltan,r naogaon;gar5r0t3;ayan0singdi;ganj;na;ore;haka,inaj0;pur;hattogram,o0;milla,x's bazar;a0d,gd,ogra,st;gerhat,ngladesh0rishal;! time;!/dacca"],"Dili":["true¦asia,dili,east timor1tl0;!s,t;! time"],"Dubai":["true¦a5dubai,g3mus1om0ras al khaim2sharj2;!an,n;aff0c5;ah;st,ulf0;! time;bu dhabi,jm2rabi2sia0;!/musc0;at;an"],"Dushanbe":["true¦asia,dushanbe,t0;ajikistan1j0;!k,t;! time"],"Famagusta":["true¦asia,e0famagusta,northern cyprus;astern european time,et,urope eastern","eu3"],"Gaza":["true¦asia,eet,gaza2p0;alestine,s0;!e;! strip","pal"],"Hebron":["true¦asia,e0hebron,west bank;ast jerusalem,et","pal"],"Ho_Chi_Minh":["true¦asia5bien hoa,can tho,da 3ho chi minh,nha tr4qui nh6rach gia,sa dec,thi xa phu my,v0;ietnam1n0ung tau;!m;! south;lat,n0;ang;!/saig0;on"],"Hong_Kong":["true¦asia,h0kowloon,tsuen wan;k2ong0; kong0kong;! time;!g,st,t"],"Hovd":["true¦as4bayan-ölgiigovi-altaihovduvszavkhan,hov2west0; 0ern 0;mongol2;d0t;! time;ia"],"Irkutsk":["true¦a2brat3irk0north asia east,ulan ude;t,utsk0;! time;ngar0sia;sk"],"Jakarta":["true¦aZbTcRdepQiNjKkediri,lJmGpArengasdengklQs4t2w0yogyakM;est0ib; indoneXern indonesia time;a0egal;n4sikmal3;ema4itubondo,outh tan3u0;kabumi,medaSra0;b0kF;aya;ge0;raO;a4e1robolinggo,urw0;akAokerto;ka1ma0rcut;laKtangsiantar;long2nbaru;daIl3mulaIruI;a1ed0;an;diun,laF;embaE;a0ember;k0mbi,vasumatra;arta;d1ndonesia0;! western;!n;ok;i0urug;ampea,bino5leungsir,mahi,putat,rebon;a1e0injai,ogor;kasi,ngkulu;nd0tam;a0u1; aceh,r lampu0;ng;sia"],"Jayapura":["true¦a2east1indonesia eastern,jayapura,m0new guinea,wit;alukus,oluccas; indones1ern indonesia time;mbon,s0;ia"],"Jerusalem":["true¦as7beersheba,haifa,i2j0petah tiqwa,rishon leziyyon,tel aviv,west je1;e0mt;rusalem;d3l,s0;r0t;!ael0;! time;dt,t;hdod,ia0;!/tel0;","isr"],"Kabul":["true¦a1herat,jalalabad,ka0mazar e sharif;bul,ndahar;f0sia;!g0t;!hanistan0;! time"],"Kamchatka":["true¦a2kamchatka,pet0;ropavlovsk0t; kamchatsky,-kamchatski time;nadyr,sia"],"Karachi":["true¦asia,bLchiniKdera ghaziIfaisalHgujraGhyderHislamHjhang sadr,kElaDm8nawabshah,okaBp4quetta,ra3s0;a1h0ialkJukkN;ahkIekhupu9;ddiqEhiwal,rgodha;him yarEwalpindi;ak1eshawar,k0;!t;!istan0;! time;a3i1u0;lt9zaffar7;ngo0rpur khas;ra;lir cantonment,rd6;hore,rkana;a0otli;moke,rachi,s8;n5t;abad; kh0;an;ot;a1himber,ure0;wala;hawalp0ttagram;ur"],"Kathmandu":["true¦asia3biratnagar,kath4n1p0;atan,okhara;epal,p0;!l,t;!/kat0;mandu"],"Khandyga":["true¦asia,khandyga,yak0;t,utsk0;! time"],"Kolkata":["true¦0:3D;1:3L;2:2D;3:3M;4:3J;a35b2Dc24d1We1Uf1Sg1Fh1Ci18j13k0Pl0Km0Cn05odis3KpVquthbull3DrNsFt9u8v5warang2Myamun1P;a6el1Ui5;jayawa2Vsakha0HzianagC;doda2Orana11;daip0jja23lhasn1ttar pradesh;a8eXh7iru5umk0;chirap0Mnelve2p5vottiy0;a39p0;ane,iruvananthapur0Noothuku2Yriss0;mb5njo1X;ar0L;aBecunder4h9i8lst,o7r1Fu5;jan37r5;at,endr1C;l2Znip2N;k3liguKngrau2rJ;ahj1Zi5ri2Oya0L;mo1Mvaji07;har1Xlem,mbh24ng2t04ug0Y;a6e0Eoh5;iItak;ebare2i9j7m5nc1Gtl0Aurke37;ag5g5p0;und08;a5kot;hmund26sth2A;ch0p0;a9imp8roddat0u5;ducher23n5rn17;a5e;sa;ri;li,n7rbha6t5;ia2Vna;ni;chku2Ti5;ha2Gp21;a7e6izam4o5;i1Vwrang2B;l0Sw del0Y;di2Kg7i0Ejaf2Fn5re2Oshik,vi mumb15;ded,g5;i,loi j1V;ercoil,p0;a8eerut,irz25o7u5yso0Y;lugu,mb10rwa1Izaffar5;n1p0;nghyr,rad4;chili7d6harasht1Fleg07n5thu1Fu;ga0Iip0;hya,ur0V;patnG;a7u5;cknow,dhia5;na;l bahadur5t0; n1;aDhaBo8u5;kat6lt5rno1P;a2i;pal2;l5rWta,zhikode;h1Nka1Kl5;am;nd5ragp0;wa;kina13l8marOnp0r5shmir,tih3;i6na5ol ba18;l,tV;mn1;lakuric03y11;a6han5odNunagadh;si;b0Rip0l6m5;mu,n1shedp0;andh3gGna;chalkaranji,mph0In5st;!d5;!ia5o00;! time,n;a6is3ospet,u5;b2g2;o0Hp0ridw3;aChazi4o9reater noi0Mu6wali5y04;or;jar0OlbarQnt0rg6wa5;ha12;aon;rak6sa5;ba;hp0;juw8n5ya;dh6g5;an1;in1;aka;ar5iroz4;id4rukh4;l5taw0M;loF;aAe8h6indigul,ombOurg5;!ap0;anb0Uul5;ia;hra dun,l5was;hi;rbhan5vange8;ga;a09h8o5uttack;ch6imbato5;re;in;a6enn5;ai;nd5pL;a5i0C;!nn1;aNeKhBi9or7rahm04u5;landshahr,rh5;anp0;iv2;li;d3har sharif,jZkan07l5;asp0imoC;aAi7op6u5;baneshw3sav5;al;l6wan5;di,i;ai,wa6;g6ratp0tpa5vn1yand3;ra;alp0;l5ngaluru;gaum,la5;ry;hAli,r6thin5;da;a6ddham5eilly;an;n1s5;at;a6rai5;gh;ramp0;gQhmLizawl,jmKkoRlHmDnantCrrBs6urang4va5;di;ans8ia5;!/ca5;lcut5;ta;ol;ah;ap0;arnath,batt0r5;ava5its3o9;ti;ur;appuz6i5lah4w3;garh;ha;er;adn1ed4;ab5;ad;ag3;ar;arta5ra;la"],"Krasnoyarsk":["true¦a2kra0north a2;snoyarsk0t;! time;sia"],"Kuala_Lumpur":["true¦aFbukit mertajEgeorge town,ipoh,johor bahDk8m4petali3s0taipiC;e1hah alDu0;ba1ngai petani;pa9remb7;ng jaya;ala1y0;!s,t;cca,ysia0;! time;ampung baru suba3la3ota bha4ua0;la 1nt0;an;lumpur,terengganu;ng;ru;am;lor setar,sia"],"Kuching":["true¦asia,k4m2s0tawau;a0ibu;bahsarawak,ndakan;alaysia0iri,yt;! time;ota kinabalu,uching"],"Macau":["true¦asia6beiji5c2hong ko5m0urumqi;ac0o;!au;h0st;ina0ongqi1;! time;ng;!/macao"],"Magadan":["true¦asia,mag0;adan0t;! time"],"Makassar":["true¦asiaBba8c5denpa4indonesia central,k3l2ma1palu,s0wita;amarinda,ulawesi;kas2nado,taram;abuan bajo,oa jan7;endari,upang;sar;e0ity of bal3;lebesbalinusa,ntral indonesia0;! time;l0njarmasin;ikpap0;an;!/ujung0;"],"Manila":["true¦a04bWcRdaPgeneral santOiMlJmCnaBoAp4quezIsan1ta0zamboanga;clobZguig,rlac,ytE; 1t0;a ro2ol;fernando,jose del monte,pab02;a3h1uerto prince0;sa;!ilippine0l,st,t; time,s;gadiRnalanoy,s0;ay,ig;longapo,rmoc;ga,votQ;a0eycauayN;balacat,gugpo poblaci4kati,l3n0;da1ila,silingLtamp0;ay;luyong,ue;ingDol6;on;a1egaspi,i0ucena;bertad,pa;pu lapu,s p4;l0mus;igCoiI;os;smar0v5;inB;a0ebu,otabato;b1gayan de oro,in5l0;amba,ooc6;anatu5uy0;ao;a4inan2u0;d0tu2;ta;!gon0;an;co1guio,tang0;as;lod,or;n0sia;geles,tipo0;lo"],"Nicosia":["true¦a5cy3e0n2;astern european time,et,urope0; eastern,/n0;ico2;!p0;!rus;sia","eu3"],"Novokuznetsk":["true¦a5k2no0prokop'yev1;rth a4vokuznet0;sk;emerovo,ra0;snoyarsk0t;! time;sia"],"Novosibirsk":["true¦as3no0siber3;rth central as2v0;osibirsk0t;! time;ia"],"Omsk":["true¦asia,oms0;k0t;! time"],"Oral":["true¦a2kazakhstan western,oral,tashkent,west 0;asia,kazakhstan0;! 4;lm1s0;hgabat,ia;a0t; ata,-ata 0;time"],"Pontianak":["true¦asia,b2indonesia western,pontianak,tanjung pinang,w0;est0ib; b0ern indonesia time;orneo"],"Pyongyang":["true¦asia,chongjin,h7k4n3p2s0won8;ariw0eoul,inuiAunch'0;on;rk,yongya7;amp'o,orth korea;a1orea0p,st;!n time;eso3nggye;a1ungnam,ye0;san;e1mhu0;ng;ju"],"Qatar":["true¦a2doha,kuwait,qa0riyadh;!t0;!ar;r2s0;ia0t;!/bahrain; rayyan,ab0;!i0;a0c;!n0;! time"],"Qostanay":["true¦a2central asia,east kazakhstan time,k0qo1;azakhstan eastern,o0;stanay;lmt,s0;ia,tana"],"Qyzylorda":["true¦a4k1qy2tashkent,west 0;asia,kazakhstan7;azakhstan western,y0zyl-1;zyl0;orda;lm1s0;hgabat,ia;a0t; ata,-ata0; time"],"Riyadh":["true¦a8burayd7dammam,ha6jedd7k5me4najran,riyadh,sultan7ta3y0;anbu,e0;!m0;!en;'if,buk;cca,dina;hamis mush6uw6;'il,far al batin;ah;bha,l 8ntarctica/syowa,rab4s0;ia0t;!/0;aden,kuw0;ait;!i0;a0c;!n0;! time;hufuf,jubayl,kharj,mubarraz"],"Sakhalin":["true¦asia,sak0yuzhno sakhalinsk;halin0t;! 0;island,time"],"Samarkand":["true¦asia,bukhara,nukus,qarshi,samarkand,uz0;bekistan0t;! 0;time,west"],"Seoul":["true¦aPbuMchHdaeGgChwaseoRiBjeAk7m6pohaFrok,s2u1wonJy0;aCeosu;ijeongbuQlsL;e1outh korea,u0;nEwH;joAo0;ngnamMul;asGokpo;imhae,or0r,st,wangmyo7;!ea0;!n time;ju,on8;cCksBn6;angneu2oyaEu1wa0;ng5;mi,ns8riD;ng;gu,je4;angw3eon2in1un0;che2;ju;an,gju7;on;c1s0;an;heon3;n0sia;san1ya0;ng0; si"],"Shanghai":["true¦0:3J;1:36;2:34;3:37;4:3D;a3Cb31c2Nd2He30f2Cg26h1Qji1Ek1Bl0Ym0Wn0Tordos,p0Pq0Lrizh10s08t01u3FwSxLyEz5;aoCh6i5ouc3unyi;bo,go0;a7en6ouk2u5; c3h31maWzh2;g2Vj1Izh2;b1Vng5o3E;jiakou5zh2;! shi xuanhua qu;ya0z27;an9i7u5;ci,e18n5;c3fu;b4c9n5ya0;cZgk2;c3g5ji,t2Q;j17qu1sh16zh2;i6uc5;ha0;a6n5uyi0;di,gt2Lh1Gi0pu,t2Lx13ya0;m17n5;!g5ni0t0Eya0;t1ya0;aBe9u5;h6so0w1Cx5zh2;i,ue;a5u;i,n;i0Hn5;sh1zh2;fang5nxi1;di1;a8i6ong5;chuans0XhDli02sh1;an5eli0;j4sh10;i6ng5;gu,sh1;an,hec1Wyu1zh2;anmi0hAi8u5;i5zh2;h5zh2;ua;c5pi0;hu1;a7en6i5uangya14;jiaz15qi,y1;gli,ya0zh0G;n6o5s0I;gu1xi0;g5t2;h1Pqiu,rKyu;i5uan1J;aFn5o14qih1Y;g5huangdH;dGh1L;an0Ting7rc,u5;ti1yang5;! H;ding0QxZ;an5eijYingbo;ch5ji0ni0to0ya0;a0o0;entoug2ianRuda5;njU;aEi8u5;anc3o6qi5;ao;he,ya0;a7jPn5upansh02;fTxia 5yi;chengguanI;n0Do5;c3y5;a0u1;i0Wn5ohek2;g5zh2;fa0;ai6un5;mi0sh1;fe0yu1;'1aAe9l4n6u5xi;jCt0U;an,c3g5i0zh2;de5li0zh2;zhE;ya0;musi,n8o5xi0;j6z5;uo;ia0;g5shG;m7xi;aGeCkt,oBu5;a6i0Dlan ergi,m5n1;en;i7ng5y4;ga0s5;hi;'1b9n1;hhot,ng ko0;bi,f7ga0ng5ze;sh5ya0;ui;ei;i7n5rb4;d1g5;u,zh2;c3k2l0F;a9u5;an6i5li;l4ya0zh2;g5k2;do0yu1zh2;nsu,opi0;en7o6u5;ji1shQx4zh2;sh1;d2g5;hua0;a6eNong5;gu1hR;d6lian5ndo0qi0to0;!g;o5uk2;nghN;angHh5n,st,t;aAen7i5n,oZuG;fe0na5;! time;g5zh2;d5zho0;e,u;ng6o5;ya0zh2;ch7de,sh6zh5;i,ou;a,u;un;zh2;a9e5;i6n5;gbu,xi;'1h5ji0;ai;i7o5yan nur;di0t2;ou;c3sh1y4;an;he0;nDsia5;!/5;ch8harb4kashg6u5;rumqi;ar;in;o5ungki0;ng5;qi0;da,qi0sh5ya0;an,un;ng"],"Singapore":["true¦asia,kuala lumpur,s0woodlands;g0ingapore;!p,t"],"Srednekolymsk":["true¦asia,chokurdakh,sre0;dnekolymsk,t"],"Taipei":["true¦asia,banqiao,cst,h7k5roc,t0;a1w0;!n;i0oyu1;ch2n0pei,w0;an;aohsi0eel0;ung;sinchu,ualien"],"Tashkent":["true¦a3namangan,qo`q4tashkent,uz0;!b0t;!ekistan0;! east;ndij0sia;on"],"Tbilisi":["true¦asia,ge1kuta0tbil0;isi;!o0t;!rgia0;!n"],"Tehran":["true¦aQbMgorgWhamViKkCmaBn8orumiy7pasragad branch,q4rasht,s2t1varam6yazd,za0;hedVnjV;abHehrU;a0hirRirjT;bzevar,nandEri,v3;a0om;rchak,zv0;in;eh;a0eyshabur;jaf0zar0;ab4;layer,shh3;a4erman3ho0;meyni sDrram0wy;ab0sC;ad;!shah;h1r0;aj;riz;r0sfahB;!an,dt,n,st;a2irjand,o0uk9;jnu0ruje0;rd;b3ndar abbas;b4hv3m2r1sia,zads0;hahr;ak,dabil;ol;az;ad0;an"],"Thimphu":["true¦asia2b0thimphu;hutan,t0;!n;!/thimbu"],"Tokyo":["true¦0:11;1:1A;2:10;a18ch16fu0Zgifu14h0Oi0Ij0FkZmTnMoKsFt9u8waka05y3;a6o3;k3no;kaic1Co3;ha2su0;maKo;ji,tsun0F;aka7o3sukuba;k5makom05y3;a2o3;hOna0ta;oro03us0Qyo;m0Jrazu0sa1tsu1;a5end00hi4o0u3;i10zu0;monose1zuo0;ita2k3ppoLsebo;ai,u06;dawa05i0Wka3sa0t0E;ya2za1;a6eyaga0Qi3umazu;i4shi3; tokyo0Inomiya ha2;ga0R;g3ha,ra0G;a3oX;no,o0sa1;a5i3orio0;na3to,yaza1;mirinkOto;chiDeb4tsu3;do,m8ya2;as0J;aBi9o7u3y6;mam5r4shi3;ro;ashi1e,ume;oto;be,c0Dfu,ri3shigaK;ya2;shiwa3takyushu;da;gosVkogawacho honmKmirenjaku,na8s5wa3;g3sa1;oe,uc07;hi01u3;g3kabe;ai;zaY;ap4dt,oetJp3st;!n;an;bara1chi4ta3wa1zu3;mi;ha5n3;omi3;ya;ra;a8i3oncho;meBr4t3;acR;a4os3;a1hi2;kaNtsu0;chi5kodate,mam3;at3;su;nohe,o3;ji;ji8ku3;i6o0s3ya2;hi2;ma;ka; sD;!sa7;i3ofu;ba,g6;geoshimo,k7mag5njo,omori,s3tsugi;ahika3ia;wa;asa1;ki;as4i3;ta;hi"],"Tomsk":["true¦asia,oms0tomsk;k,t"],"Ulaanbaatar":["true¦asia3m1ula0;anbaatar,n bator,t;n0ongolia;!g;!/ulan0;"],"Ust-Nera":["true¦asia,ust-nera,vla0;divostok,t"],"Vladivostok":["true¦asia,k1vla0;divostok,t;habarovsk0omsomolsk on amur;! vtoroy"],"Yakutsk":["true¦asia,blagoveshchen1yak0;t,ut0;sk"],"Yangon":["true¦asia4b3kyain seikgyi township,m0nay pyi taw,pathein,sittwe,yang5;a1eiktila,m0onywa;!r;ndalay,wlamyine;ago,urma;!/rango0;on"],"Yekaterinburg":["true¦asia,chelyabin7eka5k4magnitogor7nizhn3or2perm,s1tyumen,ufa,yek0zlatoust;a4t;terlitamak,urgut;e3sk;evartov3y tagil;amensk ural'skiy,urgan;teri0;nburg;sk"],"Yerevan":["true¦a0caucasus,yerevan;m2rm0s1;!en0;ia;!t"]},"Atlantic":{"Azores":["true¦a0hmt;tlantic,zo0;res,st,t","eu0"],"Bermuda":["true¦a2b0;ermuda,m0;!u;st,t0;!lantic","usa"],"Canary":["true¦atlantic,canary1europe western,las palmas de gran canaria,santa cruz de tenerife,we0;stern european,t;! islands","eu1"],"Cape_Verde":["true¦atlantic,c0;a1pv,v0;!t;bo verde0pe verde;! is"],"Faroe":["true¦atlantic2f0;aroe0o,ro;! islands;!/faeroe","eu1"],"Madeira":["true¦atlantic,europe western,madeira1we0;stern european,t;! islands","eu1"],"Reykjavik":["true¦atlantic,coordinated universal3g2i0reykjavik,utc,zulu;celand,s0;!l;mt,reenwich mean0; time"],"South_Georgia":["true¦atlantic,gs1s0;gs,outh georgia;!t"],"Stanley":["true¦atlantic,f0stanley;alkland1k0lk;!st,t;! island0;!s"]},"Australia":{"Adelaide":["true¦a2cen0south 1; 0tral 0;australia;c2delaide,ustralia0;! 0/south,n 0;central;dt,st,t","aus"],"Brisbane":["true¦a1brisbane0gold coast,logan,q4townsville;! time;e3ustralia0;!/q1n east0;!ern;ueensland;dt,st"],"Broken_Hill":["true¦a2broken1cen0y4; australia standard time,tral australia;;c2delaide,ustralia0;! central,/y0;ancowinna;st,t","aus"],"Darwin":["true¦a0darwin,northern territory;cst,ustralia0;!/north,n central"],"Eucla":["true¦a0cw4eucla;cw4us0; central w1tralia0;!n central western;!e0;st;dt,st,t"],"Hobart":["true¦a0canberra,eastern austral5hobart,king island,melbourne,sydney,t4;e8us0; east5tralia0;! 3/0n 3;currie,t0;asman0;ia;easte1;!e0;rn;st,t","aus"],"Lindeman":["true¦a0brisbane time,lindeman,whitsunday islands;est,ustralia0;!n eastern"],"Lord_Howe":["true¦australia3l0;h1ord howe0;! island;dt,st,t;!/lhi","lhow"],"Melbourne":["true¦a0canberra,eastern austral4geelong,melbourne,sydney,v3;e7us0; east4tralia0;! 2/v0n 2;ictor0;ia;easte1;!e0;rn;st,t","aus"],"Perth":["true¦a4perth,w0; 2est0; 1ern australia0;! time;australia;ustralia1w0;dt,st,t;! weste1/west,n west0;!e0;rn"],"Sydney":["true¦a0c5eastern australia time,melbourne,new south wales,sydney,wollongong;e8u0;!s0;! east4tralia0;! 2/0n 2;act,c0nsw;anberra;easte1;!e0;rn;st,t","aus"]},"Etc":{"GMT":["true¦coordinated universal3etc2g0utc,zulu;mt,reenwich0;! mean1;!/greenwich; time"],"UTC":["true¦coordinated universal7etc2g1u0z4;ct,n5tc;mt,reenwich mean5;!/0;u1z0;ulu;ct,n0;iversal; time"]},"Europe":{"Amsterdam":["true¦a9brussels,c6e4groning7madrid,n2paris,ro1t0utrecht;he hague,ilburg;mance,t9;etherlands,l0;!d;indhov2urope0;! central;e1openhag0;en;ntral european,t;lmere stad,m0;s0t;terdam","eu2"],"Andorra":["true¦a3brussels,c1europe0madrid,paris,romance;! central;e0openhagen;ntral european,t;d,nd0;!orra","eu2"],"Astrakhan":["true¦astrakh1europe,m0russi1st petersburg,volgograd time;oscow,sk;an"],"Athens":["true¦athens,e1gr0thessaloniki;!c,eece;astern european,et,urope0;! eastern","eu3"],"Belgrade":["true¦b9c7europe3madrid,n2p1romance,s0;i,lovenia,vn;aris,risti4;is,ovi sad;! central,/0;ljublja1podgorica,s0zagreb;arajevo,kopje;na;e0openhagen;ntral european,t;elgrade,russels","eu2"],"Brussels":["true¦antwerp6b3c1europe0gent,liege,madrid,paris,romance;! central;e0harleroi,openhag4;ntral european,t;e0mt,russels;!l0;!gium;en","eu2"],"Bucharest":["true¦b5c4e2gala1iasi,oradea,ploies1ro0timisoara;!mania,u;ti;astern european,et,urope0;! eastern;luj napoca,onstanta,raiova;ra0ucharest;ila,sov","eu3"],"Budapest":["true¦b6c3debrec4europe2hu0madrid,paris,romance;!n0;!gary;! central;e1openhag0;en;ntral european,t;russels,udapest","eu2"],"Busingen":["true¦b5c3de2europe1germa0madrid,paris,romance,saxo0;ny;! central,/berlin;!u;e0openhag3;ntral european,t;avaria,r0using1;em0ussels;en","eu2"],"Chisinau":["true¦chisinau,e2m0;d0oldova;!a;astern european,et,urope0;! eastern,/tiraspol","eu2"],"Copenhagen":["true¦arhus,brussels,c2d1europe0madrid,paris,romance;! central;enmark,k,nk;e0mt,openhagen;ntral european,t","eu2"],"Dublin":["true¦ace,british7cork,d6e5g4i2l0tse;isb0ond0;on;e,r0st;eland,l;mt,reenwich mean2;dinburgh,ire,urope;mt,ublin; time","eu1"],"Gibraltar":["true¦b5c3europe2gi0madrid,paris,romance;!b0;!raltar;! central;e0openhagen;ntral european,t;dst,russels,st","eu2"],"Helsinki":["true¦e3fi1helsinki,t0vantaa;ampere,urku;!n0;!land;astern european,et,spoo,urope0;! eastern,/mariehamn","eu3"],"Istanbul":["true¦aYbScQdOeKgJiHkFmBosmAs4t1u0v07zeytinburnu;eskuedWmr9;arsus,r1ur0;!kZ;!abzon,t;a3i1ultan0;beyJgazi;sIv0;as,erek;msun,n0;cakteBliurfa;aniye;a1er0uratpaH;kezefendi,sin;l0niF;atQte6;a0irikkale,onPutahP;hramanmaras,rabaglGyseS;sJzmi0;r,t;aziantep,ebze;lazig,rzurum,s1uro0;pe;en0kiC;l8yurt;eniz0iyarbakB;li;ankaEor0;lu,um;a1ur0;sa;gcil2hcelievl1likes5sak4t0;ikent,mB;er;ar;d7n4rnavutko3sia/is2ta0;seh0;ir;tanbul;ey;kara,ta0;k0l0;ya;a1iyam0;an;na,paza0;ri"],"Kaliningrad":["true¦e0kaliningrad;astern european,et,urope"],"Kiev":["true¦bila tserkLcherIdGeDhorlCivano frankivHk8l7m5odessa,poltaLriv4sumy,ternopil,u2vinnyts1z0;aporizhzh0hytomyr;ya;a,kr0;!ai0;ne;a0ykolayE;ki5riu8;ut9vC;amyanske,h1iev,r0yB;emenchuk,opyv1yvyy rih;ark9erson,mel0;nytskyy;ivka;astern european,et,urope0;! eastern,/simfero0;pol;nipro,onet0;sk;kasy,ni0;h0vtsi;iv;va","eu3"],"Kirov":["true¦europe,kirov,m0russian,st petersburg,volgograd time;oscow,sk"],"Lisbon":["true¦amadora,europe5lisbon,p2we0;st0t;! europe,ern european;ort0rt,t;o,ugal0;! mainland;! western","eu1"],"London":["true¦a0Ob0Ac07d03eXgThRiOj00kingston upon hull,lJmHnBoxSp9reading,s1w0yF;arwick0Aigan,olverha7;heffield,o3t2u1w0;an4iH;ffolk,nderland,rr0IsYttL;afNoke on tre0C;meZuth0;a1end on 0;sea;mptG;ly0orts0restF;mouth;ew4o0;r0ttinghamT;th0wC; y0amptonR;orkV;castle upon tyne,port;ancheQi0;dlan4lton keynes;ancaRdn,e2i1o0ut5;nd4;ncolnPsb3verW;e0icesterJ;ds;psw1slingt0;on;ich;ampJert0;fordI;b2l1mt0reenwich mean M;! standard L;asgow,oucesterF;!-eF;dinburgh,s4urope0;!/0;belNguernsMisle1j0;ersL;;sex;erby2o1u0;blin,dlH;rset;!sh5;a1ity of westmin0oventry,rawlE;ster;mbridge1rdiff;eAir9lack7r2st,uckingham0;sh0;ire;adford,e3i0;st4tish0;! 0;time;nt;po0;ol;kenhead,mingham;l1xl0;ey;fast;berdeen,rchway","eu1"],"Luxembourg":["true¦brussels,c3europe2lu0madrid,paris,romance;!x0;!embourg;! central;e0openhagen;ntral european,t","eu2"],"Madrid":["true¦aRbOcJeGfuenDgCjerez de la frontera,lBm8ovieFp6romance,s1terrassa,v0wemt,zaragoza;alladol9igo;a1evilla,pain0;! mainland;badell,n0; sebastiHt0; marti,ander,s montjuic;a0uente de vallecas;lma,mpIris;a0ostolLurcK;dr0laga;id;atiJeganI;asteiz/vitorGijon,ran1;carral el par1labr0;ada;do;ixample,lche,s1urope0;! centr2;!p;a3e1iudad line0openhagen;al;ntral europe0t;an;rabanchel,stello de la pla7;a0ilbao,russels,urgos;da0rce0sque;lo4; coru3l0;cala de henar1icante,mer0;ia;es;na","eu2"],"Malta":["true¦brussels,c3europe2m0paris,romance;a0lt,t;drid,lta;! central;e0openhagen;ntral european,t","eu2"],"Minsk":["true¦b4europe,h3m1russian,st petersburg,v0;iteb4olgograd time;ahily0in3osc0sk;ow;omyel,rodna;abruy0elarus,lr,rest,y;sk"],"Monaco":["true¦brussels,c3europe2m0paris,romance;adrid,c0onaco;!o;! central;e0openhagen;ntral european,t","eu2"],"Moscow":["true¦ar0Db0Ac07dzerzh06europe,fet,grozn05ivano04kYlipet0FmRnNorel,pKrFs8t6v2w-su,y0zelenograd;a0oshkar oW;roslavl,sene02;asyl'evsky ostrIelikiMladi2o0ykhino zhulebT;l0ronezh;gograd Pogda;kavkaz,m08;a0uQver;ganrog,mbD;a4ever3hakhty,molen06ochi,t0yktyvkR; 4a0;ryy osk0vrop0;ol;nSodvT;int 0rX;petersburg;ostov na donu,u1y0;azLbP;!s0;!sia0;!n;e1odolUsk0;ov;nza,trozavodS;a2izhn0ovorossiyR;ekamQi0;y novM;berezhnyye chelny,l'chik;a3dst,oscow1s0urmJ;d,k;! 0;time;khachka1r'0;ino;la;a2himki,ostroma,rasno0urG;d0gvargeisky;ar;l1z0;an;ininsk5uga;vo;yy;in8;entraln1he0;boksary,repovets;iy;el1ry0;an3;gorod;khangel'1mav0;ir;sk"],"Oslo":["true¦a6b5c3europe2madrid,oslo,paris,romance,s0;j0valbard and jan may7;!m;! central;e0openhag4;ntral european,t;erg2russels;rctic/longyearby1tlantic/jan0;;en","eu2"],"Paris":["true¦bIcFeuropeEfrBl9m7n5paris,r3s0toulouH;aint 1t0; 0rasbourg;etienne;e0oman9;ims,nn1;ant0i7ormandy;es;a0et,ontpellier;drid,rsei1;e havre,i0yon;lle;!a0;!n0;ce;! central;e0openhagen;ntral european,rgy pontoi0t;se;ordeaux,russels","eu2"],"Prague":["true¦br6c4europe2madrid,ostr3p1romance,s0;k,lovakia,vk;aris,mt,rague;! central,/bratisl0;ava;e0openhagen;ntral european,t;no,ussels","eu2"],"Riga":["true¦e2kalt,l0riga;atvia,st,v0;!a;ast2e1urope0;! eastern;st,t; europe,ern european","eu3"],"Rome":["true¦bJcFeuropeCfloreBgenoa,mAnaples,p7r5sicily,t3v0;a0eroL;!t0;!ican city;aran4rieste,u0;rin,scany;mt,om0;a4e;a1ra0;to;dova,lermo,ris;adrid,essiBil7;nce;! central,/0;san0vatic4;;atan5e1o0;penhagen,rsica;ntral europe0t;an;ari,olog2r0;esc0ussels;ia;na","eu2"],"Samara":["true¦europe,izhevsk,s0togliatti on the volga;am0yzran;ara,t"],"Saratov":["true¦balakovo,europe,izhevsk,sa0;m0ratov;ara,t"],"Sofia":["true¦b2e0imt,plovdiv,sof4varna;astern european,et,urope0;! eastern;g2u0;lgar0rgas;ia;!r","eu3"],"Stockholm":["true¦brussels,c5europe4goeteborg,ma3paris,romance,s0;e1tockholm,we0;!d4;!t;drid,lmoe;! central;e1openhag0;en;ntral european,t","eu2"],"Tallinn":["true¦e0tallinn;astern european,e2st1urope0;! eastern;!onia;!t","eu3"],"Tirane":["true¦al4brussels,c2europe1madrid,paris,romance,tiran0;a,e;! central;e0openhagen;ntral european,t;!b0;!ania","eu2"],"Ulyanovsk":["true¦europe,m0russian,st petersburg,ulyanovsk,volgograd 2;oscow0sk;! 0;time"],"Uzhgorod":["true¦e0ruthenia,uzhgorod;astern european,et,urope0;! eastern","eu3"],"Vienna":["true¦a4brussels,c1donaustadt,europe0favorit2graz,linz,madrid,paris,romance,vienna;! central;e1openhag0;en;ntral european,t;t,u0;stria,t","eu2"],"Vilnius":["true¦e3k2l0vilnius;ithuania,t0;!u;aunas,laipeda;astern european,et,urope0;! eastern","eu3"],"Volgograd":["true¦europe,m2russian,st petersburg,vol0;gograd0t,zhskiy;! time;oscow,sk"],"Warsaw":["true¦bKcHeuropeGgCkAl8m7p4r3s2torun,w0zabrze;ars0rocl0;aw;osnowiec,zczec6;adIomanA;aris,l,o0raga poludnie;l0znD;!and;adrid,okot3;odz,ubl0;in;ato2iel3rak0;ow;d2li0;wi0;ce;ansk,ynia;! central;e0openhagen,zestochowa;ntral europe0t;an;i2russels,y0;dgoszcz,t0;om;alystok,elsko biala","eu2"],"Zaporozhye":["true¦e3luhansk2sevastopol,zapor0;izhia lugansk,ozh0;'ye,ye;! east;astern european,et,urope0;! eastern","eu3"],"Zurich":["true¦brussels,c4europe2geneve,li0madrid,paris,romance,swiss time,zurich;!e0;!chtenstein;! central,/0;busin1vaduz;e1openha0;gen;ntral european,t","eu2"]},"Indian":{"Chagos":["true¦british indian ocean territory,c4i0;ndian1o0;!t;! 0;c0ocean;hagos"],"Christmas":["true¦c0indian;hristmas1x0;!r,t;! island"],"Cocos":["true¦c0indian;c2ocos0;! island0;!s;!k,t"],"Kerguelen":["true¦a5french southern2indian,kerguelen1tf0;!t;!st paul4;! 0;& antarctic time,and antarctic0;! lands;msterdam0tf; island"],"Mahe":["true¦indian,mahe,s0;c0eychelles,yc;!t"],"Maldives":["true¦indian,m0;aldives,dv,v0;!t"],"Mauritius":["true¦indian,m0port louis;auritius,u0;!s,t"],"Reunion":["true¦indian,r0;e0éu1;t,u0;nion"]},"Pacific":{"Apia":["true¦apia,pacific,s2w0;est s1s0;!m,t;amoa"],"Auckland":["true¦a2christchurch,manukau,n0pacific,wellington;ew zea2orth shore,z0;!dt,l,mt,st,t;ntarctica/1uck0;land;mcmurdo,south0;","nz"],"Bougainville":["true¦bougainville,guinea2p0;a0gt;cific,pua new guinea;!n"],"Chatham":["true¦cha0nz-chat,pacific;dt,st,t0;!ham0;! 0;islands,time","chat"],"Chuuk":["true¦chuuk2pacific0;!/0;truk,y1;!/truky0;ap"],"Easter":["true¦chile/easter4e0pacific;as0mt;st,t0;!er0;! 0;island","east"],"Efate":["true¦efate,pacific,v0;anuatu,u0;!t"],"Fakaofo":["true¦fakaofo,pacific,t0;k0okelau;!l,t"],"Fiji":["true¦f0pacific;iji,j0;!i,st,t","fiji"],"Funafuti":["true¦funafuti,pacific,t0;uv1v0;!t;!alu"],"Galapagos":["true¦co1gal0pacific;apagos,t,ápagos islands;lombia,st,t"],"Gambier":["true¦gam0pacific;bier0t;! islands"],"Guadalcanal":["true¦guadalcanal,pacific,s0;b1lb,olomon0;! islands;!t"],"Guam":["true¦ch5guam,m4northern mariana islands,p2west0; 0ern 0;pacific;acific0ort moresby;!/saipan;np,p;amorro,st"],"Honolulu":["true¦aleutian4h1pacific0us/hawaii;!/johnston;a0onolulu,st;st,t,waii0;! aleutian;! islands"],"Kanton":["true¦kanton,p0;acific0hoenix islands;!/enderbury"],"Kiritimati":["true¦ki1lin0pacific;e islands,t;!r0;!i0;bati,timati0;! island"],"Kosrae":["true¦kos0pacific;rae,t"],"Kwajalein":["true¦kwajalein,m0pacific;arshall islands,ht"],"Majuro":["true¦m0pacific;a1h0;!l,t;juro,rshall islands"],"Marquesas":["true¦mar0pacific;quesas0t;! islands"],"Nauru":["true¦n0pacific;auru,r0;!t,u"],"Niue":["true¦n0pacific;iu1u0;!t;!e"],"Norfolk":["true¦n0pacific;f1orfolk0;! island;!k,t","aus"],"Noumea":["true¦n0pacific;c0ew caledonia,oumea;!l,t"],"Pago_Pago":["true¦m6pa1s0us/sa5;a4st;cific1go0;;!/0;m1sa0;moa;idway"],"Palau":["true¦p0;a1lw,w0;!t;cific,lau"],"Pitcairn":["true¦p0;acific,cn,itcairn,n,st"],"Pohnpei":["true¦french polynesia,p0;acific0f,ohnpei0yf;!/ponape"],"Port_Moresby":["true¦antarctica/dumontd4dumont-d'4guinea3p0;a1g0ng,ort moresby;!t;cific,pua new guinea;!n;urville"],"Rarotonga":["true¦c0pacific,rarotonga;k2o0;k,ok0;! islands;!t"],"Tahiti":["true¦pacific,society islands,tah0;iti,t"],"Tarawa":["true¦gil0pacific,tarawa;bert islands,t"],"Tongatapu":["true¦nuku'alofa,pacific,to0;!n0t;!ga0;!tapu"],"Wake":["true¦pacific,u2wak0;e0t;! island;m0s minor outlying islands;!i"],"Wallis":["true¦pacific,w0;allis1f0lf;!t;! 0;&0and0; futuna"]}};

// strings that don't pack properly
var misc = {
  'gmt+0': 'etc/GMT',
  'gmt-0': 'etc/GMT',
  gmt0: 'etc/GMT',
  'etc/gmt+0': 'Etc/GMT',
  'etc/gmt-0': 'Etc/GMT',
  'etc/gmt0': 'Etc/GMT',
  'msk-01 - kaliningrad': 'Europe/Kaliningrad',
  'msk+00 - moscow area': 'Europe/Moscow',
  'msk+00 - crimea': 'Europe/Simferopol',
  'msk+00 - volgograd': 'Europe/Volgograd',
  'msk+00 - kirov': 'Europe/Kirov',
  'msk+01 - astrakhan': 'Europe/Astrakhan',
  'msk+01 - saratov': 'Europe/Saratov',
  'msk+01 - ulyanovsk': 'Europe/Ulyanovsk',
  'msk+01 - samaraudmurtia': 'Europe/Samara',
  'msk+02 - urals': 'Asia/Yekaterinburg',
  'msk+03': 'Asia/Omsk',
  'msk+04 - novosibirsk': 'Asia/Novosibirsk',
  'msk+04 - altai': 'Asia/Barnaul',
  'msk+04': 'Asia/Tomsk',
  'msk+04 - kemerovo': 'Asia/Novokuznetsk',
  'msk+04 - krasnoyarsk area': 'Asia/Krasnoyarsk',
  'msk+05 - irkutskburyatia': 'Asia/Irkutsk',
  'msk+06 - zabaykalsky': 'Asia/Chita',
  'msk+06 - lena river': 'Asia/Yakutsk',
  'msk+06 - tomponskyust-maysky': 'Asia/Khandyga',
  'msk+07 - amur river': 'Asia/Vladivostok',
  'msk+07 - oymyakonsky': 'Asia/Ust-Nera',
  'msk+08 - magadan': 'Asia/Magadan',
  'msk+08 - sakhalin island': 'Asia/Sakhalin',
  'msk+08 - sakha (e) north kuril is': 'Asia/Srednekolymsk',
  'msk+09': 'Asia/Kamchatka',
  'msk+09 - bering sea': 'Asia/Anadyr',
  "russia time zone 11": "Asia/Anadyr",
  "russia time zone 10": "Asia/Srednekolymsk",
  "russia time zone 3": "Europe/Samara",
  "coordinated universal time-09": "Pacific/Gambier",
  "utc-09": "Pacific/Gambier",
  "coordinated universal time-08": "Pacific/Pitcairn"
};

// unpack our lexicon of words
let zones = {};
let lexicon = Object.assign({}, misc);
Object.keys(pcked).forEach(top => {
  Object.keys(pcked[top]).forEach(name => {
    let a = pcked[top][name];
    let id = `${top}/${name}`;
    zones[id] = {
    };
    Object.keys(unpack$1(a[0])).forEach(k => {
      lexicon[k] = lexicon[k] || [];
      lexicon[k].push(id);
    });
    if (a[3]) {
      zones[id].dst = dstPatterns[a[1]].split(/\|/);
    }
  });
});

//try to match these against iana form
const one = (str) => {
  str = str.toLowerCase();
  str = str.replace(/^in /g, '');
  str = str.replace(/ time/g, '');
  str = str.replace(/ (standard|daylight|summer)/g, '');
  str = str.replace(/ - .*/g, ''); //`Eastern Time - US & Canada`
  str = str.replace(/, .*/g, ''); //`mumbai, india`
  str = str.replace(/\./g, '');//st. petersberg
  return str.trim()
};

//some more aggressive transformations
const two = function (str) {
  str = str.replace(/\b(east|west|north|south)ern/g, '$1');
  str = str.replace(/\b(africa|america|australia)n/g, '$1');
  str = str.replace(/\beuropean/g, 'europe');
  str = str.replace(/\islands/g, 'island');
  str = str.replace(/.*\//g, '');
  return str.trim()
};
// even-more agressive
const three = function (str) {
  str = str.replace(/\(.*\)/, '');//anything in brackets
  str = str.replace(/  +/g, ' ');//extra spaces
  return str.trim()
};

var normalize = { one, two, three };

// match some text to an iana code
const find = function (str) {
  // perfect id match
  if (zones.hasOwnProperty(str)) {
    return str
  }
  // lookup known word
  if (lexicon.hasOwnProperty(str)) {
    return lexicon[str]
  }
  // try a sequence of normalization steps
  str = normalize.one(str);
  if (lexicon.hasOwnProperty(str)) {
    return lexicon[str]
  }
  str = normalize.two(str);
  if (lexicon.hasOwnProperty(str)) {
    return lexicon[str]
  }
  str = normalize.three(str);
  if (lexicon.hasOwnProperty(str)) {
    return lexicon[str]
  }
  return null
};
var find$1 = find;

var metas = [
  {
    name: 'India Time',
    abbr: null,
    aliases: [
      'india',
      'indian',
      'india standard time',
      'chennai',
      'kolkata',
      'mumbai',
      'new delhi'
    ],
    ids: ['Asia/Kolkata', 'Asia/Calcutta', 'Asia/Colombo'],
    std: {
      name: 'India Standard Time',
      abbr: 'IST',
      offset: 5.5
    },
    dst: {},
    long: '(UTC+05:30) Chennai, Kolkata, Mumbai, New Delhi',
    hem: 'n'
  },
  {
    name: 'China Time',
    abbr: null,
    aliases: ['china', 'china standard time', 'beijing', 'chongqing', 'hong kong', 'urumqi'],
    ids: ['Asia/Shanghai', 'Asia/Macau', 'Asia/Urumqi'],
    std: {
      abbr: 'CST',
      name: 'China Standard Time',
      offset: 8
    },
    dst: {},
    long: '(UTC+08:00) Beijing, Chongqing, Hong Kong, Urumqi',
    hem: 'n'
  },
  {
    name: 'Central European Time',
    abbr: null,
    aliases: [
      'europe central',
      'romance standard time',
      'brussels',
      'copenhagen',
      'madrid',
      'paris',
      'romance'
    ],
    ids: [
      'Europe/Paris',
      'Africa/Ceuta',
      'Arctic/Longyearbyen',
      'Europe/Amsterdam',
      'Europe/Andorra',
      'Europe/Belgrade',
      'Europe/Berlin',
      'Europe/Bratislava',
      'Europe/Brussels',
      'Europe/Budapest',
      'Europe/Busingen',
      'Europe/Copenhagen',
      'Europe/Gibraltar',
      'Europe/Ljubljana',
      'Europe/Luxembourg',
      'Europe/Madrid',
      'Europe/Malta',
      'Europe/Monaco',
      'Europe/Oslo',
      'Europe/Podgorica',
      'Europe/Prague',
      'Europe/Rome',
      'Europe/San_Marino',
      'Europe/Sarajevo',
      'Europe/Skopje',
      'Europe/Stockholm',
      'Europe/Tirane',
      'Europe/Vaduz',
      'Europe/Vatican',
      'Europe/Vienna',
      'Europe/Warsaw',
      'Europe/Zagreb',
      'Europe/Zurich'
    ],
    std: {
      abbr: 'CET',
      name: 'Central European Standard Time',
      offset: 1
    },
    dst: {
      abbr: 'CEST',
      name: 'Central European Summer Time',
      offset: 2
    },
    long: '(UTC+01:00) Brussels, Copenhagen, Madrid, Paris',
    hem: 'n'
  },
  {
    name: '',
    dupe: true,
    ids: [
      'America/Puerto_Rico',
      'America/Montserrat',
      'America/Port_of_Spain',
      'America/Santo_Domingo',
      'America/St_Barthelemy',
      'America/St_Kitts',
      'America/St_Lucia',
      'America/St_Thomas',
      'America/St_Vincent',
      'America/Tortola',
      'America/Grenada',
      'America/Guadeloupe',
      'America/Kralendijk',
      'America/Lower_Princes',
      'America/Marigot',
      'America/Martinique',
      'America/Anguilla',
      'America/Antigua',
      'America/Aruba',
      'America/Barbados',
      'America/Blanc-Sablon',
      'America/Curacao',
      'America/Dominica'
    ],
    std: {
      name: 'Atlantic Standard Time',
      abbr: 'AST',
      offset: -4
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Greenwich Mean Time',
    abbr: null,
    aliases: ['gmt', 'zulu', 'utc', 'coordinated universal time'],
    ids: [
      'Etc/GMT',
      'Africa/Abidjan',
      'Africa/Accra',
      'Africa/Bamako',
      'Africa/Banjul',
      'Africa/Bissau',
      'Africa/Conakry',
      'Africa/Dakar',
      'Africa/Freetown',
      'Africa/Lome',
      'Africa/Monrovia',
      'Africa/Nouakchott',
      'Africa/Ouagadougou',
      'Africa/Sao_Tome',
      'America/Danmarkshavn',
      'Atlantic/Reykjavik',
      'Atlantic/St_Helena',
      'Etc/UTC'
    ],
    std: {
      name: 'Greenwich Mean Time',
      abbr: 'GMT',
      offset: 0
    },
    dst: {},
    long: '(UTC) Coordinated Universal Time',
    hem: 'n'
  },
  {
    name: 'Eastern European Time',
    abbr: null,
    aliases: ['europe eastern'],
    ids: [
      'Asia/Beirut',
      'Asia/Famagusta',
      'Asia/Nicosia',
      'Europe/Athens',
      'Europe/Bucharest',
      'Europe/Chisinau',
      'Europe/Helsinki',
      'Europe/Kiev',
      'Europe/Mariehamn',
      'Europe/Riga',
      'Europe/Sofia',
      'Europe/Tallinn',
      'Europe/Uzhgorod',
      'Europe/Vilnius',
      'Europe/Zaporozhye'
    ],
    std: {
      abbr: 'EET',
      name: 'Eastern European Standard Time',
      offset: 2
    },
    dst: {
      abbr: 'EEST',
      name: 'Eastern European Summer Time',
      offset: 3
    },
    hem: 'n'
  },
  {
    name: '',
    dupe: true,
    ids: [
      'America/Indiana',
      'America/North_Dakota',
      'America/Belize',
      'America/Costa_Rica',
      'America/El_Salvador',
      'America/Guatemala',
      'America/Indiana/Knox',
      'America/Indiana/Tell_City',
      'America/Managua',
      'America/North_Dakota/Beulah',
      'America/North_Dakota/Center',
      'America/North_Dakota/New_Salem',
      'America/Regina',
      'America/Swift_Current',
      'America/Tegucigalpa'
    ],
    std: {
      name: 'Central Standard Time',
      abbr: 'CST',
      offset: -6
    },
    hem: 'n'
  },
  {
    name: 'Eastern Time',
    abbr: 'ET',
    aliases: ['america eastern', 'eastern standard time', 'eastern'],
    ids: [
      'America/New_York',
      'America/Detroit',
      'America/Grand_Turk',
      'America/Indianapolis',
      'America/Iqaluit',
      'America/Louisville',
      'America/Nassau',
      'America/Nipigon',
      'America/Pangnirtung',
      'America/Port-au-Prince',
      'America/Thunder_Bay',
      'America/Toronto',
      'America/Montreal',
      'America/Kentucky'
    ],
    std: {
      name: 'Eastern Standard Time',
      abbr: 'EST',
      offset: -5
    },
    dst: {
      name: 'Eastern Daylight Time',
      abbr: 'EDT',
      offset: -4
    },
    long: '(UTC-05:00) Eastern Time (US & Canada)',
    hem: 'n'
  },
  {
    name: 'Argentina Time',
    abbr: 'ART',
    aliases: ['argentina', 'arst', 'argentina standard time', 'buenos aires'],
    ids: [
      'America/Buenos_Aires',
      'America/Argentina/La_Rioja',
      'America/Argentina/Rio_Gallegos',
      'America/Argentina/Salta',
      'America/Argentina/San_Juan',
      'America/Argentina/San_Luis',
      'America/Argentina/Tucuman',
      'America/Argentina/Ushuaia',
      'America/Catamarca',
      'America/Cordoba',
      'America/Jujuy',
      'America/Mendoza',
      'Antarctica/Rothera',
      'America/Argentina'
    ],
    std: {
      name: 'Argentina Standard Time',
      abbr: 'ART',
      offset: -3
    },
    dst: {},
    long: '(UTC-03:00) City of Buenos Aires',
    hem: 's'
  },
  {
    name: '',
    dupe: true,
    ids: [
      'America/Coral_Harbour',
      'America/Indiana/Marengo',
      'America/Indiana/Petersburg',
      'America/Indiana/Vevay',
      'America/Indiana/Vincennes',
      'America/Indiana/Winamac',
      'America/Kentucky/Monticello',
      'America/Cancun',
      'America/Cayman',
      'America/Jamaica',
      'America/Panama'
    ],
    std: {
      name: 'Eastern Standard Time',
      abbr: 'EST',
      offset: -5
    },
    hem: 'n'
  },
  {
    name: 'East Africa Time',
    abbr: null,
    aliases: [
      'africa eastern',
      'e. africa standard time',
      'nairobi',
      'east africa',
      'eastern africa'
    ],
    ids: [
      'Africa/Nairobi',
      'Africa/Addis_Ababa',
      'Africa/Asmera',
      'Africa/Dar_es_Salaam',
      'Africa/Djibouti',
      'Africa/Kampala',
      'Africa/Mogadishu',
      'Indian/Comoro',
      'Indian/Mayotte'
    ],
    std: {
      name: 'East Africa Time',
      abbr: 'EAT',
      offset: 3
    },
    dst: {},
    long: '(UTC+03:00) Nairobi',
    hem: 'n'
  },
  {
    name: 'West Africa Time',
    abbr: 'WAT',
    aliases: [
      'africa western',
      'wast',
      'western africa',
      'w. central africa standard time',
      'west central africa',
      'w. central africa'
    ],
    ids: [
      'Africa/Lagos',
      'Africa/Bangui',
      'Africa/Douala',
      'Africa/Libreville',
      'Africa/Malabo',
      'Africa/Ndjamena',
      'Africa/Niamey',
      'Africa/Porto-Novo'
    ],
    std: {
      name: 'West Africa Standard Time',
      abbr: 'WAT',
      offset: 1
    },
    long: '(UTC+01:00) West Central Africa',
    hem: 'n'
  },
  {
    name: 'Moscow Time',
    abbr: null,
    aliases: ['moscow', 'russian standard time', 'st. petersburg', 'russian', 'volgograd time'],
    ids: [
      'Europe/Moscow',
      'Europe/Astrakhan',
      'Europe/Minsk',
      'Europe/Simferopol',
      'Europe/Ulyanovsk',
      'Europe/Kirov',
      'Europe/Volgograd',
      'Asia/Volgograd'
    ],
    std: {
      abbr: 'MSK',
      name: 'Moscow Standard Time',
      offset: 3
    },
    dst: {},
    long: '(UTC+03:00) Moscow, St. Petersburg',
    hem: 'n'
  },
  {
    name: 'Brasilia Time',
    abbr: null,
    aliases: ['brasilia', 'e. south america standard time', 'east south america'],
    ids: [
      'America/Sao_Paulo',
      'America/Araguaina',
      'America/Bahia',
      'America/Belem',
      'America/Fortaleza',
      'America/Maceio',
      'America/Recife',
      'America/Santarem'
    ],
    std: {
      abbr: 'BRT',
      name: 'Brasilia Standard Time',
      offset: -3
    },
    dst: {},
    long: '(UTC-03:00) Brasilia',
    hem: 's'
  },
  {
    name: 'Mountain Time',
    abbr: 'MT',
    aliases: ['america mountain', 'mountain standard time', 'mountain'],
    ids: [
      'America/Boise',
      'America/Cambridge_Bay',
      'America/Denver',
      'America/Edmonton',
      'America/Inuvik',
      'America/Ojinaga',
      'America/Yellowknife'
    ],
    std: {
      name: 'Mountain Standard Time',
      abbr: 'MST',
      offset: -7
    },
    dst: {
      name: 'Mountain Daylight Time',
      abbr: 'MDT',
      offset: -6
    },
    long: '(UTC-07:00) Mountain Time (US & Canada)',
    hem: 'n'
  },
  {
    name: 'Central Time',
    abbr: 'CT',
    aliases: ['america central', 'central standard time', 'central'],
    ids: [
      'America/Chicago',
      'America/Matamoros',
      'America/Menominee',
      'America/Rainy_River',
      'America/Rankin_Inlet',
      'America/Resolute',
      'America/Winnipeg'
    ],
    std: {
      name: 'Central Standard Time',
      abbr: 'CST',
      offset: -6
    },
    dst: {
      name: 'Central Daylight Time',
      abbr: 'CDT',
      offset: -5
    },
    long: '(UTC-06:00) Central Time (US & Canada)',
    hem: 'n'
  },
  {
    name: 'Central Africa Time',
    abbr: null,
    aliases: ['africa central', 'namibia standard time', 'windhoek', 'namibia'],
    ids: [
      'Africa/Windhoek',
      'Africa/Gaborone',
      'Africa/Harare',
      'Africa/Lubumbashi',
      'Africa/Lusaka',
      'Africa/Maputo'
    ],
    std: {
      name: 'Central Africa Time',
      abbr: 'CAT',
      offset: 2
    },
    dst: {},
    long: '(UTC+02:00) Windhoek',
    hem: 's'
  },
  {
    name: 'Arabian Time',
    abbr: null,
    aliases: ['arabian', 'arab standard time', 'kuwait', 'riyadh', 'arab', 'arabia', 'arabic'],
    ids: ['Asia/Baghdad', 'Asia/Aden', 'Asia/Bahrain', 'Asia/Kuwait', 'Asia/Qatar', 'Asia/Riyadh'],
    std: {
      abbr: 'AST',
      name: 'Arabian Standard Time',
      offset: 3
    },
    dst: {},
    long: '(UTC+03:00) Kuwait, Riyadh',
    hem: 'n'
  },
  {
    name: 'Alaska Time',
    abbr: 'AKT',
    aliases: ['alaska', 'alaskan standard time', 'alaskan'],
    ids: [
      'America/Anchorage',
      'America/Juneau',
      'America/Metlakatla',
      'America/Nome',
      'America/Sitka',
      'America/Yakutat'
    ],
    std: {
      name: 'Alaska Standard Time',
      abbr: 'AKST',
      offset: -9
    },
    dst: {
      name: 'Alaska Daylight Time',
      abbr: 'AKDT',
      offset: -8
    },
    long: '(UTC-09:00) Alaska',
    hem: 'n'
  },
  {
    name: 'Atlantic Time',
    abbr: 'AT',
    aliases: ['atlantic', 'atlantic standard time'],
    ids: [
      'America/Halifax',
      'America/Glace_Bay',
      'America/Goose_Bay',
      'America/Moncton',
      'America/Thule',
      'Atlantic/Bermuda'
    ],
    std: {
      name: 'Atlantic Standard Time',
      abbr: 'AST',
      offset: -4
    },
    dst: {
      name: 'Atlantic Daylight Time',
      abbr: 'ADT',
      offset: -3
    },
    long: '(UTC-04:00) Atlantic Time (Canada)',
    hem: 'n'
  },
  {
    name: 'British Time',
    abbr: null,
    aliases: ['gmt', 'gmt standard time', 'dublin', 'edinburgh', 'lisbon', 'london'],
    ids: [
      'Europe/London',
      'Europe/Dublin',
      'Europe/Guernsey',
      'Europe/Isle_of_Man',
      'Europe/Jersey'
    ],
    std: {
      name: 'Greenwich Mean Time',
      abbr: 'GMT',
      offset: 0
    },
    dst: {
      name: 'British Summer Time',
      abbr: 'BST',
      offset: 1
    },
    long: '(UTC+00:00) Dublin, Edinburgh, Lisbon, London',
    hem: 'n'
  },
  {
    name: 'Central Africa Time',
    dupe: true,
    ids: ['Africa/Blantyre', 'Africa/Bujumbura', 'Africa/Juba', 'Africa/Khartoum', 'Africa/Kigali'],
    std: {
      name: 'Central Africa Time',
      abbr: 'CAT',
      offset: 2
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'West Kazakhstan Time',
    abbr: null,
    aliases: [
      'kazakhstan western',
      'west asia standard time',
      'ashgabat',
      'tashkent',
      'west asia',
      'alma ata'
    ],
    ids: ['Asia/Aqtau', 'Asia/Aqtobe', 'Asia/Atyrau', 'Asia/Oral', 'Asia/Qyzylorda'],
    std: {
      abbr: 'ALMT',
      name: 'Alma-Ata Time',
      offset: 5
    },
    dst: {},
    long: '(UTC+05:00) Ashgabat, Tashkent',
    hem: 'n'
  },
  {
    name: 'Eastern Australia Time',
    abbr: 'AET',
    aliases: [
      'australia eastern',
      'aus eastern standard time',
      'canberra',
      'melbourne',
      'sydney',
      'aus eastern',
      'aus east'
    ],
    ids: [
      'Australia/Sydney',
      'Antarctica/Macquarie',
      'Australia/Currie',
      'Australia/Hobart',
      'Australia/Melbourne'
    ],
    std: {
      name: 'Australian Eastern Standard Time',
      abbr: 'AEST',
      offset: 10
    },
    dst: {
      name: 'Australian Eastern Daylight Time',
      abbr: 'AEDT',
      offset: 11
    },
    long: '(UTC+10:00) Canberra, Melbourne, Sydney',
    hem: 's'
  },
  {
    name: 'Western European Time',
    abbr: null,
    aliases: ['europe western'],
    ids: ['Europe/Lisbon', 'Atlantic/Canary', 'Atlantic/Faeroe', 'Atlantic/Madeira'],
    std: {
      abbr: 'WET',
      name: 'Western European Standard Time',
      offset: 0
    },
    dst: {
      abbr: 'WEST',
      name: 'Western European Summer Time',
      offset: 1
    },
    hem: 'n'
  },
  {
    name: 'Indochina Time',
    abbr: null,
    aliases: [
      'indochina',
      'se asia standard time',
      'bangkok',
      'hanoi',
      'jakarta',
      'se asia',
      'south east asia'
    ],
    ids: ['Asia/Bangkok', 'Asia/Phnom_Penh', 'Asia/Saigon', 'Asia/Vientiane'],
    std: {
      abbr: 'ICT',
      name: 'Indochina Time',
      offset: 7
    },
    dst: {},
    long: '(UTC+07:00) Bangkok, Hanoi, Jakarta',
    hem: 'n'
  },
  {
    name: '',
    dupe: true,
    abbr: 'MT',
    std: {
      name: 'Mountain Standard Time',
      abbr: 'MST',
      offset: -7
    },
    ids: ['America/Phoenix', 'America/Creston', 'America/Dawson_Creek', 'America/Fort_Nelson'],
    hem: 'n'
  },
  {
    name: 'Central Mexico Time',
    long: '(UTC-06:00) Guadalajara, Mexico City, Monterrey',
    aliases: ['guadalajara', 'mexico city', 'monterrey', 'central mexico', 'central mexican'],
    ids: ['America/Mexico_City', 'America/Merida', 'America/Monterrey', 'America/Bahia_Banderas'],
    std: {
      name: 'Central Standard Time',
      abbr: 'CST',
      offset: -6
    },
    dst: {
      name: 'Central Daylight Time',
      abbr: 'CDT',
      offset: -5
    },
    hem: 'n'
  },
  {
    name: 'West Africa Time',
    dupe: true,
    ids: ['Africa/Luanda', 'Africa/Kinshasa', 'Africa/Brazzaville'],
    std: {
      name: 'West Africa Standard Time',
      abbr: 'WAT',
      offset: 1
    },
    hem: 's'
  },
  {
    name: '',
    dupe: true,
    ids: ['Africa/Cairo', 'Africa/Tripoli', 'Europe/Kaliningrad'],
    std: {
      abbr: 'EET',
      name: 'Eastern European Standard Time',
      offset: 2
    },
    hem: 'n'
  },
  {
    name: 'South Africa Time',
    abbr: null,
    aliases: [
      'africa southern',
      'south africa standard time',
      'harare',
      'pretoria',
      'south africa'
    ],
    ids: ['Africa/Johannesburg', 'Africa/Maseru', 'Africa/Mbabane'],
    std: {
      name: 'South Africa Standard Time',
      abbr: 'SAST',
      offset: 2
    },
    dst: {},
    long: '(UTC+02:00) Harare, Pretoria',
    hem: 's'
  },
  {
    name: 'Krasnoyarsk Time',
    abbr: null,
    aliases: ['krasnoyarsk', 'north asia standard time', 'north asia'],
    ids: ['Asia/Krasnoyarsk', 'Asia/Novokuznetsk', 'Asia/Barnaul'],
    std: {
      abbr: 'KRAT',
      name: 'Krasnoyarsk Standard Time',
      offset: 7
    },
    dst: {},
    long: '(UTC+07:00) Krasnoyarsk',
    hem: 'n'
  },
  {
    name: 'Yakutsk Time',
    abbr: null,
    aliases: ['yakutsk', 'yakutsk standard time'],
    ids: ['Asia/Yakutsk', 'Asia/Chita', 'Asia/Khandyga'],
    std: {
      abbr: 'YAKT',
      name: 'Yakutsk Standard Time',
      offset: 9
    },
    dst: {},
    long: '(UTC+09:00) Yakutsk',
    hem: 'n'
  },
  {
    name: 'Pacific Time',
    abbr: 'PT',
    aliases: ['america pacific', 'pacific standard time', 'pacific'],
    ids: ['America/Los_Angeles', 'America/Tijuana', 'America/Vancouver'],
    std: {
      name: 'Pacific Standard Time',
      abbr: 'PST',
      offset: -8
    },
    dst: {
      name: 'Pacific Daylight Time',
      abbr: 'PDT',
      offset: -7
    },
    long: '(UTC-08:00) Pacific Time (US & Canada)',
    hem: 'n'
  },
  {
    name: 'Amazon Time',
    abbr: null,
    aliases: [
      'amazon',
      'central brazilian standard time',
      'cuiaba',
      'central brazilian',
      'central brazil'
    ],
    ids: ['America/Boa_Vista', 'America/Manaus', 'America/Porto_Velho'],
    std: {
      abbr: 'AMT',
      name: 'Amazon Standard Time',
      offset: -4
    },
    dst: {},
    long: '(UTC-04:00) Cuiaba',
    hem: 'n'
  },
  {
    name: 'Morocco Standard Time',
    offset: 1,
    long: '(UTC+00:00) Casablanca',
    aliases: ['casablanca', 'morocco'],
    ids: ['Africa/Casablanca', 'Africa/El_Aaiun'],
    std: {
      abbr: 'WET',
      name: 'Western European Standard Time',
      offset: 1
    },
    dst: {
      abbr: 'WEST',
      name: 'Western European Summer Time',
      offset: 0
    },
    hem: 'n'
  },
  {
    name: '',
    dupe: true,
    ids: ['Africa/Algiers', 'Africa/Tunis'],
    std: {
      abbr: 'CET',
      name: 'Central European Standard Time',
      offset: 1
    },
    dst: {
      abbr: 'CEST',
      name: 'Central European Summer Time',
      offset: 2
    },
    hem: 'n'
  },
  {
    name: '',
    dupe: true,
    ids: ['Asia/Gaza', 'Asia/Hebron'],
    std: {
      abbr: 'EET',
      name: 'Eastern European Standard Time',
      offset: 2
    },
    hem: 'n'
  },
  {
    name: '',
    dupe: true,
    ids: ['Asia/Damascus', 'Asia/Amman'],
    std: {
      abbr: 'EET',
      name: 'Eastern European Standard Time',
      offset: 2
    },
    hem: 'n'
  },
  {
    name: 'Gulf Time',
    abbr: null,
    aliases: ['gulf', 'arabian standard time', 'abu dhabi', 'muscat', 'arabian'],
    ids: ['Asia/Dubai', 'Asia/Muscat'],
    std: {
      name: 'Gulf Standard Time',
      abbr: 'GST',
      offset: 4
    },
    dst: {},
    long: '(UTC+04:00) Abu Dhabi, Muscat',
    hem: 'n'
  },
  {
    name: 'Samara Time',
    abbr: null,
    aliases: ['samara', 'russia time zone 3', 'izhevsk'],
    ids: ['Europe/Samara', 'Europe/Saratov'],
    std: {
      abbr: 'SAMT',
      name: 'Samara Standard Time',
      offset: 4
    },
    dst: {},
    long: '(UTC+04:00) Izhevsk, Samara',
    hem: 'n'
  },
  {
    name: 'Uzbekistan Time',
    abbr: null,
    aliases: ['uzbekistan'],
    ids: ['Asia/Samarkand', 'Asia/Tashkent'],
    std: {
      abbr: 'UZT',
      name: 'Uzbekistan Standard Time',
      offset: 5
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'East Kazakhstan Time',
    abbr: null,
    aliases: ['kazakhstan eastern', 'central asia standard time', 'astana', 'central asia'],
    ids: ['Asia/Almaty', 'Asia/Qostanay'],
    std: {
      abbr: 'ALMT',
      name: 'East Kazakhstan Time',
      offset: 6
    },
    dst: {},
    long: '(UTC+06:00) Astana',
    hem: 'n'
  },
  {
    name: 'Omsk Time',
    abbr: null,
    aliases: ['omsk', 'omsk standard time'],
    ids: ['Asia/Omsk', 'Asia/Tomsk'],
    std: {
      abbr: 'OMST',
      name: 'Omsk Standard Time',
      offset: 6
    },
    dst: {},
    long: '(UTC+06:00) Omsk',
    hem: 'n'
  },
  {
    name: 'Western Indonesia Time',
    abbr: null,
    aliases: ['indonesia western'],
    ids: ['Asia/Jakarta', 'Asia/Pontianak'],
    std: {
      name: 'Western Indonesia Time',
      abbr: 'WIB',
      offset: 7
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Ulaanbaatar Time',
    abbr: null,
    aliases: ['mongolia', 'ulaanbaatar standard time', 'ulaanbaatar'],
    ids: ['Asia/Ulaanbaatar', 'Asia/Choibalsan'],
    std: {
      abbr: 'ULAT',
      name: 'Ulaanbaatar Standard Time',
      offset: 8
    },
    dst: {},
    long: '(UTC+08:00) Ulaanbaatar',
    hem: 'n'
  },
  {
    name: 'Malaysia Time',
    abbr: null,
    aliases: ['malaysia'],
    ids: ['Asia/Kuala_Lumpur', 'Asia/Kuching'],
    std: {
      name: 'Malaysia Time',
      abbr: 'MYT',
      offset: 8
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Korean Time',
    abbr: null,
    aliases: ['korea', 'korea standard time', 'seoul'],
    ids: ['Asia/Seoul', 'Asia/Pyongyang'],
    std: {
      abbr: 'KST',
      name: 'Korean Standard Time',
      offset: 9
    },
    dst: {},
    long: '(UTC+09:00) Seoul',
    hem: 'n'
  },
  {
    name: 'Central Australia Time',
    abbr: 'ACT',
    aliases: ['australia central', 'cen. australia standard time', 'adelaide', 'central australia'],
    ids: ['Australia/Adelaide', 'Australia/Broken_Hill'],
    std: {
      name: 'Australian Central Standard Time',
      abbr: 'ACST',
      offset: 9.5
    },
    dst: {
      name: 'Australian Central Daylight Time',
      abbr: 'ACDT',
      offset: 10.5
    },
    long: '(UTC+09:30) Adelaide',
    hem: 's'
  },
  {
    name: 'Brisbane Time',
    dupe: true,
    ids: ['Australia/Brisbane', 'Australia/Lindeman'],
    std: {
      name: 'Australian Eastern Standard Time',
      abbr: 'AEST',
      offset: 10
    },
    hem: 's'
  },
  {
    name: 'Vladivostok Time',
    abbr: null,
    aliases: ['vladivostok', 'vladivostok standard time'],
    ids: ['Asia/Vladivostok', 'Asia/Ust-Nera'],
    std: {
      abbr: 'VLAT',
      name: 'Vladivostok Standard Time',
      offset: 10
    },
    dst: {},
    long: '(UTC+10:00) Vladivostok',
    hem: 'n'
  },
  {
    name: 'Chamorro Time',
    abbr: null,
    aliases: [
      'chamorro',
      'west pacific standard time',
      'guam',
      'port moresby',
      'west pacific',
      'western pacific'
    ],
    ids: ['Pacific/Guam', 'Pacific/Saipan'],
    std: {
      name: 'Chamorro Standard Time',
      abbr: 'ChST',
      offset: 10
    },
    dst: {},
    long: '(UTC+10:00) Guam, Port Moresby',
    hem: 'n'
  },
  {
    name: 'Papua New Guinea Time',
    abbr: null,
    aliases: ['papua new guinea', 'guinea', 'guinean'],
    ids: ['Pacific/Bougainville', 'Pacific/Port_Moresby'],
    std: {
      abbr: 'PGT',
      name: 'Papua New Guinea Time',
      offset: 11
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'New Zealand Time',
    abbr: 'NZT',
    aliases: ['new zealand', 'new zealand standard time', 'auckland', 'wellington'],
    ids: ['Pacific/Auckland', 'Antarctica/McMurdo'],
    std: {
      name: 'New Zealand Standard Time',
      abbr: 'NZST',
      offset: 12
    },
    dst: {
      name: 'New Zealand Daylight Time',
      abbr: 'NZDT',
      offset: 13
    },
    long: '(UTC+12:00) Auckland, Wellington',
    hem: 's'
  },
  {
    name: 'Marshall Islands Time',
    abbr: null,
    aliases: ['marshall islands'],
    ids: ['Pacific/Kwajalein', 'Pacific/Majuro'],
    std: {
      abbr: 'MHT',
      name: 'Marshall Islands Time',
      offset: 12
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Samoa Time',
    abbr: 'SST',
    aliases: ['samoa', 'samoa standard time'],
    ids: ['Pacific/Midway', 'Pacific/Pago_Pago'],
    std: {
      abbr: 'SST',
      name: 'Samoa Standard Time',
      offset: -11
    },
    dst: {},
    long: '(UTC+13:00) Samoa',
    hem: 'n'
  },
  {
    name: 'Hawaii-Aleutian Time',
    abbr: 'HAT',
    aliases: ['hawaii aleutian', 'aleutian standard time', 'aleutian'],
    ids: ['Pacific/Honolulu', 'Pacific/Johnston'],
    std: {
      name: 'Hawaii-Aleutian Standard Time',
      abbr: 'HAST',
      offset: -9
    },
    dst: {
      name: 'Hawaii-Aleutian Daylight Time',
      abbr: 'HADT',
      offset: -8
    },
    long: '(UTC-09:00) Aleutian Islands',
    hem: 'n'
  },
  {
    name: '',
    dupe: true,
    std: {
      name: 'Mountain Standard Time',
      abbr: 'MST',
      offset: -7
    },
    ids: ['America/Dawson', 'America/Whitehorse'],
    hem: 'n'
  },
  {
    name: 'Mexican Pacific Time',
    abbr: 'HPMX',
    aliases: [
      'mexico pacific',
      'mountain standard time (mexico)',
      'chihuahua',
      'la paz',
      'mazatlan',
      'mountain mexico'
    ],
    ids: ['America/Chihuahua', 'America/Mazatlan'],
    std: {
      name: 'Mexican Pacific Standard Time',
      abbr: 'HNPMX',
      offset: -7
    },
    dst: {
      name: 'Mexican Pacific Daylight Time',
      abbr: 'HEPMX',
      offset: -6
    },
    long: '(UTC-07:00) Chihuahua, La Paz, Mazatlan',
    hem: 'n'
  },
  {
    name: 'Colombia Time',
    abbr: 'COT',
    aliases: ['colombia', 'cost'],
    ids: ['America/Bogota', 'Pacific/Galapagos'],
    std: {
      name: 'Colombia Standard Time',
      abbr: 'COT',
      offset: -5
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Acre Time',
    abbr: null,
    aliases: ['acre'],
    ids: ['America/Eirunepe', 'America/Rio_Branco'],
    std: {
      abbr: 'ACT',
      name: 'Acre Standard Time',
      offset: -5
    },
    dst: {},
    hem: 'n'
  },
  {
    name: '',
    dupe: true,
    ids: ['America/Campo_Grande', 'America/Cuiaba'],
    std: {
      abbr: 'AMT',
      name: 'Amazon Standard Time',
      offset: -4
    },
    hem: 's'
  },
  {
    name: '',
    dupe: true,
    ids: ['Antarctica/Palmer', 'America/Punta_Arenas'],
    std: {
      name: 'Chile Standard Time',
      abbr: 'CLT',
      offset: -3
    },
    hem: 's'
  },
  {
    name: 'Troll Time',
    dupe: true,
    abbr: null,
    aliases: ['troll research station'],
    ids: ['Antarctica/Troll'],
    std: {
      name: 'Greenwich Mean Time',
      abbr: 'GMT',
      offset: 0
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'East Greenland Time',
    abbr: 'HEG',
    aliases: ['greenland eastern'],
    ids: ['America/Scoresbysund'],
    std: {
      name: 'East Greenland Standard Time',
      abbr: 'HNEG',
      offset: 0
    },
    dst: {
      name: 'East Greenland Summer Time',
      abbr: 'HEEG',
      offset: 1
    },
    hem: 'n'
  },
  {
    name: 'Israel Time',
    abbr: null,
    aliases: ['israel', 'israel standard time', 'jerusalem'],
    ids: ['Asia/Jerusalem'],
    std: {
      abbr: 'IST',
      name: 'Israel Standard Time',
      offset: 2
    },
    dst: {
      name: 'Israel Daylight Time',
      offset: 3
    },
    long: '(UTC+02:00) Jerusalem',
    hem: 'n'
  },
  {
    name: 'East Africa Time',
    dupe: true,
    ids: ['Indian/Antananarivo'],
    std: {
      name: 'East Africa Time',
      abbr: 'EAT',
      offset: 3
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Syowa Time',
    abbr: null,
    aliases: ['syowa'],
    ids: ['Antarctica/Syowa'],
    std: {
      abbr: 'SYOT',
      name: 'Syowa Time',
      offset: 3
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Turkey Time',
    abbr: 'TRT',
    aliases: ['turkey', 'turkey standard time', 'istanbul'],
    ids: ['Europe/Istanbul'],
    std: {
      name: 'Turkey Time',
      abbr: 'TRT',
      offset: 3
    },
    dst: {},
    long: '(UTC+03:00) Istanbul',
    hem: 'n'
  },
  {
    name: 'Iran Time',
    abbr: null,
    aliases: ['iran', 'iran standard time', 'tehran'],
    ids: ['Asia/Tehran'],
    std: {
      abbr: 'IRST',
      name: 'Iran Standard Time',
      offset: 3.5
    },
    dst: {
      abbr: 'IRDT',
      name: 'Iran Daylight Time',
      offset: 4.5
    },
    long: '(UTC+03:30) Tehran',
    hem: 'n'
  },
  {
    name: 'Azerbaijan Time',
    abbr: null,
    aliases: ['azerbaijan', 'azerbaijan standard time', 'baku'],
    ids: ['Asia/Baku'],
    std: {
      abbr: 'AZT',
      name: 'Azerbaijan Standard Time',
      offset: 4
    },
    dst: {},
    long: '(UTC+04:00) Baku',
    hem: 'n'
  },
  {
    name: 'Georgia Time',
    abbr: 'GET',
    aliases: ['georgia', 'georgian standard time', 'tbilisi', 'georgian'],
    ids: ['Asia/Tbilisi'],
    std: {
      abbr: 'GET',
      name: 'Georgia Standard Time',
      offset: 4
    },
    dst: {},
    long: '(UTC+04:00) Tbilisi',
    hem: 'n'
  },
  {
    name: 'Armenia Time',
    abbr: 'AMT',
    aliases: ['armenia', 'caucasus standard time', 'yerevan', 'caucasus'],
    ids: ['Asia/Yerevan'],
    std: {
      abbr: 'AMT',
      name: 'Armenia Standard Time',
      offset: 4
    },
    dst: {},
    long: '(UTC+04:00) Yerevan',
    hem: 'n'
  },
  {
    name: 'Seychelles Time',
    abbr: null,
    aliases: ['seychelles'],
    ids: ['Indian/Mahe'],
    std: {
      abbr: 'SCT',
      name: 'Seychelles Time',
      offset: 4
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Mauritius Time',
    abbr: null,
    aliases: ['mauritius', 'mauritius standard time', 'port louis'],
    ids: ['Indian/Mauritius'],
    std: {
      abbr: 'MUT',
      name: 'Mauritius Standard Time',
      offset: 4
    },
    dst: {},
    long: '(UTC+04:00) Port Louis',
    hem: 'n'
  },
  {
    name: 'Réunion Time',
    abbr: null,
    aliases: ['reunion'],
    ids: ['Indian/Reunion'],
    std: {
      abbr: 'RET',
      name: 'Réunion Time',
      offset: 4
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Afghanistan Time',
    abbr: null,
    aliases: ['afghanistan', 'afghanistan standard time', 'kabul'],
    ids: ['Asia/Kabul'],
    std: {
      abbr: 'AFT',
      name: 'Afghanistan Time',
      offset: 4.5
    },
    dst: {},
    long: '(UTC+04:30) Kabul',
    hem: 'n'
  },
  {
    name: 'Mawson Time',
    abbr: null,
    aliases: ['mawson'],
    ids: ['Antarctica/Mawson'],
    std: {
      abbr: 'MAWT',
      name: 'Mawson Time',
      offset: 5
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Turkmenistan Time',
    abbr: 'TMT',
    aliases: ['turkmenistan', 'tmst'],
    ids: ['Asia/Ashgabat'],
    std: {
      name: 'Turkmenistan Standard Time',
      abbr: 'TMT',
      offset: 5
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Tajikistan Time',
    abbr: null,
    aliases: ['tajikistan'],
    ids: ['Asia/Dushanbe'],
    std: {
      abbr: 'TJT',
      name: 'Tajikistan Time',
      offset: 5
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Pakistan Time',
    abbr: null,
    aliases: ['pakistan', 'pakistan standard time', 'islamabad', 'karachi'],
    ids: ['Asia/Karachi'],
    std: {
      abbr: 'PKT',
      name: 'Pakistan Standard Time',
      offset: 5
    },
    dst: {},
    long: '(UTC+05:00) Islamabad, Karachi',
    hem: 'n'
  },
  {
    name: 'Yekaterinburg Time',
    abbr: 'YEKT',
    aliases: ['yekaterinburg', 'ekaterinburg standard time', 'ekaterinburg'],
    ids: ['Asia/Yekaterinburg'],
    std: {
      abbr: 'YEKT',
      name: 'Yekaterinburg Standard Time',
      offset: 5
    },
    dst: {},
    long: '(UTC+05:00) Ekaterinburg',
    hem: 'n'
  },
  {
    name: 'French Southern & Antarctic Time',
    abbr: null,
    aliases: ['french southern'],
    ids: ['Indian/Kerguelen'],
    std: {
      abbr: 'TFT',
      name: 'French Southern & Antarctic Time',
      offset: 5
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Maldives Time',
    abbr: null,
    aliases: ['maldives'],
    ids: ['Indian/Maldives'],
    std: {
      abbr: 'MVT',
      name: 'Maldives Time',
      offset: 5
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Nepal Time',
    abbr: null,
    aliases: ['nepal', 'nepal standard time', 'kathmandu'],
    ids: ['Asia/Katmandu'],
    std: {
      abbr: 'NPT',
      name: 'Nepal Time',
      offset: 5.75
    },
    dst: {},
    long: '(UTC+05:45) Kathmandu',
    hem: 'n'
  },
  {
    name: 'Vostok Time',
    abbr: null,
    aliases: ['vostok'],
    ids: ['Antarctica/Vostok'],
    std: {
      abbr: 'MSK+4',
      name: 'Vostok Time',
      offset: 6
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Kyrgyzstan Time',
    abbr: null,
    aliases: ['kyrgystan'],
    ids: ['Asia/Bishkek'],
    std: {
      abbr: 'KGT',
      name: 'Kyrgyzstan Time',
      offset: 6
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Bangladesh Time',
    abbr: 'BST',
    aliases: ['bangladesh', 'bangladesh standard time', 'dhaka'],
    ids: ['Asia/Dhaka'],
    std: {
      abbr: 'BST',
      name: 'Bangladesh Standard Time',
      offset: 6
    },
    dst: {},
    long: '(UTC+06:00) Dhaka',
    hem: 'n'
  },
  {
    name: 'Bhutan Time',
    abbr: null,
    aliases: ['bhutan'],
    ids: ['Asia/Thimphu'],
    std: {
      name: 'Bhutan Time',
      abbr: 'BT',
      offset: 6
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Indian Ocean Time',
    abbr: null,
    aliases: ['indian ocean', 'indian chagos'],
    ids: ['Indian/Chagos'],
    std: {
      abbr: 'IOT',
      name: 'Indian Ocean Time',
      offset: 6
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Myanmar Time',
    abbr: null,
    aliases: ['myanmar', 'myanmar standard time'],
    ids: ['Asia/Rangoon'],
    std: {
      abbr: 'MMT',
      name: 'Myanmar Time',
      offset: 6.5
    },
    dst: {},
    long: '(UTC+06:30) Yangon (Rangoon)',
    hem: 'n'
  },
  {
    name: 'Cocos Islands Time',
    abbr: null,
    aliases: ['cocos'],
    ids: ['Indian/Cocos'],
    std: {
      abbr: 'CCT',
      name: 'Cocos Islands Time',
      offset: 6.5
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Davis Time',
    abbr: null,
    aliases: ['davis'],
    ids: ['Antarctica/Davis'],
    std: {
      abbr: 'DAVT',
      name: 'Davis Time',
      offset: 7
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Hovd Time',
    abbr: null,
    aliases: ['hovd', 'w. mongolia standard time', 'west mongolia', 'western mongolia'],
    ids: ['Asia/Hovd'],
    std: {
      abbr: 'HOVT',
      name: 'Hovd Standard Time',
      offset: 7
    },
    dst: {},
    long: '(UTC+07:00) Hovd',
    hem: 'n'
  },
  {
    name: 'Novosibirsk Time',
    abbr: null,
    aliases: ['novosibirsk', 'n. central asia standard time', 'north central asia'],
    ids: ['Asia/Novosibirsk'],
    std: {
      abbr: 'NOVT',
      name: 'Novosibirsk Standard Time',
      offset: 7
    },
    dst: {},
    long: '(UTC+07:00) Novosibirsk',
    hem: 'n'
  },
  {
    name: 'Christmas Island Time',
    abbr: null,
    aliases: ['christmas'],
    ids: ['Indian/Christmas'],
    std: {
      abbr: 'CXT',
      name: 'Christmas Island Time',
      offset: 7
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Brunei Darussalam Time',
    abbr: null,
    aliases: ['brunei'],
    ids: ['Asia/Brunei'],
    std: {
      abbr: 'BNT',
      name: 'Brunei Darussalam Time',
      offset: 8
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Hong Kong Time',
    abbr: 'HKT',
    aliases: ['hong kong', 'hkst'],
    ids: ['Asia/Hong_Kong'],
    std: {
      name: 'Hong Kong Standard Time',
      abbr: 'HKT',
      offset: 8
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Irkutsk Time',
    abbr: null,
    aliases: ['irkutsk', 'north asia east standard time', 'north asia east'],
    ids: ['Asia/Irkutsk'],
    std: {
      abbr: 'IRKT',
      name: 'Irkutsk Standard Time',
      offset: 8
    },
    dst: {},
    long: '(UTC+08:00) Irkutsk',
    hem: 'n'
  },
  {
    name: 'Central Indonesia Time',
    abbr: null,
    aliases: ['indonesia central'],
    ids: ['Asia/Makassar'],
    std: {
      name: 'Central Indonesia Time',
      abbr: 'WITA',
      offset: 8
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Philippine Time',
    abbr: null,
    aliases: ['philippines'],
    ids: ['Asia/Manila'],
    std: {
      abbr: 'PHST',
      name: 'Philippine Standard Time',
      offset: 8
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Singapore Time',
    abbr: null,
    aliases: ['singapore', 'singapore standard time', 'kuala lumpur'],
    ids: ['Asia/Singapore'],
    std: {
      name: 'Singapore Standard Time',
      abbr: 'SGT',
      offset: 8
    },
    dst: {},
    long: '(UTC+08:00) Kuala Lumpur, Singapore',
    hem: 's'
  },
  {
    name: 'Taipei Time',
    abbr: null,
    aliases: ['taipei', 'taipei standard time'],
    ids: ['Asia/Taipei'],
    std: {
      abbr: 'CST',
      name: 'Taipei Standard Time',
      offset: 8
    },
    dst: {},
    long: '(UTC+08:00) Taipei',
    hem: 'n'
  },
  {
    name: 'Western Australia Time',
    abbr: 'AWT',
    aliases: [
      'australia western',
      'awdt',
      'w. australia standard time',
      'perth',
      'western australia',
      'west australia'
    ],
    ids: ['Australia/Perth'],
    std: {
      name: 'Australian Western Standard Time',
      abbr: 'AWST',
      offset: 8
    },
    dst: {},
    long: '(UTC+08:00) Perth',
    hem: 's'
  },
  {
    name: 'Australian Central Western Time',
    abbr: 'ACWT',
    aliases: [
      'australia centralwestern',
      'acwdt',
      'aus central w. standard time',
      'eucla',
      'aus central west'
    ],
    ids: ['Australia/Eucla'],
    std: {
      name: 'Australian Central Western Standard Time',
      abbr: 'ACWST',
      offset: 8.75
    },
    dst: {},
    long: '(UTC+08:45) Eucla',
    hem: 's'
  },
  {
    name: 'East Timor Time',
    abbr: 'TLT',
    aliases: ['east timor'],
    ids: ['Asia/Dili'],
    std: {
      abbr: 'TLT',
      name: 'East Timor Time',
      offset: 9
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Eastern Indonesia Time',
    abbr: null,
    aliases: ['indonesia eastern'],
    ids: ['Asia/Jayapura'],
    std: {
      name: 'Eastern Indonesia Time',
      abbr: 'WIT',
      offset: 9
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Japan Time',
    abbr: null,
    aliases: ['japan', 'jdt', 'tokyo standard time', 'osaka', 'sapporo', 'tokyo'],
    ids: ['Asia/Tokyo'],
    std: {
      name: 'Japan Standard Time',
      abbr: 'JST',
      offset: 9
    },
    dst: {},
    long: '(UTC+09:00) Osaka, Sapporo, Tokyo',
    hem: 'n'
  },
  {
    name: 'Palau Time',
    abbr: null,
    aliases: ['palau'],
    ids: ['Pacific/Palau'],
    std: {
      abbr: 'PWT',
      name: 'Palau Time',
      offset: 9
    },
    dst: {},
    hem: 'n'
  },
  {
    name: '',
    dupe: true,
    ids: ['Australia/Darwin'],
    std: {
      name: 'Australian Central Standard Time',
      abbr: 'ACST',
      offset: 9.5
    },
    hem: 's'
  },
  {
    name: 'Dumont-d’Urville Time',
    abbr: null,
    aliases: ['dumontdurville'],
    ids: ['Antarctica/DumontDUrville'],
    std: {
      abbr: 'CLST',
      name: 'Dumont-d’Urville Time',
      offset: 10
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Chuuk Time',
    abbr: null,
    aliases: ['truk'],
    ids: ['Pacific/Truk'],
    std: {
      abbr: 'CHUT',
      name: 'Chuuk Time',
      offset: 10
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Lord Howe Time',
    abbr: 'LHT',
    aliases: ['lord howe', 'lord howe standard time'],
    ids: ['Australia/Lord_Howe'],
    std: {
      name: 'Lord Howe Standard Time',
      abbr: 'LHST',
      offset: 10.5
    },
    dst: {
      name: 'Lord Howe Daylight Time',
      abbr: 'LHDT',
      offset: 11.5
    },
    long: '(UTC+10:30) Lord Howe Island',
    hem: 's'
  },
  {
    name: 'Casey Time',
    abbr: 'CAST',
    aliases: ['casey'],
    ids: ['Antarctica/Casey'],
    std: {
      abbr: 'CAST',
      name: 'Casey Time',
      offset: 11
    },
    dst: {
      name: 'Casey Summer Time',
      offset: 8
    },
    hem: 's'
  },
  {
    name: 'Magadan Time',
    abbr: null,
    aliases: ['magadan', 'magadan standard time'],
    ids: ['Asia/Magadan'],
    std: {
      abbr: 'MAGT',
      name: 'Magadan Standard Time',
      offset: 11
    },
    dst: {},
    long: '(UTC+11:00) Magadan',
    hem: 'n'
  },
  {
    name: 'Sakhalin Time',
    abbr: null,
    aliases: ['sakhalin', 'sakhalin standard time'],
    ids: ['Asia/Sakhalin'],
    std: {
      abbr: 'SAKT',
      name: 'Sakhalin Standard Time',
      offset: 11
    },
    dst: {},
    long: '(UTC+11:00) Sakhalin',
    hem: 'n'
  },
  {
    name: 'Srednekolymsk Time',
    abbr: 'SRET',
    aliases: ['srednekolymsk', 'russia time zone 10', 'chokurdakh'],
    ids: ['Asia/Srednekolymsk'],
    std: {
      abbr: 'SRET',
      name: 'Srednekolymsk Standard Time',
      offset: 11
    },
    dst: {},
    long: '(UTC+11:00) Chokurdakh',
    hem: 'n'
  },
  {
    name: 'Vanuatu Time',
    abbr: null,
    aliases: ['vanuatu'],
    ids: ['Pacific/Efate'],
    std: {
      abbr: 'VUT',
      name: 'Vanuatu Standard Time',
      offset: 11
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Solomon Islands Time',
    abbr: null,
    aliases: ['solomon'],
    ids: ['Pacific/Guadalcanal'],
    std: {
      abbr: 'SBT',
      name: 'Solomon Islands Time',
      offset: 11
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Kosrae Time',
    abbr: null,
    aliases: ['kosrae'],
    ids: ['Pacific/Kosrae'],
    std: {
      abbr: 'KOST',
      name: 'Kosrae Time',
      offset: 11
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'New Caledonia Time',
    abbr: null,
    aliases: ['new caledonia'],
    ids: ['Pacific/Noumea'],
    std: {
      abbr: 'NCT',
      name: 'New Caledonia Standard Time',
      offset: 11
    },
    dst: {
      name: 'New Caledonia Summer Time'
    },
    hem: 'n'
  },
  {
    name: 'Ponape Time',
    abbr: null,
    aliases: ['ponape'],
    ids: ['Pacific/Ponape'],
    std: {
      abbr: 'PONT',
      name: 'Ponape Time',
      offset: 11
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Anadyr Time',
    abbr: null,
    aliases: ['anadyr', 'russia time zone 11', 'petropavlovsk kamchatsky'],
    ids: ['Asia/Anadyr'],
    std: {
      abbr: 'ANAT',
      name: 'Anadyr Standard Time',
      offset: 12
    },
    dst: {},
    long: '(UTC+12:00) Anadyr, Petropavlovsk-Kamchatsky',
    hem: 'n'
  },
  {
    name: 'Petropavlovsk-Kamchatski Time',
    abbr: null,
    aliases: ['kamchatka', 'russia time zone 11', 'anadyr', 'petropavlovsk kamchatsky'],
    ids: ['Asia/Kamchatka'],
    std: {
      abbr: 'PETT',
      name: 'Petropavlovsk-Kamchatski Standard Time',
      offset: 12
    },
    dst: {},
    long: '(UTC+12:00) Anadyr, Petropavlovsk-Kamchatsky',
    hem: 'n'
  },
  {
    name: 'Fiji Time',
    abbr: 'FJT',
    aliases: ['fiji', 'fiji standard time'],
    ids: ['Pacific/Fiji'],
    std: {
      abbr: 'FJT',
      name: 'Fiji Standard Time',
      offset: 12
    },
    dst: {
      abbr: 'FJT',
      name: 'Fiji Summer Time',
      offset: 13
    },
    long: '(UTC+12:00) Fiji',
    hem: 's'
  },
  {
    name: 'Tuvalu Time',
    abbr: 'TVT',
    aliases: ['tuvalu'],
    ids: ['Pacific/Funafuti'],
    std: {
      abbr: 'TVT',
      name: 'Tuvalu Time',
      offset: 12
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Nauru Time',
    abbr: null,
    aliases: ['nauru'],
    ids: ['Pacific/Nauru'],
    std: {
      abbr: 'NRT',
      name: 'Nauru Time',
      offset: 12
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Norfolk Island Time',
    abbr: null,
    aliases: ['norfolk', 'norfolk standard time', 'norfolk island'],
    ids: ['Pacific/Norfolk'],
    std: {
      abbr: 'NFT',
      name: 'Norfolk Island Standard Time',
      offset: 12
    },
    dst: {
      abbr: 'NFDT',
      name: 'Norfolk Island Daylight Time',
      offset: 11
    },
    long: '(UTC+11:00) Norfolk Island',
    hem: 'n'
  },
  {
    name: 'Gilbert Islands Time',
    abbr: null,
    aliases: ['gilbert islands'],
    ids: ['Pacific/Tarawa'],
    std: {
      abbr: 'GILT',
      name: 'Gilbert Islands Time',
      offset: 12
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Wake Island Time',
    abbr: null,
    aliases: ['wake'],
    ids: ['Pacific/Wake'],
    std: {
      abbr: 'WAKT',
      name: 'Wake Island Time',
      offset: 12
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Wallis & Futuna Time',
    abbr: null,
    aliases: ['wallis'],
    ids: ['Pacific/Wallis'],
    std: {
      abbr: 'WFT',
      name: 'Wallis & Futuna Time',
      offset: 12
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Chatham Time',
    abbr: 'CHAT',
    aliases: ['chatham', 'chatham islands standard time', 'chatham islands'],
    ids: ['Pacific/Chatham'],
    std: {
      name: 'Chatham Standard Time',
      abbr: 'CHAST',
      offset: 12.75
    },
    dst: {
      name: 'Chatham Daylight Time',
      abbr: 'CHADT',
      offset: 13.75
    },
    long: '(UTC+12:45) Chatham Islands',
    hem: 's'
  },
  {
    name: 'West Samoa Time',
    abbr: 'WST',
    aliases: ['apia'],
    ids: ['Pacific/Apia'],
    std: {
      abbr: 'WST',
      name: 'West Samoa Time',
      offset: 13
    },
    dst: {
      abbr: 'WST',
      name: 'West Samoa Summer Time',
      offset: 14
    },
    hem: 's'
  },
  {
    name: 'Phoenix Islands Time',
    abbr: null,
    aliases: ['phoenix islands'],
    ids: ['Pacific/Enderbury'],
    std: {
      abbr: 'PHOT',
      name: 'Phoenix Islands Time',
      offset: 13
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Tokelau Time',
    abbr: null,
    aliases: ['tokelau'],
    ids: ['Pacific/Fakaofo'],
    std: {
      abbr: 'TKT',
      name: 'Tokelau Time',
      offset: 13
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Tonga Time',
    abbr: null,
    aliases: ['tonga', 'tonga standard time', "nuku'alofa"],
    ids: ['Pacific/Tongatapu'],
    std: {
      abbr: 'TOT',
      name: 'Tonga Standard Time',
      offset: 13
    },
    dst: {
      name: 'Tonga Summer Time',
      offset: 14
    },
    long: "(UTC+13:00) Nuku'alofa",
    hem: 's'
  },
  {
    name: 'Line Islands Time',
    abbr: null,
    aliases: ['line islands', 'line islands standard time', 'kiritimati island'],
    ids: ['Pacific/Kiritimati'],
    std: {
      abbr: 'LINT',
      name: 'Line Islands Time',
      offset: 14
    },
    dst: {},
    long: '(UTC+14:00) Kiritimati Island',
    hem: 'n'
  },
  {
    name: 'Niue Time',
    abbr: null,
    aliases: ['niue'],
    ids: ['Pacific/Niue'],
    std: {
      abbr: 'NUT',
      name: 'Niue Time',
      offset: -11
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Cook Islands Time',
    abbr: 'CKT',
    aliases: ['cook'],
    ids: ['Pacific/Rarotonga'],
    std: {
      abbr: 'CKT',
      name: 'Cook Islands Standard Time',
      offset: -10
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Tahiti Time',
    abbr: null,
    aliases: ['tahiti'],
    ids: ['Pacific/Tahiti'],
    std: {
      abbr: 'TAHT',
      name: 'Tahiti Time',
      offset: -10
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Marquesas Time',
    abbr: null,
    aliases: ['marquesas', 'marquesas standard time'],
    ids: ['Pacific/Marquesas'],
    std: {
      abbr: 'MART',
      name: 'Marquesas Time',
      offset: -9.5
    },
    dst: {},
    long: '(UTC-09:30) Marquesas Islands',
    hem: 'n'
  },
  {
    name: 'Aleutian Standard Time',
    iso: '(UTC-10:00) Aleutian Islands',
    aliases: ['aleutian'],
    ids: ['America/Adak'],
    abbr: 'HST',
    std: {
      name: 'Hawaii Standard Time',
      abbr: 'HST',
      offset: -10
    },
    dst: {
      name: 'Hawaii Daylight Time',
      abbr: 'HDT',
      offset: -9
    },
    hem: 'n'
  },
  {
    name: 'Gambier Time',
    abbr: null,
    aliases: ['gambier', 'utc-09', 'coordinated universal time-09'],
    ids: ['Pacific/Gambier'],
    std: {
      abbr: 'GAMT',
      name: 'Gambier Time',
      offset: -9
    },
    dst: {},
    long: '(UTC-09:00) Coordinated Universal Time-09',
    hem: 'n'
  },
  {
    name: 'Pitcairn Time',
    abbr: null,
    aliases: ['pitcairn', 'utc-08', 'coordinated universal time-08'],
    ids: ['Pacific/Pitcairn'],
    std: {
      abbr: 'PST',
      name: 'Pitcairn Time',
      offset: -8
    },
    dst: {},
    long: '(UTC-08:00) Coordinated Universal Time-08',
    hem: 'n'
  },
  {
    name: '',
    dupe: true,
    ids: ['America/Hermosillo'],
    std: {
      name: 'Mexican Pacific Standard Time',
      abbr: 'HNPMX',
      offset: -7
    },
    hem: 'n'
  },
  {
    name: 'Northwest Mexico Time',
    abbr: 'HNOMX',
    aliases: [
      'mexico northwest',
      'pacific standard time (mexico)',
      'baja california',
      'pacific mexico'
    ],
    ids: ['America/Santa_Isabel'],
    std: {
      name: 'Northwest Mexico Standard Time',
      abbr: 'HNNOMX',
      offset: -6
    },
    dst: {
      name: 'Northwest Mexico Daylight Time',
      abbr: 'HENOMX',
      offset: -5
    },
    long: '(UTC-08:00) Baja California',
    hem: 'n'
  },
  {
    name: 'Easter Island Time',
    abbr: null,
    aliases: ['easter', 'easter island standard time', 'easter island'],
    ids: ['Pacific/Easter'],
    std: {
      name: 'Easter Island Standard Time',
      abbr: 'EAST',
      offset: -6
    },
    dst: {
      name: 'Easter Island Summer Time',
      abbr: 'EASST',
      offset: -5
    },
    long: '(UTC-06:00) Easter Island',
    hem: 's'
  },
  {
    name: 'Ecuador Time',
    abbr: null,
    aliases: ['ecuador'],
    ids: ['America/Guayaquil'],
    std: {
      name: 'Ecuador Time',
      abbr: 'ECT',
      offset: -5
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Cuba Time',
    abbr: 'HCU',
    aliases: ['cuba', 'cuba standard time', 'havana'],
    ids: ['America/Havana'],
    std: {
      name: 'Cuba Standard Time',
      abbr: 'HNCU',
      offset: -5
    },
    dst: {
      name: 'Cuba Daylight Time',
      abbr: 'HECU',
      offset: -4
    },
    long: '(UTC-05:00) Havana',
    hem: 'n'
  },
  {
    name: 'Peru Time',
    abbr: null,
    aliases: ['peru'],
    ids: ['America/Lima'],
    std: {
      abbr: 'PET',
      name: 'Peru Standard Time',
      offset: -5
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Paraguay Time',
    abbr: null,
    aliases: ['paraguay', 'paraguay standard time', 'asuncion'],
    ids: ['America/Asuncion'],
    std: {
      abbr: 'PYT',
      name: 'Paraguay Standard Time',
      offset: -4
    },
    dst: {
      name: 'Paraguay Summer Time',
      offset: -3
    },
    long: '(UTC-04:00) Asuncion',
    hem: 's'
  },
  {
    name: 'Venezuela Time',
    abbr: null,
    aliases: ['venezuela', 'venezuelan', 'venezuela standard time', 'caracas'],
    ids: ['America/Caracas'],
    std: {
      name: 'Venezuela Time',
      abbr: 'VET',
      offset: -4
    },
    dst: {},
    long: '(UTC-04:00) Caracas',
    hem: 'n'
  },
  {
    name: 'Guyana Time',
    abbr: null,
    aliases: ['guyana'],
    ids: ['America/Guyana'],
    std: {
      name: 'Guyana Time',
      abbr: 'GYT',
      offset: -4
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Bolivia Time',
    abbr: null,
    aliases: ['bolivia'],
    ids: ['America/La_Paz'],
    std: {
      name: 'Bolivia Time',
      abbr: 'BOT',
      offset: -4
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Newfoundland Time',
    abbr: 'HTN',
    aliases: ['newfoundland', 'newfoundland standard time'],
    ids: ['America/St_Johns'],
    std: {
      name: 'Newfoundland Standard Time',
      abbr: 'HNTN',
      offset: -3.5
    },
    dst: {
      name: 'Newfoundland Daylight Time',
      abbr: 'HETN',
      offset: -2.5
    },
    long: '(UTC-03:30) Newfoundland',
    hem: 'n'
  },
  {
    name: 'French Guiana Time',
    abbr: null,
    aliases: ['french guiana'],
    ids: ['America/Cayenne'],
    std: {
      name: 'French Guiana Time',
      abbr: 'GFT',
      offset: -3
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'West Greenland Time',
    abbr: 'HOG',
    aliases: ['greenland western', 'greenland standard time', 'greenland'],
    ids: ['America/Godthab'],
    std: {
      name: 'West Greenland Standard Time',
      abbr: 'HNOG',
      offset: -3
    },
    dst: {
      name: 'West Greenland Summer Time',
      abbr: 'HEOG',
      offset: -2
    },
    long: '(UTC-03:00) Greenland',
    hem: 'n'
  },
  {
    name: 'St. Pierre & Miquelon Time',
    abbr: 'HPM',
    aliases: [
      'pierre miquelon',
      'saint pierre standard time',
      'saint pierre and miquelon',
      'saint pierre'
    ],
    ids: ['America/Miquelon'],
    std: {
      name: 'St. Pierre & Miquelon Standard Time',
      abbr: 'HNPM',
      offset: -3
    },
    dst: {
      name: 'St. Pierre & Miquelon Daylight Time',
      abbr: 'HEPM',
      offset: -2
    },
    long: '(UTC-03:00) Saint Pierre and Miquelon',
    hem: 'n'
  },
  {
    name: 'Uruguay Time',
    abbr: 'UYT',
    aliases: ['uruguay', 'uyst', 'montevideo standard time', 'montevideo'],
    ids: ['America/Montevideo'],
    std: {
      name: 'Uruguay Standard Time',
      abbr: 'UYT',
      offset: -3
    },
    dst: {},
    long: '(UTC-03:00) Montevideo',
    hem: 's'
  },
  {
    name: 'Suriname Time',
    abbr: null,
    aliases: ['suriname'],
    ids: ['America/Paramaribo'],
    std: {
      name: 'Suriname Time',
      abbr: 'SRT',
      offset: -3
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Chile Time',
    abbr: 'CLT',
    aliases: ['chile'],
    ids: ['America/Santiago'],
    std: {
      name: 'Chile Standard Time',
      abbr: 'CLT',
      offset: -3
    },
    dst: {
      name: 'Chile Summer Time',
      abbr: 'CLST',
      offset: -4
    },
    hem: 's'
  },
  {
    name: 'Falkland Islands Time',
    abbr: 'FKT',
    aliases: ['falkland'],
    ids: ['Atlantic/Stanley'],
    std: {
      abbr: 'FKST',
      name: 'Falkland Islands Summer Time',
      offset: -3
    },
    dst: {},
    hem: 's'
  },
  {
    name: 'Fernando de Noronha Time',
    abbr: null,
    aliases: ['noronha'],
    ids: ['America/Noronha'],
    std: {
      abbr: 'FNT',
      name: 'Fernando de Noronha Standard Time',
      offset: -2
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'South Georgia Time',
    abbr: null,
    aliases: ['south georgia'],
    ids: ['Atlantic/South_Georgia'],
    std: {
      abbr: 'GST',
      name: 'South Georgia Time',
      offset: -2
    },
    dst: {},
    hem: 'n'
  },
  {
    name: 'Azores Time',
    abbr: 'AZOT',
    aliases: ['azores', 'azores standard time'],
    ids: ['Atlantic/Azores'],
    std: {
      abbr: 'AZOT',
      name: 'Azores Standard Time',
      offset: -1
    },
    dst: {
      name: 'Azores Summer Time',
      abbr: 'AZOST',
      offset: 0
    },
    long: '(UTC-01:00) Azores',
    hem: 'n'
  },
  {
    name: 'Cape Verde Time',
    abbr: null,
    aliases: ['cape verde', 'cape verde standard time', 'cabo verde'],
    ids: ['Atlantic/Cape_Verde'],
    std: {
      abbr: 'CVT',
      name: 'Cape Verde Standard Time',
      offset: -1
    },
    dst: {},
    long: '(UTC-01:00) Cabo Verde Is.',
    hem: 'n'
  }
];

// const metas = require('../../data/05-metazones')
// import offsets from './offsets.js'

const titleCase = function (str) {
  return str.replace(/\w\S*/g, function (txt) {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  })
};

const display = function (id) {
  if (!id) {
    return null
  }
  let meta = metas.find((obj) => {
    return obj.ids.find((tz) => {
      return tz === id
    })
  });
  if (!meta) {
    let offset = '';//offsets[id.toLowerCase()]
    {
      let abbr = `UTC${offset}`;
      let parts = id.split(/\//);
      let name = titleCase(parts[parts.length - 1]);
      name = name.replace(/_/g, ' ');
      name += ' Time';
      meta = {
        std: { name: name, abbr: abbr },
        offset: null
      };
    }
  }
  return {
    iana: id,
    standard: meta.std || null,
    daylight: meta.dst || null
    // offset: meta.offset - 1 || null
  }
};
var display$1 = display;

var version = '1.3.1';

const soft = function (str) {
  let ids = find$1(str) || [];
  if (typeof ids === 'string') {
    ids = [ids];
  }
  ids = ids.map((id) => display$1(id));
  return ids
};
soft.prototype.version = version;
// export { find, display, version }

export { soft as default };
