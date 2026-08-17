/* ============================================================
   art.js — procedural pixel art.

   There isn't a single image file in this project. Every sprite is
   drawn once into an offscreen canvas at startup and then blitted
   with drawImage(), which is far cheaper than re-running dozens of
   fillRect calls for each of 600 enemies every frame.

   The figure grid is 16 wide x 24 tall. Rows 0-6 are "headroom" so
   tall hats (Lincoln's stovepipe, a pickelhaube spike) have somewhere
   to go without clipping.
   ============================================================ */

/* The figure is AUTHORED on a 16x24 grid, but every block is emitted at
   2x into a 32x48 sprite. That buys room for edge shading, outlines and
   finer features without rewriting a single coordinate — the 8-bit
   silhouettes stay, the 8-bit chunkiness doesn't. Sprite `scale` values
   in the data files are halved to keep on-screen size unchanged. */
const PW = 16, PH = 24;   // authoring grid
const D = 2;              // detail multiplier: authoring px -> sprite px
const HH = 4;             // headroom: body starts this far down

const Art = {
  cache: new Map(),
  ground: null,
  shadow: null,

  /* --------------------------------------------------------
     Core: make (or fetch) a cached offscreen canvas.
     `scale` multiplies logical pixels into device pixels.
     -------------------------------------------------------- */
  make(key, w, h, scale, drawFn) {
    const hit = this.cache.get(key);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * scale);
    c.height = Math.ceil(h * scale);
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.scale(scale, scale);
    drawFn(x, w, h);
    this.cache.set(key, c);
    return c;
  },

  clear() { this.cache.clear(); },

  /* ========================================================
     THE FIGURE
     ======================================================== */

  /**
   * spec: {
   *   key, skin, hair, hairStyle, coat, coatAlt, pants, shoes,
   *   shirt, tie, hat, hatCol, hatAccent, face, hold, holdCol,
   *   undead, boss, scale, chair
   * }
   */
  person(spec, frame) {
    const key = 'p:' + spec.key + ':' + frame;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const s = spec.scale || 0.9;
    const base = document.createElement('canvas');
    base.width = Math.ceil(PW * D * s);
    base.height = Math.ceil(PH * D * s);
    const bx = base.getContext('2d');
    bx.imageSmoothingEnabled = false;
    bx.scale(s, s);
    this._drawPerson(bx, spec, frame);

    // Every figure gets a dark contour; bosses get a thicker coloured one
    // so they stay legible inside a 600-enemy crowd. Both are the same
    // trick: flatten to a silhouette, tint it, and smear it underneath.
    const rim = spec.boss ? 2 : 1;
    const w = base.width + rim * 2, h = base.height + rim * 2;

    const sil = document.createElement('canvas');
    sil.width = w; sil.height = h;
    const sx = sil.getContext('2d');
    sx.imageSmoothingEnabled = false;
    sx.drawImage(base, rim, rim);
    sx.globalCompositeOperation = 'source-in';
    sx.fillStyle = spec.boss ? (spec.bossRim || 'rgba(242,193,78,.92)') : 'rgba(14,12,20,.9)';
    sx.fillRect(0, 0, w, h);

    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ox = out.getContext('2d');
    ox.imageSmoothingEnabled = false;
    for (let dx = -rim; dx <= rim; dx++) {
      for (let dy = -rim; dy <= rim; dy++) {
        if (dx || dy) ox.drawImage(sil, dx, dy);
      }
    }
    ox.drawImage(base, rim, rim);

    this.cache.set(key, out);
    return out;
  },

  _drawPerson(c, s, frame) {
    /* Emits every authored block at 2x, with a lit top-left edge and a
       shadowed bottom-right. One light direction, applied automatically to
       every block in every sprite — that consistency is most of what
       separates a 16-bit look from a flat one. Blocks smaller than 2x2 stay
       flat, since edge shading on an eye pixel is just noise. */
    const px = (x, y, w, h, col) => {
      const X = x * D, Y = y * D, W = w * D, H = h * D;
      c.fillStyle = col;
      c.fillRect(X, Y, W, H);
      if (w >= 2 && h >= 2) {
        c.fillStyle = shade(col, 0.22); c.fillRect(X, Y, W, 1);
        c.fillStyle = shade(col, 0.10); c.fillRect(X, Y, 1, H);
        c.fillStyle = shade(col, -0.30); c.fillRect(X, Y + H - 1, W, 1);
        c.fillStyle = shade(col, -0.18); c.fillRect(X + W - 1, Y, 1, H);
      }
    };
    // Fine-resolution helpers, for detail below the authoring grid.
    const fp = (X, Y, W, H, col) => { c.fillStyle = col; c.fillRect(X, Y, W, H); };
    const clr = (x, y, w, h) => c.clearRect(x * D, y * D, w * D, h * D);

    const skin = s.undead ? (s.skin || '#8fae72') : (s.skin || '#e0ac83');
    const skinD = shade(skin, -0.26);
    const coat = s.coat || '#2b3350';
    const coatD = shade(coat, -0.3);
    const coatL = shade(coat, 0.16);
    const pants = s.pants || shade(coat, -0.18);
    const shoes = s.shoes || '#1a1a22';
    const hair = s.hair || '#3a2a1c';
    const bob = frame === 1 ? 1 : 0;     // 1px vertical bounce on the off-step
    const B = HH - bob;                   // body y-origin for this frame

    /* ---- mounted: a horse is drawn beneath the rider ---- */
    if (s.mounted) {
      const hide = s.horse || '#6a4a2e';
      const hideD = shade(hide, -0.3), hideL = shade(hide, 0.16);
      px(1, B + 14, 12, 6, hide);                    // barrel
      px(1, B + 14, 12, 2, hideL);
      px(12, B + 10, 4, 5, hide);                    // neck
      px(13, B + 8, 3, 4, hide);                     // head
      px(15, B + 10, 1, 2, hideD);                   // muzzle
      px(13, B + 7, 1, 2, hideD);                    // ear
      px(0, B + 12, 2, 5, hideD);                    // tail
      const gait = frame === 1 ? 1 : 0;
      px(2 + gait, B + 20, 2, 4, hideD);
      px(5, B + 20, 2, 4, hide);
      px(9 - gait, B + 20, 2, 4, hideD);
      px(11, B + 20, 2, 4, hide);
      px(4, B + 13, 7, 1, '#4a3420');                // saddle blanket
    }

    /* ---- quadruped (Buddy) takes an entirely different silhouette ---- */
    if (s.dog) {
      const body = s.coat || '#6a4a2a';
      const dark = shade(body, -0.28);
      const lite = shade(body, 0.16);
      px(2, B + 9, 3, 3, dark);                       // tail
      px(3, B + 11, 9, 6, body);                      // torso
      px(3, B + 11, 9, 2, lite);
      px(10, B + 8, 6, 6, body);                      // head
      px(10, B + 8, 6, 1, lite);
      px(14, B + 11, 2, 3, dark);                     // muzzle
      px(15, B + 12, 1, 1, '#20140f');                // nose
      px(10, B + 6, 2, 3, dark);                      // ear
      px(13, B + 10, 1, 1, s.undead ? (s.eye || '#c8ff4a') : '#20232e');
      const step = frame === 1 ? 1 : 0;
      px(4 + step, B + 17, 2, 4, dark);
      px(7, B + 17, 2, 4, body);
      px(10 - step, B + 17, 2, 4, dark);
      px(9, B + 11, 1, 6, '#c02a3a');                 // collar
      px(9, B + 14, 1, 1, '#f2c14e');                 // tag
      return;
    }

    /* ---- FDR rides in; the chair is drawn behind everything ---- */
    if (s.chair) {
      const ch = s.chairCol || '#5a5f6e';
      const chD = shade(ch, -0.35);
      px(2, B + 14, 12, 2, chD);                 // seat frame
      px(1, B + 10, 2, 6, ch);                   // back rest
      // two wheels, spokes rotated by frame for a sense of rolling
      for (const wx of [3, 11]) {
        px(wx - 2, B + 16, 5, 5, chD);
        px(wx - 1, B + 17, 3, 3, '#20242e');
        if (frame === 0) { px(wx, B + 16, 1, 5, ch); px(wx - 2, B + 18, 5, 1, ch); }
        else { px(wx - 1, B + 17, 1, 1, ch); px(wx + 1, B + 19, 1, 1, ch); px(wx + 1, B + 17, 1, 1, ch); px(wx - 1, B + 19, 1, 1, ch); }
      }
      px(0, B + 12, 1, 3, '#8a8f9e');            // push rim glint
    }

    /* ---- legs & shoes ---- */
    if (s.mounted) {
      px(4, B + 12, 3, 4, pants);                    // legs astride
      px(9, B + 12, 3, 4, pants);
      px(4, B + 16, 3, 2, shoes);
      px(9, B + 16, 3, 2, shoes);
    } else if (!s.chair) {
      const swing = frame === 1 ? 1 : 0;
      px(5, B + 15, 2, 3, pants);
      px(9, B + 15, 2, 3, s.goldleg ? '#f2c14e' : pants);
      px(4 + swing, B + 18, 3, 2, shoes);
      px(9 - swing, B + 18, 3, 2, s.goldleg ? '#c8901a' : shoes);
    } else {
      px(5, B + 15, 6, 3, pants);                // seated lap
      px(4, B + 17, 3, 2, shoes);
      px(9, B + 17, 3, 2, shoes);
    }

    /* ---- arms (behind the torso silhouette) ---- */
    const armY = B + 9;
    px(2, armY, 2, 5, coatD);
    px(12, armY, 2, 5, coatD);
    px(2, armY + 5, 2, 1, skin);                 // hands
    px(12, armY + 5, 2, 1, skin);

    /* ---- torso ---- */
    px(4, B + 8, 8, 7, coat);
    px(4, B + 8, 8, 1, coatL);                   // shoulder highlight
    px(4, B + 8, 1, 7, coatD);                   // left shadow edge

    // shirt / vest wedge
    const shirt = s.shirt || '#e8e4d8';
    px(6, B + 8, 4, 5, shirt);

    // Lapels cut in from the coat, plus a button row and a collar shadow.
    const tx = 4 * D, ty = (B + 8) * D;
    fp(tx + 3, ty + 1, 2, 7, shade(coat, 0.20));             // left lapel edge
    fp(tx + 11, ty + 1, 2, 7, shade(coat, -0.22));           // right lapel edge
    fp(tx + 4, ty, 8, 2, shade(shirt, -0.20));               // collar shadow
    for (let bi = 0; bi < 3; bi++) {
      fp(tx + 7, ty + 7 + bi * 3, 1, 1, shade(coat, 0.42));  // buttons
    }
    fp(tx, ty + 12, 16, 1, shade(coat, -0.26));              // waist seam
    if (s.coatAlt) { px(5, B + 9, 1, 5, s.coatAlt); px(10, B + 9, 1, 5, s.coatAlt); }

    // necktie / cravat
    if (s.tie) { px(7, B + 8, 2, 1, s.tie); px(7, B + 9, 2, 3, s.tie); px(7, B + 12, 2, 1, shade(s.tie, -0.2)); }

    // flag pin, because of course
    if (s.pin) { px(10, B + 9, 1, 1, '#d8324a'); }

    /* ---- undead: ragged coat hem ---- */
    if (s.undead) {
      clr(4, B + 13, 1, 2);
      clr(7, B + 14, 1, 1);
      clr(10, B + 13, 1, 2);
    }

    /* ---- head ---- */
    px(5, B + 3, 6, 5, skin);
    px(4, B + 5, 1, 2, skin);                    // ears
    px(11, B + 5, 1, 2, skin);

    // Sub-grid facial modelling: a brow ridge, a nose with a lit side and a
    // cast shadow, hollow temples and a soft jawline. None of this fits on
    // the authoring grid — it's the whole reason for rendering at 2x.
    const hx = 5 * D, hy = (B + 3) * D;
    fp(hx, hy, 6 * D, 2, shade(skin, 0.20));                 // forehead light
    fp(hx, hy + 3, 6 * D, 1, shade(skin, -0.14));            // brow ridge
    fp(hx + 5, hy + 5, 2, 4, shade(skin, 0.14));             // bridge of nose
    fp(hx + 7, hy + 7, 1, 2, shade(skin, -0.24));            // nose shadow
    fp(hx + 1, hy + 6, 1, 3, shade(skin, -0.16));            // temple hollow
    fp(hx + 10, hy + 6, 1, 3, shade(skin, -0.20));
    fp(hx + 2, hy + 9, 8, 1, shade(skin, -0.10));            // cheek line
    fp(hx, hy + 5 * D - 2, 6 * D, 2, skinD);                 // jaw shadow

    /* ---- eyes ---- */
    if (s.face === 'gasmask') {
      px(4, B + 3, 8, 5, '#4a5240');
      px(5, B + 4, 2, 2, '#111');
      px(9, B + 4, 2, 2, '#111');
      px(7, B + 6, 2, 3, '#2e3428');             // filter canister
    } else if (s.face === 'shades') {
      px(5, B + 4, 6, 2, '#15161d');
      px(4, B + 4, 1, 1, '#15161d'); px(11, B + 4, 1, 1, '#15161d');
      px(6, B + 4, 1, 1, '#5a7fb8');             // lens glint
    } else if (s.undead) {
      px(6, B + 4, 1, 2, '#20140f');             // hollow sockets
      px(9, B + 4, 1, 2, '#20140f');
      px(6, B + 4, 1, 1, s.eye || '#c8ff4a');    // glowing pinprick
      px(9, B + 4, 1, 1, s.eye || '#c8ff4a');
      px(6, B + 7, 4, 1, '#3a2418');             // slack jaw
      px(6, B + 7, 1, 1, '#d8d0bc'); px(9, B + 7, 1, 1, '#d8d0bc'); // teeth
    } else {
      px(6, B + 4, 1, 2, '#20232e');
      px(9, B + 4, 1, 2, '#20232e');
      px(6, B + 4, 1, 1, '#fff'); px(9, B + 4, 1, 1, '#fff');
    }

    if (s.face === 'glasses') {
      px(5, B + 4, 3, 1, '#20232e'); px(8, B + 4, 3, 1, '#20232e');
      px(5, B + 5, 1, 1, '#20232e'); px(10, B + 5, 1, 1, '#20232e');
      px(7, B + 4, 2, 1, '#20232e');
    }
    if (s.face === 'mustache' || s.stache) px(6, B + 6, 4, 1, s.facialCol || hair);
    if (s.face === 'beard') {
      px(5, B + 6, 6, 2, s.facialCol || hair);
      px(6, B + 8, 4, 1, s.facialCol || hair);
      px(7, B + 6, 2, 1, shade(skin, -0.05));    // Lincoln's bare upper lip
    }
    if (s.face === 'fullbeard') { px(4, B + 5, 8, 4, s.facialCol || hair); px(6, B + 6, 4, 1, '#000'); }

    /* ---- hair ---- */
    this._hair(c, s, B, hair, px);

    /* ---- hat ---- */
    this._hat(c, s, B, px);

    /* ---- held item ---- */
    if (s.hold) this._hold(c, s, B, px);
    // (bosses get their outline added by person(), after this renders)
  },

  _hair(c, s, B, hair, px) {
    switch (s.hairStyle) {
      case 'wig':      // powdered colonial wig: curled rolls over the ears
        px(4, B + 2, 8, 2, hair);
        px(3, B + 4, 2, 4, hair); px(11, B + 4, 2, 4, hair);
        px(3, B + 4, 1, 1, shade(hair, 0.2)); px(12, B + 4, 1, 1, shade(hair, 0.2));
        px(6, B + 8, 4, 1, hair);   // queue at the nape
        break;
      case 'tall':     // Lincoln's untidy vertical hair
        px(4, B + 1, 8, 3, hair);
        px(4, B + 2, 1, 3, hair); px(11, B + 2, 1, 3, hair);
        px(5, B, 2, 1, hair); px(9, B, 1, 1, hair);
        break;
      case 'swoop':    // combed forward, then hard right
        px(4, B + 1, 9, 3, hair);
        px(4, B + 3, 2, 1, hair);
        px(11, B + 2, 3, 2, hair);
        px(5, B + 1, 5, 1, shade(hair, 0.22));
        break;
      case 'poof':     // pompadour
        px(4, B + 1, 8, 3, hair);
        px(5, B, 6, 1, hair);
        px(4, B + 3, 1, 3, hair); px(11, B + 3, 1, 3, hair);
        px(6, B, 3, 1, shade(hair, 0.2));
        break;
      case 'crop':     // short, close
        px(4, B + 2, 8, 2, hair);
        px(4, B + 4, 1, 3, hair); px(11, B + 4, 1, 3, hair);
        break;
      case 'part':     // side part
        px(4, B + 2, 8, 2, hair);
        px(4, B + 4, 1, 2, hair); px(11, B + 4, 1, 2, hair);
        px(8, B + 2, 1, 1, shade(hair, 0.25));
        break;
      case 'thin':     // receding, gray at the sides
        px(4, B + 2, 8, 1, hair);
        px(4, B + 3, 2, 4, hair); px(10, B + 3, 2, 4, hair);
        break;
      case 'bald':
        px(4, B + 4, 1, 3, hair); px(11, B + 4, 1, 3, hair);
        break;
      case 'none': break;
      default:
        px(4, B + 2, 8, 2, hair);
        px(4, B + 4, 1, 2, hair); px(11, B + 4, 1, 2, hair);
    }
  },

  _hat(c, s, B, px) {
    const h = s.hatCol || '#1c1c26';
    const hD = shade(h, -0.3), hL = shade(h, 0.18);
    const acc = s.hatAccent || '#c8a23a';
    switch (s.hat) {
      case 'tricorn':
        px(2, B + 1, 12, 2, h);
        px(4, B - 1, 8, 2, h);
        px(2, B + 1, 2, 1, hL); px(12, B + 1, 2, 1, hL);
        px(4, B, 8, 1, hD);
        px(11, B, 2, 2, acc);            // cockade
        break;
      case 'stovepipe':
        px(3, B + 1, 10, 2, h);          // brim
        px(4, B - 4, 8, 5, h);           // crown
        px(4, B - 4, 8, 1, hL);
        px(4, B - 1, 8, 1, hD);          // hatband
        break;
      case 'campaign':                   // Rough Rider slouch hat
        px(2, B + 1, 12, 2, h);
        px(4, B - 1, 8, 2, h);
        px(4, B, 8, 1, acc);
        px(7, B - 1, 2, 1, hD);          // pinch
        break;
      case 'fedora':
        px(3, B + 1, 10, 1, h);
        px(4, B - 1, 8, 2, h);
        px(4, B, 8, 1, hD);
        break;
      case 'cap':                        // ball cap
        px(4, B, 8, 2, h);
        px(9, B + 1, 5, 1, h);           // bill
        px(4, B, 8, 1, hL);
        break;
      case 'peaked':                     // officer's cap
        px(4, B - 1, 8, 3, h);
        px(3, B + 1, 10, 1, hD);         // visor
        px(4, B + 1, 8, 1, acc);         // band
        px(7, B, 2, 1, acc);             // insignia
        break;
      case 'brodie':                     // WWI soup-plate helmet
        px(2, B + 1, 12, 1, h);
        px(4, B - 1, 8, 2, h);
        px(4, B - 1, 8, 1, hL);
        break;
      case 'stahlhelm':                  // WWII German helmet
        px(3, B, 10, 3, h);
        px(3, B + 2, 1, 2, h); px(12, B + 2, 1, 2, h);
        px(4, B, 8, 1, hL);
        break;
      case 'pickelhaube':
        px(4, B, 8, 3, h);
        px(7, B - 4, 2, 4, '#b8bcc6');   // spike
        px(3, B + 2, 10, 1, hD);
        px(7, B + 1, 2, 1, acc);
        break;
      case 'ushanka':
        px(3, B - 1, 10, 4, h);
        px(2, B + 2, 2, 3, hD); px(12, B + 2, 2, 3, hD);  // ear flaps
        px(7, B, 2, 2, '#d8324a');       // red star
        break;
      case 'shako':                      // tall military dress cap
        px(4, B - 3, 8, 5, h);
        px(3, B + 2, 10, 1, hD);
        px(4, B, 8, 1, acc);
        px(7, B - 4, 2, 2, '#d8324a');   // plume
        break;
      case 'sombrero':
        px(0, B + 1, 16, 2, h);
        px(5, B - 2, 6, 3, h);
        px(5, B, 6, 1, acc);
        px(0, B + 1, 16, 1, hL);
        break;
      case 'kepi':
        px(4, B, 8, 3, h);
        px(8, B + 2, 6, 1, hD);
        px(4, B + 1, 8, 1, acc);
        break;
      case 'turban':                     // wrapped field headwear
        px(3, B, 10, 4, h);
        px(3, B + 1, 10, 1, hL);
        px(3, B + 3, 4, 2, h);
        break;
      case 'crown':
        px(3, B, 10, 3, '#f2c14e');
        px(3, B - 2, 2, 3, '#f2c14e'); px(7, B - 3, 2, 4, '#f2c14e'); px(11, B - 2, 2, 3, '#f2c14e');
        px(4, B + 1, 1, 1, '#d8324a'); px(8, B + 1, 1, 1, '#3f6fd8'); px(11, B + 1, 1, 1, '#d8324a');
        px(3, B, 10, 1, '#fff0b8');
        break;
      case 'none': default: break;
    }
  },

  _hold(c, s, B, px) {
    const col = s.holdCol || '#8a6a3a';
    switch (s.hold) {
      case 'musket': px(13, B + 4, 1, 10, col); px(13, B + 3, 1, 2, '#b8bcc6'); break;
      case 'rifle':  px(13, B + 6, 1, 8, '#2a2a30'); px(12, B + 12, 2, 1, col); break;
      case 'saber':  px(13, B + 4, 1, 8, '#c8ccd6'); px(12, B + 12, 3, 1, col); break;
      case 'bottle': px(12, B + 12, 2, 3, '#6a8a4a'); px(12, B + 11, 1, 1, '#c8b88a'); break;
      case 'flag':   px(13, B + 2, 1, 12, col); px(14, B + 2, 2, 4, s.flagCol || '#d8324a'); break;
      case 'club':   px(13, B + 6, 1, 8, col); px(12, B + 13, 3, 2, '#c8ccd6'); break;
      case 'lantern':px(12, B + 11, 2, 3, '#f2c14e'); break;
      case 'quill':  px(13, B + 3, 1, 6, '#f4efe2'); px(13, B + 2, 1, 2, shade(col, 0.3));
                     px(12, B + 9, 2, 1, '#2a2a34'); break;
      default: break;
    }
  },

  /* ========================================================
     WORLD + EFFECT SPRITES
     ======================================================== */

  /** Soft elliptical drop shadow, drawn under every actor. */
  getShadow() {
    if (this.shadow) return this.shadow;
    const c = document.createElement('canvas');
    c.width = 32; c.height = 14;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(16, 7, 1, 16, 7, 15);
    g.addColorStop(0, 'rgba(0,0,0,.5)');
    g.addColorStop(0.6, 'rgba(0,0,0,.22)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.beginPath(); x.ellipse(16, 7, 15, 6.5, 0, 0, TAU); x.fill();
    this.shadow = c;
    return c;
  },

  /**
   * The battlefield tile. Deterministic noise so it tiles seamlessly
   * and looks the same every run.
   */
  makeGround(paletteId) {
    paletteId = paletteId || 'colonial';
    const key = 'ground:' + paletteId;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const P = (typeof PALETTES !== 'undefined' && PALETTES[paletteId]) || null;
    const S = 128;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const x = c.getContext('2d');
    const r = makeRng(9001);

    const TURF = P ? P.turf : '#2f4526';
    const TALT = P ? P.turfAlt : ['#35502a', '#294020', '#3c5a2e', '#416432', '#243a1c'];
    x.fillStyle = TURF; x.fillRect(0, 0, S, S);

    // Broad tonal patches first, so the turf reads as uneven ground rather
    // than uniform noise, then finer mottling on top of that.
    for (let i = 0; i < 26; i++) {
      const px = r() * S, py = r() * S, rr = 14 + r() * 30;
      x.fillStyle = r() < 0.5 ? shade(TURF, 0.18) : shade(TURF, -0.22);
      x.globalAlpha = 0.3;
      x.beginPath(); x.ellipse(px, py, rr, rr * 0.7, r() * TAU, 0, TAU); x.fill();
    }
    x.globalAlpha = 1;
    const GRASS = TALT;
    for (let i = 0; i < 2600; i++) {
      const px = (r() * S) | 0, py = (r() * S) | 0;
      x.fillStyle = GRASS[(r() * GRASS.length) | 0];
      x.fillRect(px, py, 1, 1);
    }
    // dirt patches
    for (let i = 0; i < 14; i++) {
      const px = r() * S, py = r() * S, rr = 6 + r() * 16;
      x.fillStyle = 'rgba(88,72,46,.32)';
      x.beginPath(); x.ellipse(px, py, rr, rr * 0.6, r() * TAU, 0, TAU); x.fill();
    }
    // grass tufts, stones and the odd wildflower, each with a lit edge
    for (let i = 0; i < 70; i++) {
      const px = (r() * S) | 0, py = (r() * S) | 0;
      const t = r();
      if (t < 0.62) {
        x.fillStyle = shade(TURF, -0.25); x.fillRect(px, py + 1, 1, 3);
        x.fillStyle = shade(TURF, 0.32); x.fillRect(px, py, 1, 3);
        x.fillStyle = shade(TURF, 0.46); x.fillRect(px + 2, py + 1, 1, 2);
      } else if (t < 0.88) {
        x.fillStyle = '#4a4a44'; x.fillRect(px, py + 1, 4, 2);
        x.fillStyle = '#7a7a70'; x.fillRect(px, py, 3, 2);
        x.fillStyle = '#9a9a90'; x.fillRect(px, py, 2, 1);
      } else {
        x.fillStyle = '#2a4520'; x.fillRect(px, py + 1, 1, 2);
        x.fillStyle = r() < 0.5 ? '#d8d05a' : '#d88ab0'; x.fillRect(px, py, 1, 1);
      }
    }
    this.cache.set(key, c);
    return c;
  },

  /* ========================================================
     PER-STAGE SPRITE LIFECYCLE

     Warming all eleven stages at boot would build well over a
     thousand sprites and hold them all in memory for no reason. So
     each stage warms only what it uses, and the stage before it is
     evicted. Stage-scoped keys are prefixed 'stage:<id>:' precisely
     so they can be dropped as a group.
     ======================================================== */
  warmStage(st) {
    this.makeGround(st.palette);
    for (const b of st.buildings) this.building(b);
    const seen = new Set();
    for (const fid of st.factions) {
      const f = (typeof FACTION_BY_ID !== 'undefined') && FACTION_BY_ID[fid];
      if (!f) continue;
      for (const u of f.units) {
        if (!u.sprite || seen.has(u.sprite.key)) continue;
        seen.add(u.sprite.key);
        this.person(u.sprite, 0); this.person(u.sprite, 1);
      }
    }
    const boss = (typeof STAGE_BOSSES !== 'undefined') && STAGE_BOSSES[st.boss];
    if (boss && boss.sprite) { this.person(boss.sprite, 0); this.person(boss.sprite, 1); }
  },

  /** Drop every sprite belonging to a stage we've left. */
  evictStage(stageId) {
    const pre = 'stage:' + stageId + ':';
    const doomed = [];
    this.cache.forEach((v, k) => { if (k.indexOf(pre) === 0) doomed.push(k); });
    for (const k of doomed) this.cache.delete(k);
    return doomed.length;
  },

  /* ---- XP gems: little faceted crystals ---- */
  gem(tier) {
    const cols = [
      ['#7fd4ff', '#2b7fd6', '#e8f6ff'],   // blue
      ['#7ee88a', '#2f9a45', '#dcffe2'],   // green
      ['#ffd35e', '#c88a12', '#fff3cf'],   // gold
      ['#ff8fd0', '#c22e8a', '#ffe0f2']    // pink (rare)
    ][tier];
    const sz = [7, 8, 9, 10][tier];
    return this.make('gem' + tier, sz, sz, 2, (c) => {
      c.fillStyle = cols[1];
      c.beginPath();
      c.moveTo(sz / 2, 0); c.lineTo(sz, sz / 2); c.lineTo(sz / 2, sz); c.lineTo(0, sz / 2);
      c.closePath(); c.fill();
      c.fillStyle = cols[0];
      c.beginPath();
      c.moveTo(sz / 2, 1); c.lineTo(sz - 1.5, sz / 2); c.lineTo(sz / 2, sz / 2); c.closePath(); c.fill();
      c.fillStyle = cols[2];
      c.fillRect(sz / 2 - 0.5, 1.5, 1, 1.5);
    });
  },

  /* ---- pickups ---- */
  pickup(kind) {
    return this.make('pk:' + kind, 14, 14, 2, (c) => {
      const px = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
      switch (kind) {
        case 'food':   // turkey leg
          px(5, 2, 5, 6, '#a8642c'); px(6, 2, 3, 2, '#c9803e');
          px(6, 8, 3, 4, '#efe4cf'); px(5, 11, 5, 2, '#efe4cf');
          break;
        case 'magnet':
          px(3, 2, 3, 8, '#d8324a'); px(8, 2, 3, 8, '#d8324a');
          px(3, 9, 8, 3, '#d8324a');
          px(3, 2, 3, 2, '#c8ccd6'); px(8, 2, 3, 2, '#c8ccd6');
          break;
        case 'bomb':   // Executive Order — a sealed scroll
          px(2, 4, 10, 6, '#efe4cf'); px(2, 4, 10, 1, '#cfc4ae');
          px(6, 6, 6, 1, '#8a8578'); px(6, 8, 4, 1, '#8a8578');
          px(2, 3, 2, 8, '#c9a24a'); px(10, 3, 2, 8, '#c9a24a');
          px(5, 9, 3, 3, '#d8324a');  // wax seal
          break;
        case 'chest':  // ballot box
          px(2, 4, 10, 8, '#4a3a28'); px(2, 4, 10, 2, '#6a5238');
          px(2, 7, 10, 1, '#f2c14e');
          px(5, 3, 4, 2, '#efe4cf');  // ballot sticking out
          px(6, 9, 2, 2, '#f2c14e');  // latch
          break;
        case 'coin':
          px(3, 3, 8, 8, '#f2c14e'); px(4, 4, 6, 6, '#ffe08a');
          px(6, 5, 2, 4, '#c8901a');
          break;
      }
    });
  },

  /**
   * Recolor an existing sprite by painting over its opaque pixels.
   * Lets one plane sprite serve as both a red triplane and a gray Zero.
   */
  tinted(src, key, tint, alpha) {
    const hit = this.cache.get(key);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    // Callers control strength through the tint's own alpha channel.
    x.globalAlpha = alpha == null ? 1 : alpha;
    x.fillStyle = tint;
    x.fillRect(0, 0, c.width, c.height);
    this.cache.set(key, c);
    return c;
  },

  /* ---- projectile / effect sprites ---- */
  fx(kind, tint) {
    if (tint) {
      const tk = 'fx:' + kind + ':' + tint;
      const hit = this.cache.get(tk);
      if (hit) return hit;
      return this.tinted(this.fx(kind), tk, tint);
    }
    const K = 'fx:' + kind;
    switch (kind) {
      case 'axe': return this.make(K, 14, 14, 2, (c) => {
        c.fillStyle = '#7a5a34'; c.fillRect(6, 2, 2, 11);
        c.fillStyle = '#c8ccd6';
        c.beginPath(); c.moveTo(8, 1); c.lineTo(13, 3); c.lineTo(13, 7); c.lineTo(8, 8); c.closePath(); c.fill();
        c.fillStyle = '#eef2fa';
        c.beginPath(); c.moveTo(11, 2.5); c.lineTo(13, 3.2); c.lineTo(13, 6); c.closePath(); c.fill();
        c.fillStyle = '#d84a4a'; c.fillRect(6, 12, 2, 2);   // cherry
      });

      case 'log': return this.make(K, 18, 12, 2, (c) => {
        c.fillStyle = '#6a4a2a'; c.fillRect(0, 2, 18, 8);
        c.fillStyle = '#7f5c34'; c.fillRect(0, 3, 18, 2);
        c.fillStyle = '#c9a878'; c.fillRect(0, 2, 3, 8); c.fillRect(15, 2, 3, 8);
        c.fillStyle = '#8a6a40'; c.fillRect(1, 4, 1, 4); c.fillRect(16, 4, 1, 4);
        c.fillStyle = '#5a3f22'; c.fillRect(4, 5, 10, 1);   // bark grain
      });

      case 'bean': return this.make(K, 8, 6, 2, (c) => {
        c.fillStyle = '#fff'; c.beginPath(); c.ellipse(4, 3, 3.6, 2.6, 0, 0, TAU); c.fill();
        c.fillStyle = '#ffffff88'; c.fillRect(2, 1, 2, 1);
      });

      /* A SARS-CoV-2 particle, drawn the way every diagram of it draws
         it: a round envelope with club-headed spikes all the way around.
         The clubs are what make it read as *that* virus rather than as a
         generic spiky ball, so they stay fat and stubby even at this
         size — a plain spike reads as a sea urchin. */
      case 'virion': return this.make(K, 18, 18, 2, (c) => {
        const cx = 9, cy = 9, body = 5;
        c.strokeStyle = '#a8324e'; c.lineWidth = 1;
        c.fillStyle = '#d0455f';
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          const dx = Math.cos(a), dy = Math.sin(a);
          c.beginPath();
          c.moveTo(cx + dx * (body - 0.5), cy + dy * (body - 0.5));
          c.lineTo(cx + dx * (body + 2.1), cy + dy * (body + 2.1));
          c.stroke();
          c.beginPath();
          c.arc(cx + dx * (body + 2.6), cy + dy * (body + 2.6), 1.35, 0, TAU);
          c.fill();
        }
        c.fillStyle = '#8f2740';
        c.beginPath(); c.arc(cx, cy, body, 0, TAU); c.fill();
        c.fillStyle = '#c23f5a';
        c.beginPath(); c.arc(cx, cy, body - 1.2, 0, TAU); c.fill();
        // the pale off-centre highlight the textbook renders always have
        c.fillStyle = '#e8798c';
        c.beginPath(); c.arc(cx - 1.4, cy - 1.4, 1.5, 0, TAU); c.fill();
      });

      /* The engrossed copy, half unrolled — the rolled ends are what
         make it read as a document rather than as a thrown plank. */
      case 'scroll': return this.make(K, 18, 12, 2, (c) => {
        c.fillStyle = '#e8e0c8'; c.fillRect(3, 2, 12, 8);
        c.fillStyle = '#f4efe2'; c.fillRect(3, 2, 12, 2);
        c.fillStyle = '#8a7a58';
        c.fillRect(5, 5, 8, 1); c.fillRect(5, 7, 6, 1);
        c.fillStyle = '#c9bfa2';                       // rolled ends
        c.fillRect(1, 1, 3, 10); c.fillRect(14, 1, 3, 10);
        c.fillStyle = '#a89876'; c.fillRect(1, 1, 1, 10); c.fillRect(16, 1, 1, 10);
        c.fillStyle = '#c9a24a'; c.fillRect(8, 9, 3, 3);   // the seal
      });

      /* A razor. Small, bright, and unmistakably a blade. */
      case 'razor': return this.make(K, 12, 8, 2, (c) => {
        c.fillStyle = '#dfe6ea';
        c.beginPath(); c.moveTo(0, 3); c.lineTo(8, 1); c.lineTo(8, 5); c.lineTo(0, 4); c.closePath(); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.moveTo(0, 3); c.lineTo(8, 1); c.lineTo(8, 2); c.closePath(); c.fill();
        c.fillStyle = '#2a2a30'; c.fillRect(8, 1, 4, 5);   // handle
        c.fillStyle = '#4a4a54'; c.fillRect(8, 1, 4, 1);
      });

      /* A contractor's cog, for the complex nobody voted for. */
      case 'cog': return this.make(K, 14, 14, 2, (c) => {
        c.fillStyle = '#8a7a4a';
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          c.save(); c.translate(7, 7); c.rotate(a);
          c.fillRect(-1.6, -7, 3.2, 4); c.restore();
        }
        c.fillStyle = '#c9a24a'; c.beginPath(); c.arc(7, 7, 4.6, 0, TAU); c.fill();
        c.fillStyle = '#8a7a4a'; c.beginPath(); c.arc(7, 7, 1.8, 0, TAU); c.fill();
        c.fillStyle = '#e8d9a8'; c.fillRect(4, 3, 2, 1);
      });

      /* The early edition, with the wrong headline on it. */
      case 'news': return this.make(K, 14, 10, 2, (c) => {
        c.fillStyle = '#e8e4d8'; c.fillRect(1, 1, 12, 8);
        c.fillStyle = '#f6f4ec'; c.fillRect(1, 1, 12, 2);
        c.fillStyle = '#2a2a30'; c.fillRect(2, 2, 10, 1);      // the headline
        c.fillStyle = '#8a8a90';
        c.fillRect(2, 4, 5, 1); c.fillRect(8, 4, 4, 1);
        c.fillRect(2, 6, 4, 1); c.fillRect(7, 6, 5, 1);
        c.fillStyle = '#b8b4a8'; c.fillRect(1, 1, 1, 8);       // the fold
      });

      /* An airlift pallet under a handkerchief parachute. */
      case 'pallet': return this.make(K, 16, 16, 2, (c) => {
        c.fillStyle = '#efe8d4';
        c.beginPath(); c.moveTo(2, 5); c.quadraticCurveTo(8, -2, 14, 5); c.closePath(); c.fill();
        c.fillStyle = '#cfc7b0';
        c.beginPath(); c.moveTo(8, 1); c.quadraticCurveTo(11, 1, 14, 5); c.closePath(); c.fill();
        c.strokeStyle = '#8a7a58'; c.lineWidth = 1;
        c.beginPath(); c.moveTo(3, 5); c.lineTo(6, 9); c.moveTo(13, 5); c.lineTo(10, 9); c.stroke();
        c.fillStyle = '#7a5a34'; c.fillRect(5, 9, 6, 6);
        c.fillStyle = '#956f42'; c.fillRect(5, 9, 6, 2);
        c.fillStyle = '#5a4128'; c.fillRect(7, 9, 2, 6);
      });

      case 'golf': return this.make(K, 8, 8, 2, (c) => {
        c.fillStyle = '#f4f4ee'; c.beginPath(); c.arc(4, 4, 3.4, 0, TAU); c.fill();
        c.fillStyle = '#d0d0c6';
        c.fillRect(3, 2, 1, 1); c.fillRect(5, 3, 1, 1); c.fillRect(3, 5, 1, 1);
        c.fillStyle = '#fff'; c.fillRect(2, 2, 1, 1);
      });

      case 'shoe': return this.make(K, 14, 10, 2, (c) => {
        c.fillStyle = '#3a2a1c'; c.fillRect(1, 3, 12, 5);
        c.fillStyle = '#4d3826'; c.fillRect(2, 3, 9, 2);
        c.fillStyle = '#1a1a1a'; c.fillRect(0, 7, 14, 2);
        c.fillStyle = '#6a5038'; c.fillRect(9, 2, 3, 3);
        c.fillStyle = '#e0d8c0'; c.fillRect(4, 4, 3, 1);  // laces
      });

      case 'burger': return this.make(K, 14, 12, 2, (c) => {
        c.fillStyle = '#c9873c'; c.fillRect(1, 1, 12, 4);
        c.fillStyle = '#dfa055'; c.fillRect(2, 1, 10, 2);
        c.fillStyle = '#f4efe2'; c.fillRect(3, 2, 1, 1); c.fillRect(7, 1, 1, 1); c.fillRect(10, 2, 1, 1);
        c.fillStyle = '#5ec26a'; c.fillRect(0, 5, 14, 2);
        c.fillStyle = '#6a3a24'; c.fillRect(1, 6, 12, 3);
        c.fillStyle = '#f2c14e'; c.fillRect(2, 8, 10, 1);
        c.fillStyle = '#c9873c'; c.fillRect(1, 9, 12, 3);
      });

      case 'reel': return this.make(K, 16, 16, 2, (c) => {
        c.fillStyle = '#2a2a32'; c.beginPath(); c.arc(8, 8, 7.5, 0, TAU); c.fill();
        c.fillStyle = '#4a3a2a'; c.beginPath(); c.arc(8, 8, 6, 0, TAU); c.fill();
        c.fillStyle = '#1a1a20'; c.beginPath(); c.arc(8, 8, 3, 0, TAU); c.fill();
        c.fillStyle = '#c8ccd6';
        c.fillRect(7.5, 1.5, 1, 4); c.fillRect(7.5, 10.5, 1, 4);
        c.fillRect(1.5, 7.5, 4, 1); c.fillRect(10.5, 7.5, 4, 1);
      });

      case 'moon': return this.make(K, 10, 18, 2, (c) => {
        c.fillStyle = '#e8e8f0'; c.beginPath();
        c.moveTo(5, 0); c.lineTo(8, 7); c.lineTo(8, 14); c.lineTo(2, 14); c.lineTo(2, 7); c.closePath(); c.fill();
        c.fillStyle = '#d8324a'; c.fillRect(2, 9, 6, 2);
        c.fillStyle = '#3f6fd8'; c.fillRect(4, 3, 2, 3);
        c.fillStyle = '#6a6a76'; c.beginPath();
        c.moveTo(2, 12); c.lineTo(0, 17); c.lineTo(3, 14); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(8, 12); c.lineTo(10, 17); c.lineTo(7, 14); c.closePath(); c.fill();
      });

      case 'sat': return this.make(K, 16, 12, 2, (c) => {
        c.fillStyle = '#3f6fd8'; c.fillRect(0, 3, 5, 6); c.fillRect(11, 3, 5, 6);
        c.fillStyle = '#6a9ae8'; c.fillRect(1, 4, 3, 1); c.fillRect(12, 4, 3, 1);
        c.fillStyle = '#c8ccd6'; c.fillRect(5, 4, 6, 5);
        c.fillStyle = '#f2c14e'; c.fillRect(7, 9, 2, 2);
        c.fillStyle = '#eef2fa'; c.fillRect(6, 5, 2, 1);
      });

      case 'mic': return this.make(K, 8, 16, 2, (c) => {
        c.fillStyle = '#2a2a32'; c.fillRect(3, 6, 2, 10);
        c.fillStyle = '#8a8a96'; c.beginPath(); c.arc(4, 4, 3.6, 0, TAU); c.fill();
        c.fillStyle = '#4a4a56'; c.fillRect(1, 2, 6, 1); c.fillRect(1, 4, 6, 1);
        c.fillStyle = '#c8ccd6'; c.fillRect(2, 1, 2, 1);
      });

      case 'tank': return this.make(K, 26, 16, 2, (c) => {
        c.fillStyle = '#3a4230'; c.fillRect(1, 7, 24, 7);
        c.fillStyle = '#2a3024'; c.fillRect(1, 12, 24, 3);
        for (let i = 0; i < 6; i++) { c.fillStyle = '#161a12'; c.fillRect(2 + i * 4, 12, 2, 3); }
        c.fillStyle = '#48523c'; c.fillRect(6, 3, 12, 5);
        c.fillStyle = '#5a6449'; c.fillRect(7, 3, 10, 2);
        c.fillStyle = '#2a3024'; c.fillRect(17, 5, 9, 2);   // barrel
        c.fillStyle = '#1a1e16'; c.fillRect(24, 4, 2, 4);
      });

      case 'plane': return this.make(K, 26, 20, 2, (c) => {
        c.fillStyle = '#8a8f9a'; c.fillRect(3, 8, 20, 4);
        c.fillStyle = '#a0a5b0'; c.fillRect(3, 8, 20, 2);
        c.fillStyle = '#6a6f7a'; c.fillRect(6, 2, 5, 16);    // wings
        c.fillStyle = '#7a7f8a'; c.fillRect(6, 3, 5, 1);
        c.fillStyle = '#d8324a'; c.fillRect(7, 4, 3, 3); c.fillRect(7, 13, 3, 3);
        c.fillStyle = '#2a2e36'; c.fillRect(20, 5, 3, 3);
        c.fillStyle = '#c8ccd6'; c.fillRect(1, 7, 3, 6);     // prop blur
        c.fillStyle = '#4a5058'; c.fillRect(13, 7, 4, 2);    // canopy
      });

      case 'crate': return this.make(K, 14, 14, 2, (c) => {
        c.fillStyle = '#7a5c34'; c.fillRect(0, 0, 14, 14);
        c.fillStyle = '#94724a'; c.fillRect(1, 1, 12, 12);
        c.fillStyle = '#5e4526'; c.fillRect(1, 6, 12, 2);
        c.fillStyle = '#5e4526';
        c.beginPath(); c.moveTo(1, 1); c.lineTo(13, 13); c.lineTo(11, 13); c.lineTo(1, 3); c.closePath(); c.fill();
        c.fillStyle = '#f2c14e'; c.font = '7px monospace'; c.fillText('NRA', 2, 12);
      });

      case 'pinkslip': return this.make(K, 14, 14, 2, (c) => {
        // A termination notice, on fire.
        c.fillStyle = '#ffb3d0'; c.fillRect(3, 3, 8, 10);
        c.fillStyle = '#ff8fbc'; c.fillRect(3, 3, 8, 2);
        c.fillStyle = '#8a3a5a'; c.fillRect(4, 6, 6, 1); c.fillRect(4, 8, 4, 1); c.fillRect(4, 10, 5, 1);
        c.fillStyle = '#ff6a2a';
        c.beginPath(); c.moveTo(1, 12); c.lineTo(4, 4); c.lineTo(6, 9); c.lineTo(9, 2); c.lineTo(12, 11); c.closePath(); c.fill();
        c.fillStyle = '#ffd35e';
        c.beginPath(); c.moveTo(4, 12); c.lineTo(6, 6); c.lineTo(8, 10); c.lineTo(10, 5); c.lineTo(11, 12); c.closePath(); c.fill();
        c.fillStyle = '#fff3cf'; c.fillRect(6, 9, 2, 3);
      });

      case 'fireball': return this.make(K, 12, 12, 2, (c) => {
        c.fillStyle = '#ff4a2a'; c.beginPath(); c.arc(6, 6, 5.4, 0, TAU); c.fill();
        c.fillStyle = '#ff9a3a'; c.beginPath(); c.arc(6, 6, 3.8, 0, TAU); c.fill();
        c.fillStyle = '#ffd35e'; c.beginPath(); c.arc(5.4, 5.4, 2.2, 0, TAU); c.fill();
        c.fillStyle = '#fff3cf'; c.fillRect(4, 4, 2, 2);
      });

      case 'train': return this.make(K, 52, 22, 2, (c) => {
        c.fillStyle = '#1f2a3a'; c.fillRect(2, 6, 44, 11);
        c.fillStyle = '#2f3e52'; c.fillRect(2, 6, 44, 3);
        c.fillStyle = '#3f6fd8'; c.fillRect(4, 10, 40, 2);
        c.fillStyle = '#8fc4ff'; c.fillRect(8, 7, 6, 3); c.fillRect(18, 7, 6, 3); c.fillRect(28, 7, 6, 3);
        c.fillStyle = '#c8ccd6'; c.fillRect(44, 4, 8, 9);          // nose
        c.fillStyle = '#eef2fa'; c.fillRect(46, 5, 5, 3);
        c.fillStyle = '#d8324a'; c.fillRect(46, 10, 6, 2);
        c.fillStyle = '#12161e'; c.fillRect(2, 16, 44, 3);
        for (let i = 0; i < 5; i++) { c.fillStyle = '#0a0d12'; c.beginPath(); c.arc(7 + i * 9, 18, 2.6, 0, TAU); c.fill(); }
        c.fillStyle = '#f2c14e'; c.fillRect(50, 6, 2, 3);          // headlight
      });

      case 'star': return this.make(K, 12, 12, 2, (c) => {
        c.fillStyle = '#f2c14e';
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5;
          const r = i % 2 ? 2.4 : 5.6;
          const px = 6 + Math.cos(a) * r, py = 6 + Math.sin(a) * r;
          i ? c.lineTo(px, py) : c.moveTo(px, py);
        }
        c.closePath(); c.fill();
        c.fillStyle = '#fff3cf'; c.fillRect(5, 2, 2, 2);
      });
    }
    // fallback: a plain white dot, so a typo never crashes the renderer
    return this.make('fx:_', 6, 6, 2, (c) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(3, 3, 3, 0, TAU); c.fill(); });
  },

  /* ---- big set-piece sprites drawn at their own scale ---- */

  escalator() {
    return this.make('escalator', 40, 56, 2, (c) => {
      c.fillStyle = '#8a6a1a';
      c.beginPath(); c.moveTo(2, 54); c.lineTo(38, 4); c.lineTo(38, 54); c.closePath(); c.fill();
      for (let i = 0; i < 11; i++) {
        const y = 50 - i * 4.4, x = 4 + i * 3.1;
        c.fillStyle = i % 2 ? '#f2c14e' : '#d8a92e';
        c.fillRect(x, y, 34 - x + 4, 3);
        c.fillStyle = '#fff3cf'; c.fillRect(x, y, 34 - x + 4, 1);
      }
      c.fillStyle = '#c9a02a'; c.fillRect(36, 2, 4, 54);
      c.fillStyle = '#fff3cf'; c.fillRect(36, 2, 2, 54);
    });
  },

  banner() {
    return this.make('banner', 72, 26, 2, (c) => {
      c.fillStyle = '#efe4cf'; c.fillRect(0, 3, 72, 20);
      c.fillStyle = '#d8324a'; c.fillRect(0, 3, 72, 3); c.fillRect(0, 20, 72, 3);
      c.fillStyle = '#3f6fd8'; c.fillRect(0, 3, 10, 20);
      c.fillStyle = '#fff';
      for (let i = 0; i < 6; i++) c.fillRect(1 + (i % 3) * 3, 5 + ((i / 3) | 0) * 8, 1, 1);
      c.fillStyle = '#1b2447'; c.font = 'bold 7px monospace';
      c.fillText('MISSION', 13, 13); c.fillText('ACCOMPLISHED', 13, 21);
      c.fillStyle = '#8a8578'; c.fillRect(0, 0, 72, 3);
    });
  },

  vehicle(kind) {
    const K = 'veh:' + kind;
    if (kind === 'boat') return this.make(K, 44, 20, 2, (c) => {
      c.fillStyle = '#3a4a3a'; c.beginPath();
      c.moveTo(0, 8); c.lineTo(36, 6); c.lineTo(44, 12); c.lineTo(36, 18); c.lineTo(2, 18); c.closePath(); c.fill();
      c.fillStyle = '#4d5f4a'; c.fillRect(2, 8, 34, 3);
      c.fillStyle = '#2a3428'; c.fillRect(10, 3, 12, 6);
      c.fillStyle = '#7a8a96'; c.fillRect(12, 4, 8, 3);
      c.fillStyle = '#c8ccd6'; c.fillRect(26, 2, 2, 8);            // mast
      c.fillStyle = '#efe4cf'; c.font = 'bold 6px monospace'; c.fillText('109', 4, 17);
      c.fillStyle = '#2a2e36'; c.fillRect(30, 6, 8, 2);            // deck gun
    });
    if (kind === 'corvette') return this.make(K, 46, 18, 2, (c) => {
      c.fillStyle = '#0f5aa8'; c.beginPath();
      c.moveTo(1, 12); c.lineTo(7, 6); c.lineTo(16, 3); c.lineTo(30, 3); c.lineTo(39, 6); c.lineTo(45, 12); c.lineTo(45, 15); c.lineTo(1, 15); c.closePath(); c.fill();
      c.fillStyle = '#1f7fd8'; c.fillRect(4, 8, 38, 3);
      c.fillStyle = '#9fd8ff'; c.beginPath();
      c.moveTo(15, 4); c.lineTo(30, 4); c.lineTo(33, 8); c.lineTo(13, 8); c.closePath(); c.fill();
      c.fillStyle = '#1a1a20'; c.beginPath(); c.arc(11, 15, 3.4, 0, TAU); c.fill();
      c.beginPath(); c.arc(35, 15, 3.4, 0, TAU); c.fill();
      c.fillStyle = '#c8ccd6'; c.beginPath(); c.arc(11, 15, 1.4, 0, TAU); c.fill();
      c.beginPath(); c.arc(35, 15, 1.4, 0, TAU); c.fill();
      c.fillStyle = '#f2c14e'; c.fillRect(43, 9, 3, 2);
      c.fillStyle = '#d8324a'; c.fillRect(1, 10, 2, 2);
    });
    if (kind === 'chair') return this.make(K, 24, 24, 2, (c) => {
      c.fillStyle = '#4a4f5e'; c.fillRect(4, 8, 14, 3);
      c.fillStyle = '#3a3f4e'; c.fillRect(2, 2, 3, 10);
      // spiked wheels
      for (const wx of [7, 17]) {
        c.fillStyle = '#2a2e38'; c.beginPath(); c.arc(wx, 15, 7, 0, TAU); c.fill();
        c.fillStyle = '#8a8f9e'; c.beginPath(); c.arc(wx, 15, 4.5, 0, TAU); c.fill();
        c.fillStyle = '#2a2e38'; c.beginPath(); c.arc(wx, 15, 2, 0, TAU); c.fill();
        c.fillStyle = '#c8ccd6';
        for (let i = 0; i < 8; i++) {
          const a = i * TAU / 8;
          c.fillRect(wx + Math.cos(a) * 7 - 1, 15 + Math.sin(a) * 7 - 1, 2.4, 2.4);
        }
      }
    });
    if (kind === 'moose') return this.make(K, 34, 26, 2, (c) => {
      c.fillStyle = '#4a3626'; c.fillRect(6, 10, 20, 9);
      c.fillStyle = '#5c452f'; c.fillRect(6, 10, 20, 3);
      c.fillStyle = '#3a2a1c'; c.fillRect(7, 18, 3, 7); c.fillRect(14, 18, 3, 7);
      c.fillRect(20, 18, 3, 7); c.fillRect(24, 18, 3, 6);
      c.fillStyle = '#4a3626'; c.fillRect(24, 6, 8, 8);
      c.fillStyle = '#2a1e14'; c.fillRect(30, 10, 4, 4);      // muzzle
      c.fillStyle = '#c8b088';                                 // antlers
      c.fillRect(22, 0, 3, 7); c.fillRect(18, 1, 4, 2); c.fillRect(17, 3, 2, 3);
      c.fillRect(28, 0, 3, 7); c.fillRect(31, 1, 3, 2); c.fillRect(32, 3, 2, 3);
      c.fillStyle = '#f2c14e'; c.fillRect(29, 8, 1, 2);        // eye
      c.fillStyle = '#6a4a30'; c.fillRect(24, 13, 3, 5);       // dewlap
    });
    return this.fx('_');
  },

  /* ========================================================
     PROPS

     Static scenery that tells you whose ground you are standing on.
     A stage lists them as {x, y, kind}; they sort by depth like any
     other actor, so you walk behind a flagpole.
     ======================================================== */
  prop(kind) {
    const K = 'prop:' + kind;
    const hit = this.cache.get(K);
    if (hit) return hit;

    /* Flags share a pole and a wind-curled banner; only the field
       differs. Drawn at 2x like everything else. */
    const flag = (draw) => this.make(K, 26, 40, 2, (c) => {
      c.fillStyle = '#6a5238'; c.fillRect(3, 4, 2, 34);      // pole
      c.fillStyle = '#8a6a44'; c.fillRect(3, 4, 1, 34);
      c.fillStyle = '#c9a24a'; c.fillRect(2, 2, 4, 3);       // finial
      draw(c, 5, 6, 18, 12);
      c.fillStyle = 'rgba(0,0,0,.22)';                        // fold shadow
      c.fillRect(5, 16, 18, 2);
      c.fillStyle = 'rgba(0,0,0,.30)'; c.fillRect(1, 37, 8, 3);
    });

    switch (kind) {
      case 'flag_csa': return flag((c, x, y, w, h) => {
        // Confederate battle flag: red field, blue saltire, white stars.
        c.fillStyle = '#b02a32'; c.fillRect(x, y, w, h);
        c.strokeStyle = '#e8e4d8'; c.lineWidth = 3.4;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + h);
        c.moveTo(x + w, y); c.lineTo(x, y + h); c.stroke();
        c.strokeStyle = '#2a4a8a'; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + h);
        c.moveTo(x + w, y); c.lineTo(x, y + h); c.stroke();
        c.fillStyle = '#e8e4d8';
        for (let i = 0; i < 5; i++) {
          const t = i / 4;
          c.fillRect(x + t * (w - 1.4), y + t * (h - 1.4), 1.4, 1.4);
          if (i !== 2) c.fillRect(x + t * (w - 1.4), y + (1 - t) * (h - 1.4), 1.4, 1.4);
        }
      });

      case 'flag_uk': return flag((c, x, y, w, h) => {
        c.fillStyle = '#1f3a7a'; c.fillRect(x, y, w, h);
        c.strokeStyle = '#e8e4d8'; c.lineWidth = 3;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + h);
        c.moveTo(x + w, y); c.lineTo(x, y + h); c.stroke();
        c.strokeStyle = '#c8323a'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + h);
        c.moveTo(x + w, y); c.lineTo(x, y + h); c.stroke();
        c.fillStyle = '#e8e4d8';
        c.fillRect(x, y + h / 2 - 2, w, 4); c.fillRect(x + w / 2 - 2, y, 4, h);
        c.fillStyle = '#c8323a';
        c.fillRect(x, y + h / 2 - 1, w, 2); c.fillRect(x + w / 2 - 1, y, 2, h);
      });

      case 'flag_spain': return flag((c, x, y, w, h) => {
        c.fillStyle = '#c8323a'; c.fillRect(x, y, w, h);
        c.fillStyle = '#f2c14e'; c.fillRect(x, y + h * 0.28, w, h * 0.44);
        c.fillStyle = '#a8842a'; c.fillRect(x + w * 0.32, y + h * 0.38, 4, 4);
      });

      case 'flag_reich': return flag((c, x, y, w, h) => {
        /* Party banner WITHOUT the party symbol: red field, white disc,
           black cross. Reads unmistakably at a glance and is what most
           WWII games ship, since the actual mark is illegal to display
           in several countries and adds nothing the uniform hasn't. */
        c.fillStyle = '#b0202a'; c.fillRect(x, y, w, h);
        c.fillStyle = '#efe8d4';
        c.beginPath(); c.arc(x + w / 2, y + h / 2, h * 0.36, 0, TAU); c.fill();
        c.fillStyle = '#15151a';
        c.fillRect(x + w / 2 - 1.2, y + h / 2 - 4, 2.4, 8);
        c.fillRect(x + w / 2 - 4, y + h / 2 - 1.2, 8, 2.4);
      });

      case 'cannon': return this.make(K, 30, 20, 2, (c) => {
        c.fillStyle = '#4a4038';
        c.beginPath(); c.arc(8, 14, 5.5, 0, TAU); c.fill();
        c.beginPath(); c.arc(20, 14, 5.5, 0, TAU); c.fill();
        c.fillStyle = '#7a6a4a';
        c.beginPath(); c.arc(8, 14, 3, 0, TAU); c.fill();
        c.beginPath(); c.arc(20, 14, 3, 0, TAU); c.fill();
        c.fillStyle = '#6a5238'; c.fillRect(6, 11, 18, 4);
        c.fillStyle = '#3a3a42'; c.fillRect(4, 7, 22, 4);
        c.fillStyle = '#5a5a66'; c.fillRect(4, 7, 22, 1);
        c.fillStyle = '#22222a'; c.fillRect(24, 6, 5, 6);
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(4, 18, 22, 2);
      });

      case 'muskets': return this.make(K, 20, 26, 2, (c) => {
        // Stacked arms: three muskets tripodded, as a camp leaves them.
        c.strokeStyle = '#5a3f22'; c.lineWidth = 1.6;
        for (const dx of [-5, 0, 5]) {
          c.beginPath(); c.moveTo(10 + dx, 24); c.lineTo(10 + dx * 0.15, 4); c.stroke();
        }
        c.fillStyle = '#c8ccd6'; c.fillRect(9, 2, 2, 4);
        c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(3, 23, 14, 3);
      });

      case 'tent': return this.make(K, 32, 24, 2, (c) => {
        c.fillStyle = '#cfc7b0';
        c.beginPath(); c.moveTo(16, 1); c.lineTo(31, 21); c.lineTo(1, 21); c.closePath(); c.fill();
        c.fillStyle = '#b5ad96';
        c.beginPath(); c.moveTo(16, 1); c.lineTo(31, 21); c.lineTo(16, 21); c.closePath(); c.fill();
        c.fillStyle = '#3a3428';
        c.beginPath(); c.moveTo(16, 8); c.lineTo(21, 21); c.lineTo(11, 21); c.closePath(); c.fill();
        c.fillStyle = '#6a5238'; c.fillRect(15, 0, 2, 4);
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(1, 21, 30, 3);
      });

      /* A reading desk with a locked case on it. Deliberately not a
         glowing pickup: it should look like scenery until you walk into
         it, because a marked secret is not a secret. */
      case 'lectern': return this.make(K, 26, 30, 2, (c) => {
        c.fillStyle = '#3a2a18'; c.fillRect(11, 16, 4, 12);      // pedestal
        c.fillStyle = '#4a3520'; c.fillRect(6, 27, 14, 3);       // foot
        c.fillStyle = '#5a4128';                                  // sloped top
        c.beginPath(); c.moveTo(2, 14); c.lineTo(24, 10);
        c.lineTo(24, 14); c.lineTo(2, 18); c.closePath(); c.fill();
        c.fillStyle = '#6b4f31';
        c.beginPath(); c.moveTo(2, 14); c.lineTo(24, 10);
        c.lineTo(24, 11); c.lineTo(2, 15); c.closePath(); c.fill();
        c.fillStyle = '#e8e0c8'; c.fillRect(7, 8, 12, 5);        // a document on it
        c.fillStyle = '#c9bfa2'; c.fillRect(7, 8, 12, 1);
        c.fillStyle = '#8a7a58';
        c.fillRect(8, 10, 9, 1); c.fillRect(8, 12, 7, 1);        // lines of writing
        c.fillStyle = '#c9a24a'; c.fillRect(12, 5, 3, 4);        // the brass lock
        c.fillStyle = '#8a6a2a'; c.fillRect(13, 6, 1, 2);
        c.fillStyle = 'rgba(0,0,0,.32)'; c.fillRect(5, 28, 16, 2);
      });
      /* A campaign footlocker, left where somebody set it down. The
         military counterpart of the lectern: same job, same silence. */
      case 'fieldcase': return this.make(K, 28, 22, 2, (c) => {
        c.fillStyle = '#4a4028'; c.fillRect(2, 6, 24, 14);
        c.fillStyle = '#5e5334'; c.fillRect(2, 6, 24, 4);
        c.fillStyle = '#3a3220'; c.fillRect(2, 18, 24, 2);
        c.fillStyle = '#6a6252';                                  // strapping
        c.fillRect(7, 6, 3, 14); c.fillRect(18, 6, 3, 14);
        c.fillStyle = '#c9a24a'; c.fillRect(12, 11, 4, 4);        // brass catch
        c.fillStyle = '#8a6a2a'; c.fillRect(13, 12, 2, 2);
        c.fillStyle = '#8a8478'; c.fillRect(4, 4, 20, 2);         // lid edge
        c.fillStyle = 'rgba(0,0,0,.32)'; c.fillRect(1, 20, 26, 2);
      });

      case 'barricade': return this.make(K, 34, 18, 2, (c) => {
        c.fillStyle = '#6a5a42';
        for (let i = 0; i < 5; i++) c.fillRect(2 + i * 6, 6 + (i % 2) * 2, 5, 10);
        c.fillStyle = '#84714f';
        for (let i = 0; i < 5; i++) c.fillRect(2 + i * 6, 6 + (i % 2) * 2, 5, 2);
        c.fillStyle = '#4a4038'; c.fillRect(0, 10, 34, 2);
        c.fillStyle = '#8a8272'; c.fillRect(6, 2, 22, 5);      // sandbags
        c.fillStyle = '#9a9282'; c.fillRect(6, 2, 22, 2);
        c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(1, 16, 32, 2);
      });
    }
    return this.fx('_');
  },

  /* ========================================================
     BUILDINGS

     Each one is rendered once into its own canvas. The footprint
     (w x h) is the ground the building actually occupies and blocks;
     `elev` is how far the structure rises above it, which is the part
     you can walk behind. Anchored bottom-left at (x, y + h).
     ======================================================== */
  /**
   * One of the four faces on Mount Rushmore, at strongpoint scale.
   *
   * Drawn as rock rather than as a person: a granite mass with the
   * light coming from the upper left, then the features cut into it as
   * planes of shadow. Real carving reads as SHADOW, not as outline —
   * the mountain is one colour, and a nose is only a nose because of
   * the dark under it. Outlining the features made them look like a
   * face painted on a cliff, which is exactly wrong.
   *
   * `b.who` picks the one detail that identifies each president at this
   * size: a queue, a beard, spectacles, a jaw.
   */
  _carvedHead(x, W, H, b) {
    const rock = b.wall || '#8e8e88';
    const back = shade(rock, -0.34);      // the cliff behind, clearly darker
    const backD = shade(rock, -0.46);
    const lit = shade(rock, 0.20);
    const hot = shade(rock, 0.34);
    const dark = shade(rock, -0.22);
    const deep = shade(rock, -0.42);
    const cut = shade(rock, -0.60);

    const cx = W * 0.48;
    const hw = W * 0.35;                  // half-width of the head
    const hh = H * 0.40;                  // half-height
    const cy = H * 0.46;
    const face = (f) => cy - hh + (hh * 2) * f;   // 0 = crown, 1 = chin

    /* ---- the cliff the head is cut out of ---- */
    x.fillStyle = back;
    x.beginPath();
    x.moveTo(0, H);
    x.lineTo(W * 0.04, H * 0.26);
    x.lineTo(W * 0.34, H * 0.02);
    x.lineTo(W * 0.74, 0);
    x.lineTo(W * 0.98, H * 0.22);
    x.lineTo(W, H);
    x.closePath(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.22)'; x.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const sx = (i * 47) % W;
      x.beginPath();
      x.moveTo(sx, H * 0.06 + (i % 3) * 18);
      x.lineTo(sx + 14 - (i % 4) * 10, H * (0.42 + (i % 3) * 0.18));
      x.stroke();
    }

    /* ---- head mass. Every bit of shading below is CLIPPED to this,
       so the light and shadow read as planes on one solid form rather
       than as separate blobs floating over it. ---- */
    x.save();
    x.beginPath();
    x.ellipse(cx, cy, hw, hh, 0, 0, TAU);
    x.clip();

    x.fillStyle = rock;
    x.fillRect(0, 0, W, H);

    // lit plane: a large disc offset up-left, so only its lower-right
    // edge falls inside the head — a crescent, not an egg.
    x.fillStyle = lit;
    x.beginPath(); x.ellipse(cx - hw * 0.30, cy - hh * 0.16, hw * 1.02, hh * 0.98, 0, 0, TAU); x.fill();
    x.fillStyle = hot;
    x.beginPath(); x.ellipse(cx - hw * 0.46, cy - hh * 0.30, hw * 0.62, hh * 0.60, 0, 0, TAU); x.fill();
    // shadowed plane down the right side, same trick mirrored
    x.fillStyle = dark;
    x.beginPath(); x.ellipse(cx + hw * 1.06, cy + hh * 0.10, hw * 0.96, hh * 1.06, 0, 0, TAU); x.fill();
    x.fillStyle = deep;
    x.beginPath(); x.ellipse(cx + hw * 1.40, cy + hh * 0.18, hw * 0.90, hh * 1.00, 0, 0, TAU); x.fill();

    const browY = face(0.40);
    const eyeY = face(0.46);
    const noseY = face(0.62);
    const mouthY = face(0.76);
    const chinY = face(0.94);
    const ex = hw * 0.40;                 // eye offset from centre
    const er = hw * 0.20;                 // eye radius

    /* ---- brow: the deepest cut on the real mountain. A lit ridge with
       the socket shadow directly under it is what makes stone read as a
       face; an outline never does. ---- */
    x.fillStyle = hot;
    x.beginPath();
    x.moveTo(cx - hw * 0.86, browY + 4);
    x.quadraticCurveTo(cx, browY - hh * 0.20, cx + hw * 0.86, browY + 4);
    x.quadraticCurveTo(cx, browY - hh * 0.04, cx - hw * 0.86, browY + 4);
    x.closePath(); x.fill();
    x.fillStyle = deep;
    x.beginPath();
    x.moveTo(cx - hw * 0.86, browY + 4);
    x.quadraticCurveTo(cx, browY + hh * 0.10, cx + hw * 0.86, browY + 4);
    x.quadraticCurveTo(cx, browY + hh * 0.20, cx - hw * 0.86, browY + 4);
    x.closePath(); x.fill();

    /* ---- eyes: hollows with the pupil left standing proud, which is
       the trick Borglum used so they'd read from a mile away ---- */
    for (const s of [-1, 1]) {
      const px = cx + s * ex;
      x.fillStyle = cut;
      x.beginPath(); x.ellipse(px, eyeY, er, er * 0.62, 0, 0, TAU); x.fill();
      x.fillStyle = shade(rock, -0.10);
      x.beginPath(); x.ellipse(px + er * 0.10, eyeY + er * 0.10, er * 0.34, er * 0.30, 0, 0, TAU); x.fill();
      x.fillStyle = lit;                                  // lower lid catches light
      x.fillRect(Math.round(px - er * 0.8), Math.round(eyeY + er * 0.52), Math.round(er * 1.6), 2);
    }

    /* ---- nose: a lit wedge, and the shadow it throws to the right ---- */
    const nw = hw * 0.20;
    x.fillStyle = hot;
    x.beginPath();
    x.moveTo(cx - nw * 0.35, browY + 6);
    x.lineTo(cx + nw * 0.30, browY + 6);
    x.lineTo(cx + nw * 0.62, noseY);
    x.lineTo(cx - nw * 0.80, noseY);
    x.closePath(); x.fill();
    x.fillStyle = deep;
    x.beginPath();
    x.moveTo(cx + nw * 0.30, browY + 6);
    x.lineTo(cx + nw * 1.05, noseY + 4);
    x.lineTo(cx + nw * 0.62, noseY);
    x.closePath(); x.fill();
    x.fillStyle = cut;                                     // under the tip
    x.beginPath();
    x.ellipse(cx - nw * 0.10, noseY + 3, nw * 0.86, nw * 0.30, 0, 0, TAU); x.fill();

    /* ---- mouth and chin ---- */
    const who = b.who;
    if (who !== 'lincoln') {
      x.fillStyle = deep;
      x.beginPath();
      x.ellipse(cx, mouthY, hw * 0.30, hh * 0.035, 0, 0, TAU); x.fill();
      x.fillStyle = lit;
      x.fillRect(Math.round(cx - hw * 0.26), Math.round(mouthY + hh * 0.045), Math.round(hw * 0.52), 2);
    }
    x.fillStyle = dark;                                    // under the jaw
    x.beginPath();
    x.ellipse(cx, chinY + hh * 0.10, hw * 0.62, hh * 0.16, 0, 0, TAU); x.fill();

    /* ---- the one detail that identifies each of them at this size ---- */
    if (who === 'lincoln') {
      // A mass hanging BELOW the jaw. Drawn as an arc across the face it
      // reads as a grin, which is worse than having no beard at all.
      x.fillStyle = deep;
      x.beginPath();
      x.moveTo(cx - hw * 0.62, mouthY - hh * 0.06);
      x.quadraticCurveTo(cx - hw * 0.58, chinY + hh * 0.30, cx, chinY + hh * 0.34);
      x.quadraticCurveTo(cx + hw * 0.58, chinY + hh * 0.30, cx + hw * 0.62, mouthY - hh * 0.06);
      x.quadraticCurveTo(cx, mouthY + hh * 0.06, cx - hw * 0.62, mouthY - hh * 0.06);
      x.closePath(); x.fill();
      x.fillStyle = cut;                                   // the line of the mouth
      x.beginPath();
      x.ellipse(cx, mouthY + hh * 0.015, hw * 0.16, hh * 0.018, 0, 0, TAU); x.fill();
      x.fillStyle = shade(rock, -0.30);                    // moustache above it
      x.beginPath();
      x.ellipse(cx, mouthY - hh * 0.045, hw * 0.24, hh * 0.030, 0, 0, TAU); x.fill();
    } else if (who === 'roosevelt') {
      x.fillStyle = deep;                                  // moustache
      x.beginPath();
      x.ellipse(cx, mouthY - hh * 0.045, hw * 0.32, hh * 0.045, 0, 0, TAU); x.fill();
      x.strokeStyle = cut; x.lineWidth = 3;                // pince-nez
      for (const s of [-1, 1]) {
        x.beginPath(); x.arc(cx + s * ex, eyeY, er * 1.12, 0, TAU); x.stroke();
      }
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(cx - ex + er * 1.1, eyeY); x.lineTo(cx + ex - er * 1.1, eyeY); x.stroke();
    } else if (who === 'jefferson') {
      x.fillStyle = lit;                                   // hair swept back off the brow
      x.beginPath();
      x.moveTo(cx - hw, browY - hh * 0.10);
      x.quadraticCurveTo(cx, cy - hh * 1.10, cx + hw, browY - hh * 0.14);
      x.lineTo(cx + hw, cy - hh);
      x.lineTo(cx - hw, cy - hh);
      x.closePath(); x.fill();
      // Swept BANDS, not strands. Individual hairs at this scale turn
      // into a row of vertical bars and read as a cage, not as hair.
      x.fillStyle = shade(rock, 0.06);
      x.beginPath();
      x.moveTo(cx - hw * 0.94, browY - hh * 0.16);
      x.quadraticCurveTo(cx - hw * 0.10, cy - hh * 0.96, cx + hw * 0.86, browY - hh * 0.30);
      x.quadraticCurveTo(cx - hw * 0.10, cy - hh * 0.72, cx - hw * 0.94, browY - hh * 0.16);
      x.closePath(); x.fill();
      x.fillStyle = dark;
      x.beginPath();
      x.moveTo(cx + hw * 0.30, browY - hh * 0.24);
      x.quadraticCurveTo(cx + hw * 0.80, cy - hh * 0.80, cx + hw * 0.96, browY - hh * 0.20);
      x.quadraticCurveTo(cx + hw * 0.70, cy - hh * 0.62, cx + hw * 0.30, browY - hh * 0.24);
      x.closePath(); x.fill();
    } else {
      x.fillStyle = lit;                                   // Washington's collar
      x.fillRect(Math.round(cx - hw * 0.72), Math.round(chinY + hh * 0.14), Math.round(hw * 1.44), 8);
      x.fillStyle = deep;
      x.fillRect(Math.round(cx - hw * 0.72), Math.round(chinY + hh * 0.14), Math.round(hw * 1.44), 2);
    }

    x.restore();

    /* ---- rim light along the lit edge, so the head separates from the
       cliff instead of dissolving into it ---- */
    x.strokeStyle = 'rgba(255,255,255,.20)'; x.lineWidth = 2;
    x.beginPath();
    x.ellipse(cx, cy, hw - 1, hh - 1, 0, Math.PI * 0.72, Math.PI * 1.62);
    x.stroke();
    x.strokeStyle = 'rgba(0,0,0,.30)';
    x.beginPath();
    x.ellipse(cx, cy, hw - 1, hh - 1, 0, Math.PI * 1.75, Math.PI * 0.62);
    x.stroke();

    /* ---- talus: the rubble the carving threw down the slope ---- */
    x.fillStyle = backD;
    for (let i = 0; i < 30; i++) {
      const rx = (i * 71) % W, ry = H - 5 - (i % 6) * 3;
      x.fillRect(rx, ry, 3 + (i % 3), 2 + (i % 2));
    }
  },
  building(b) {
    // Stage-scoped: two stages both have a building called 'capitol', and
    // a bare id would hand the second one the first one's sprite.
    const key = 'stage:' + (b.stageId || 'x') + ':bld:' + b.id;
    const hit = this.cache.get(key);
    if (hit) return hit;

    const W = b.w, H = b.h + b.elev;
    // Steeples and cupolas are drawn above the roofline in negative space,
    // so the canvas needs headroom and the whole drawing shifts down into it.
    const pad = b.cupola ? (b.steeple ? 80 : 48) : 0;
    const c = document.createElement('canvas');
    c.width = W; c.height = H + pad;
    c.padTop = pad;                       // read back by the renderer
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    if (pad) x.translate(0, pad);

    // A carved head is not a building — no walls, no roofline, no
    // windows. It takes the whole canvas and returns before any of the
    // structure passes below can touch it.
    if (b.carved) {
      this._carvedHead(x, W, H, b);
      this.cache.set(key, c);
      return c;
    }

    const wall = b.wall || '#e6e0d2';
    const wallD = shade(wall, -0.18);
    const wallL = shade(wall, 0.10);
    const roof = b.roof || '#4a4038';
    const roofL = shade(roof, 0.14);
    const trim = b.trim || '#3a4a34';

    const roofH = Math.round(b.elev * 0.46);
    const wallTop = roofH;
    const wallBot = H;

    /* ---- walls ---- */
    x.fillStyle = wall;
    x.fillRect(0, wallTop, W, wallBot - wallTop);
    x.fillStyle = wallL;
    x.fillRect(0, wallTop, W, 3);
    x.fillStyle = wallD;
    x.fillRect(0, wallBot - 5, W, 5);
    x.fillRect(W - 4, wallTop, 4, wallBot - wallTop);

    /* ---- material passes for the campaign archetypes ---- */
    if (b.concrete) {
      // Poured concrete: broad panels, form-tie marks, water staining.
      x.fillStyle = 'rgba(0,0,0,.07)';
      for (let yy = wallTop + 8; yy < wallBot - 4; yy += 14) x.fillRect(0, yy, W, 1);
      for (let xx = 18; xx < W; xx += 26) x.fillRect(xx, wallTop, 1, wallBot - wallTop);
      x.fillStyle = 'rgba(0,0,0,.13)';
      for (let i = 0; i < 6; i++) {
        const sx2 = (i * 37) % Math.max(1, W - 6);
        x.fillRect(sx2, wallTop + 4, 3, (wallBot - wallTop) * (0.3 + (i % 3) * 0.2));
      }
    } else if (b.corrugated) {
      // Corrugated tin: hard vertical ribs, and rust at the bottom.
      for (let xx = 0; xx < W; xx += 5) {
        x.fillStyle = 'rgba(255,255,255,.10)'; x.fillRect(xx, wallTop, 2, wallBot - wallTop);
        x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(xx + 3, wallTop, 2, wallBot - wallTop);
      }
      x.fillStyle = 'rgba(150,80,40,.35)';
      x.fillRect(0, wallBot - 12, W, 12);
    } else if (b.thatch) {
      // Thatch/mud: irregular horizontal courses, no straight lines.
      for (let yy = wallTop + 3; yy < wallBot - 2; yy += 4) {
        x.fillStyle = 'rgba(0,0,0,.10)';
        x.fillRect((yy % 3), yy, W - (yy % 5), 1);
        x.fillStyle = 'rgba(255,255,255,.06)';
        x.fillRect((yy % 7), yy + 1, W - (yy % 4), 1);
      }
    }

    if (b.rubble) {
      // Blast damage: notch the top of the wall and pile debris at the base.
      for (let i = 0; i < 7; i++) {
        const rx = (i * 29) % Math.max(1, W - 10);
        x.clearRect(rx, wallTop, 8 + (i % 3) * 5, 4 + (i % 4) * 5);
      }
      x.fillStyle = shade(wall, -0.4);
      for (let i = 0; i < 12; i++) {
        const rx = (i * 23) % Math.max(1, W - 6);
        x.fillRect(rx, wallBot - 6 - (i % 3) * 2, 5 + (i % 3) * 3, 4 + (i % 2) * 3);
      }
    }

    // brick courses, if this one is brick
    if (b.brick) {
      x.fillStyle = 'rgba(0,0,0,.10)';
      for (let yy = wallTop + 4; yy < wallBot - 4; yy += 5) x.fillRect(0, yy, W, 1);
      x.fillStyle = 'rgba(255,255,255,.06)';
      for (let yy = wallTop + 6; yy < wallBot - 4; yy += 10) x.fillRect(0, yy, W, 1);
    } else {
      // clapboard siding
      x.fillStyle = 'rgba(0,0,0,.07)';
      for (let yy = wallTop + 5; yy < wallBot - 4; yy += 6) x.fillRect(0, yy, W, 1);
    }

    /* ---- windows ---- */
    const wallH = wallBot - wallTop;
    const rows = wallH > 54 ? 2 : 1;
    const cols = Math.max(2, Math.floor(W / 46));
    const gapX = W / (cols + 1);
    for (let r = 0; r < rows; r++) {
      for (let i = 1; i <= cols; i++) {
        const wx = Math.round(i * gapX - 7);
        const wy = wallTop + 12 + r * Math.round((wallH - 26) / rows);
        x.fillStyle = trim; x.fillRect(wx - 2, wy - 2, 18, 22);
        x.fillStyle = '#2b3340'; x.fillRect(wx, wy, 14, 18);
        x.fillStyle = '#6f8199';
        x.fillRect(wx + 1, wy + 1, 5, 7); x.fillRect(wx + 8, wy + 1, 5, 7);
        x.fillRect(wx + 1, wy + 10, 5, 7); x.fillRect(wx + 8, wy + 10, 5, 7);
        if (b.barred) {   // the Gaol
          x.fillStyle = '#22252c';
          x.fillRect(wx + 3, wy, 2, 18); x.fillRect(wx + 9, wy, 2, 18);
        }
      }
    }

    /* ---- door ---- */
    const dx = Math.round(W / 2 - 11);
    x.fillStyle = trim; x.fillRect(dx - 3, wallBot - 34, 28, 34);
    x.fillStyle = shade(trim, -0.3); x.fillRect(dx, wallBot - 31, 22, 31);
    x.fillStyle = '#c9a24a'; x.fillRect(dx + 17, wallBot - 16, 3, 3);
    x.fillStyle = wallL; x.fillRect(dx - 5, wallBot - 38, 32, 4);   // pediment

    /* ---- roof ---- */
    x.fillStyle = roof;
    x.beginPath();
    x.moveTo(-2, wallTop + 2);
    x.lineTo(W * 0.5, 0);
    x.lineTo(W + 2, wallTop + 2);
    x.closePath(); x.fill();
    x.fillStyle = roofL;
    x.beginPath();
    x.moveTo(W * 0.5, 0); x.lineTo(W + 2, wallTop + 2); x.lineTo(W * 0.5, wallTop + 2);
    x.closePath(); x.fill();
    x.fillStyle = shade(roof, -0.25);
    x.fillRect(0, wallTop, W, 3);

    // shingle lines
    x.fillStyle = 'rgba(0,0,0,.13)';
    for (let yy = 4; yy < wallTop; yy += 4) {
      const t = yy / wallTop;
      const half = (W * 0.5) * t + 2;
      x.fillRect(W * 0.5 - half, yy, half * 2, 1);
    }

    /* ---- dormers ---- */
    if (b.dormers) {
      const n = b.dormers;
      for (let i = 1; i <= n; i++) {
        const px2 = Math.round((W / (n + 1)) * i - 8);
        const py = Math.round(wallTop * 0.52);
        x.fillStyle = wall; x.fillRect(px2, py, 16, 14);
        x.fillStyle = '#2b3340'; x.fillRect(px2 + 3, py + 4, 10, 9);
        x.fillStyle = roof;
        x.beginPath();
        x.moveTo(px2 - 2, py); x.lineTo(px2 + 8, py - 8); x.lineTo(px2 + 18, py); x.closePath(); x.fill();
      }
    }

    /* ---- chimneys ---- */
    const chim = b.chimneys == null ? 2 : b.chimneys;
    for (let i = 0; i < chim; i++) {
      const cx2 = i === 0 ? 8 : W - 26;
      x.fillStyle = '#8a5a4a'; x.fillRect(cx2, 2, 18, wallTop - 2);
      x.fillStyle = '#a06a56'; x.fillRect(cx2, 2, 18, 4);
      x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(cx2 + 13, 2, 5, wallTop - 2);
    }

    /* ---- cupola / steeple ---- */
    if (b.cupola) {
      const cw = 26, cx2 = Math.round(W / 2 - cw / 2);
      const ch = b.steeple ? 46 : 22;
      x.fillStyle = wall; x.fillRect(cx2, -ch + 4, cw, ch);
      x.fillStyle = '#2b3340'; x.fillRect(cx2 + 6, -ch + 10, 6, 10);
      x.fillStyle = '#6f8199'; x.fillRect(cx2 + 15, -ch + 10, 6, 10);
      x.fillStyle = roof;
      x.beginPath();
      x.moveTo(cx2 - 4, -ch + 4); x.lineTo(cx2 + cw / 2, -ch - 14); x.lineTo(cx2 + cw + 4, -ch + 4);
      x.closePath(); x.fill();
      x.fillStyle = '#c9a24a'; x.fillRect(cx2 + cw / 2 - 1, -ch - 24, 2, 12);
      // Note: negative coords clip. Buildings with a cupola declare extra elev.
    }

    /* ---- octagonal magazine gets a different silhouette ---- */
    if (b.octagon) {
      x.clearRect(0, 0, W, H);
      const cx2 = W / 2, cy2 = wallTop + (H - wallTop) / 2;
      const rr = Math.min(W, H - wallTop) / 2;
      x.fillStyle = wall;
      x.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + Math.PI / 8;
        const px2 = cx2 + Math.cos(a) * rr, py2 = cy2 + Math.sin(a) * rr * 0.95;
        i ? x.lineTo(px2, py2) : x.moveTo(px2, py2);
      }
      x.closePath(); x.fill();
      x.fillStyle = 'rgba(0,0,0,.10)';
      for (let yy = wallTop + 4; yy < H - 4; yy += 5) x.fillRect(0, yy, W, 1);
      x.globalCompositeOperation = 'destination-in';
      x.fillStyle = '#000';
      x.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + Math.PI / 8;
        x.lineTo(cx2 + Math.cos(a) * rr, cy2 + Math.sin(a) * rr * 0.95);
      }
      x.closePath(); x.fill();
      x.globalCompositeOperation = 'source-over';
      // conical roof
      x.fillStyle = roof;
      x.beginPath();
      x.moveTo(cx2 - rr, wallTop + 6); x.lineTo(cx2, 0); x.lineTo(cx2 + rr, wallTop + 6);
      x.closePath(); x.fill();
      x.fillStyle = '#2b3340'; x.fillRect(cx2 - 9, H - 30, 18, 30);
      x.fillStyle = '#c9a24a'; x.fillRect(cx2 - 1, -6, 2, 10);
    }

    this.cache.set(key, c);
    return c;
  },

  /** Pre-render everything the first frame will need. */
  warm() {
    this.getShadow();
    for (let i = 0; i < 4; i++) this.gem(i);
    ['food', 'magnet', 'bomb', 'chest', 'coin'].forEach(k => this.pickup(k));
    ['axe', 'log', 'bean', 'golf', 'shoe', 'burger', 'reel', 'moon', 'sat', 'mic', 'tank', 'plane',
     'crate', 'star', 'pinkslip', 'fireball', 'train'].forEach(k => this.fx(k));
    if (typeof BEAN_COLORS !== 'undefined') BEAN_COLORS.forEach(c => this.fx('bean', c));
    ['boat', 'corvette', 'chair', 'moose'].forEach(k => this.vehicle(k));
    ['flag_csa', 'flag_uk', 'flag_spain', 'flag_reich',
     'cannon', 'muskets', 'tent', 'barricade'].forEach(k => this.prop(k));
    this.escalator(); this.banner();
  }
};

/* ------------------------------------------------------------
   Color helper: lighten (amt > 0) or darken (amt < 0) a #rrggbb.
   ------------------------------------------------------------ */
function shade(hex, amt) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  let r = parseInt(h.slice(0, 2), 16),
      g = parseInt(h.slice(2, 4), 16),
      b = parseInt(h.slice(4, 6), 16);
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    const k = 1 + amt;
    r = Math.round(r * k); g = Math.round(g * k); b = Math.round(b * k);
  }
  return '#' + ((1 << 24) + (clamp(r, 0, 255) << 16) + (clamp(g, 0, 255) << 8) + clamp(b, 0, 255)).toString(16).slice(1);
}
