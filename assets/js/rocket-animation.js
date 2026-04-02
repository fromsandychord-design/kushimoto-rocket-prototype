/* ============================================
   SPACEPORT KII — Rocket Launch Animation
   Canvas-based scroll-driven rocket animation
   Extracted from rocket-launch-demo.html
   ============================================ */
(function() {
  'use strict';

  // ブラウザのスクロール位置復元を無効化（リロード時に正しい位置に戻すため）
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }

  // ======= CONFIG =======
  // シーン構成（カウントダウン除外、フレーム31からスタート）:
  // 1. 点火→リフトオフ 谷間の発射場 (31-60)
  // 2. 橋杭岩遠景から眺める上昇（感動シーン）(61-90)
  // 3. 近景に戻って上昇 (91-97)
  // 4. 斜め上POV 雲を突き抜ける（長め）(98-187)
  // 5. 同アングルで空が青→藍→黒 (188-217)
  // 6. 宇宙・地球の曲率 (218-242)
  // 7. 衛星軌道投入・デプロイ (243-256)
  var CONFIG = {
    totalFrames: 257,
    frameOffset: 31,       // カウントダウンをスキップ、フレーム31から開始
    scrollHeight: 15000,   // 元の1/3
    maxDpr: 2,
    scenes: [
      { name: 'ignition',     start: 31,  end: 60 },
      { name: 'distantView',  start: 61,  end: 90 },
      { name: 'closeAscent',  start: 91,  end: 97 },
      { name: 'cloudPOV',     start: 98,  end: 187 },
      { name: 'toSpace',      start: 188, end: 217 },
      { name: 'space',        start: 218, end: 242 },
      { name: 'deployment',   start: 243, end: 256 }
    ],
    particles: { smokeMax: 250, cloudMax: 200, starMax: 300, exhaustMax: 150 },
    colors: {
      orange: '#ff6b35', coral: '#ff4466', teal: '#00c9a7',
      gold: '#ffd700', skyBlue: '#4a90d9', deepBlue: '#0a1628',
      spaceBlack: '#050510'
    }
  };

  var state = {
    frame: 31, prevFrame: -1, scrollSpeed: 0, prevScrollSpeed: 0,
    scrollDirection: 1, lastScrollY: 0, lastScrollTime: 0,
    canvasW: 0, canvasH: 0, initialized: false, vibratedIgnition: false
  };

  // ======= SVG ASSETS =======
  var SVG = {
    // カイロスロケット — 真っ白・フィンなし・4頭身デフォルメ
    drawRocket: function(ctx, x, y, scale, rotation) {
      rotation = rotation || 0;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scale, scale);

      var bw = 14; // 胴体幅の半分

      // 胴体（白）
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-bw, -25);
      ctx.lineTo(-bw, 45);
      ctx.bezierCurveTo(-bw, 50, bw, 50, bw, 45);
      ctx.lineTo(bw, -25);
      ctx.closePath();
      ctx.fill();

      // 陰影（立体感）
      var shade = ctx.createLinearGradient(-bw, 0, bw, 0);
      shade.addColorStop(0, 'rgba(180,185,200,0.3)');
      shade.addColorStop(0.35, 'rgba(255,255,255,0)');
      shade.addColorStop(0.65, 'rgba(255,255,255,0)');
      shade.addColorStop(1, 'rgba(200,205,220,0.15)');
      ctx.fillStyle = shade;
      ctx.fillRect(-bw, -25, bw * 2, 75);

      // ノーズコーン（白、丸ドーム）
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-bw, -25);
      ctx.bezierCurveTo(-bw, -42, -9, -58, 0, -62);
      ctx.bezierCurveTo(9, -58, bw, -42, bw, -25);
      ctx.closePath();
      ctx.fill();

      // ノーズのハイライト
      var noseHL = ctx.createLinearGradient(-5, -60, 5, -30);
      noseHL.addColorStop(0, 'rgba(255,255,255,0.8)');
      noseHL.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = noseHL;
      ctx.beginPath();
      ctx.moveTo(-3, -55);
      ctx.bezierCurveTo(-8, -40, -bw + 2, -30, -bw + 2, -25);
      ctx.lineTo(-bw + 6, -25);
      ctx.bezierCurveTo(-6, -35, -2, -50, -3, -55);
      ctx.closePath();
      ctx.fill();

      // セクションライン
      ctx.strokeStyle = 'rgba(170,165,140,0.35)';
      ctx.lineWidth = 0.8;
      [-25, -5, 12, 28, 40].forEach(function(ly) {
        ctx.beginPath(); ctx.moveTo(-bw, ly); ctx.lineTo(bw, ly); ctx.stroke();
      });

      // ノズル
      ctx.fillStyle = '#3a3a3a';
      ctx.beginPath();
      ctx.moveTo(-10, 45); ctx.lineTo(-13, 56);
      ctx.bezierCurveTo(-13, 59, 13, 59, 13, 56);
      ctx.lineTo(10, 45); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath(); ctx.ellipse(0, 56, 9, 3, 0, 0, Math.PI * 2); ctx.fill();

      ctx.restore();
    },

    // 強力な噴射グロー
    drawExhaustFlare: function(ctx, x, y, scale, intensity) {
      if (intensity < 0.01) return;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);

      // 超高輝度コア
      var coreR = 25 * intensity;
      var core = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
      core.addColorStop(0, 'rgba(255,255,255,' + Math.min(1, intensity * 1.2) + ')');
      core.addColorStop(0.3, 'rgba(255,240,200,' + (0.9 * intensity) + ')');
      core.addColorStop(0.6, 'rgba(255,180,80,' + (0.5 * intensity) + ')');
      core.addColorStop(1, 'rgba(255,100,30,0)');
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2); ctx.fill();

      // 外側のグロー
      var outerR = 60 * intensity;
      var outer = ctx.createRadialGradient(0, 5, 0, 0, 5, outerR);
      outer.addColorStop(0, 'rgba(255,200,100,' + (0.4 * intensity) + ')');
      outer.addColorStop(0.4, 'rgba(255,120,40,' + (0.2 * intensity) + ')');
      outer.addColorStop(1, 'rgba(255,60,10,0)');
      ctx.fillStyle = outer;
      ctx.beginPath(); ctx.arc(0, 5, outerR, 0, Math.PI * 2); ctx.fill();

      // 噴射炎（下に伸びる）
      var flameH = 80 * intensity;
      var flame = ctx.createRadialGradient(0, flameH * 0.3, 0, 0, flameH * 0.3, flameH * 0.6);
      flame.addColorStop(0, 'rgba(255,255,230,' + (0.7 * intensity) + ')');
      flame.addColorStop(0.3, 'rgba(255,180,60,' + (0.5 * intensity) + ')');
      flame.addColorStop(0.7, 'rgba(255,80,20,' + (0.2 * intensity) + ')');
      flame.addColorStop(1, 'rgba(200,40,10,0)');
      ctx.fillStyle = flame;
      ctx.beginPath();
      ctx.moveTo(-15 * intensity, 0);
      ctx.bezierCurveTo(-20 * intensity, flameH * 0.4, -5, flameH, 0, flameH);
      ctx.bezierCurveTo(5, flameH, 20 * intensity, flameH * 0.4, 15 * intensity, 0);
      ctx.closePath(); ctx.fill();

      ctx.restore();
    },

    // 橋杭岩
    drawHashiguiIwa: function(ctx, x, y, scale, color) {
      ctx.save();
      ctx.translate(x, y); ctx.scale(scale, scale);
      ctx.fillStyle = color || '#0a1a2a';
      var rocks = [
        { cx: -120, w: 25, h: 80, t: 3 }, { cx: -80, w: 20, h: 95, t: -2 },
        { cx: -50, w: 30, h: 70, t: 4 },  { cx: -15, w: 22, h: 110, t: -1 },
        { cx: 15, w: 28, h: 85, t: 2 },   { cx: 50, w: 18, h: 100, t: -3 },
        { cx: 80, w: 24, h: 75, t: 1 },   { cx: 110, w: 20, h: 90, t: -2 },
        { cx: 140, w: 26, h: 65, t: 3 }
      ];
      rocks.forEach(function(r) {
        ctx.beginPath();
        ctx.moveTo(r.cx - r.w / 2, 0);
        ctx.bezierCurveTo(r.cx - r.w / 2 - 3, -r.h * 0.3, r.cx - r.w * 0.3, -r.h, r.cx, -r.h + r.t);
        ctx.bezierCurveTo(r.cx + r.w * 0.3, -r.h, r.cx + r.w / 2 + 3, -r.h * 0.3, r.cx + r.w / 2, 0);
        ctx.fill();
      });
      ctx.restore();
    },

    // 地球
    drawEarth: function(ctx, x, y, radius) {
      ctx.save(); ctx.translate(x, y);
      // 大気グロー
      var ag = ctx.createRadialGradient(0, 0, radius, 0, 0, radius * 1.15);
      ag.addColorStop(0, 'rgba(100,180,255,0.4)');
      ag.addColorStop(0.5, 'rgba(100,180,255,0.15)');
      ag.addColorStop(1, 'rgba(100,180,255,0)');
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.arc(0, 0, radius * 1.15, 0, Math.PI * 2); ctx.fill();
      // 本体
      var eg = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
      eg.addColorStop(0, '#4a90d9'); eg.addColorStop(0.4, '#2d6baa');
      eg.addColorStop(0.7, '#1a4a7a'); eg.addColorStop(1, '#0a2a4a');
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
      // 大陸
      ctx.fillStyle = 'rgba(40,160,80,0.5)';
      ctx.beginPath(); ctx.ellipse(-radius * 0.2, -radius * 0.1, radius * 0.3, radius * 0.2, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(radius * 0.3, radius * 0.2, radius * 0.2, radius * 0.15, -0.2, 0, Math.PI * 2); ctx.fill();
      // 雲
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath(); ctx.ellipse(0, -radius * 0.3, radius * 0.6, radius * 0.08, 0.1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },

    // 衛星
    drawSatellite: function(ctx, x, y, scale) {
      ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      // ボディ（金色の箱）
      ctx.fillStyle = '#c8a832';
      ctx.fillRect(-8, -6, 16, 12);
      ctx.strokeStyle = '#a08020';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-8, -6, 16, 12);
      // ソーラーパネル（左右）
      ctx.fillStyle = '#2244aa';
      ctx.fillRect(-35, -4, 25, 8);
      ctx.fillRect(10, -4, 25, 8);
      // パネルのグリッド
      ctx.strokeStyle = 'rgba(100,150,255,0.4)';
      ctx.lineWidth = 0.3;
      for (var i = -30; i <= -13; i += 5) { ctx.beginPath(); ctx.moveTo(i, -4); ctx.lineTo(i, 4); ctx.stroke(); }
      for (var j = 15; j <= 32; j += 5) { ctx.beginPath(); ctx.moveTo(j, -4); ctx.lineTo(j, 4); ctx.stroke(); }
      // アンテナ
      ctx.strokeStyle = '#888'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, -14); ctx.stroke();
      ctx.fillStyle = '#aaa';
      ctx.beginPath(); ctx.arc(0, -14, 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    },

    // 発射台
    drawLaunchPad: function(ctx, x, y, scale) {
      ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      ctx.strokeStyle = '#888'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-5, 0); ctx.lineTo(-8, -60); ctx.lineTo(8, -60); ctx.lineTo(5, 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -45); ctx.lineTo(15, -42); ctx.stroke();
      ctx.fillStyle = '#555'; ctx.fillRect(-15, -5, 30, 5);
      ctx.restore();
    }
  };

  // ======= PARTICLE SYSTEM =======
  function ParticlePool(max) {
    this.particles = [];
    for (var i = 0; i < max; i++) {
      this.particles.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1, size: 1, color: '#fff',
        alpha: 1, gravity: 0, drag: 0.98, sizeDecay: true
      });
    }
  }
  ParticlePool.prototype.emit = function(c) {
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      if (p.active) continue;
      p.active = true;
      p.x = c.x + (Math.random() - 0.5) * (c.spread || 0);
      p.y = c.y + (Math.random() - 0.5) * (c.spread || 0);
      p.vx = (c.vx || 0) + (Math.random() - 0.5) * (c.vxSpread || 0);
      p.vy = (c.vy || 0) + (Math.random() - 0.5) * (c.vySpread || 0);
      p.life = 0; p.maxLife = c.life || 60; p.size = c.size || 3;
      p.color = c.color || '#fff'; p.alpha = 1;
      p.gravity = c.gravity || 0; p.drag = c.drag || 0.98;
      p.sizeDecay = c.sizeDecay !== undefined ? c.sizeDecay : true;
      return p;
    }
    return null;
  };
  ParticlePool.prototype.emitBurst = function(c, n) {
    for (var i = 0; i < n; i++) this.emit(c);
  };
  ParticlePool.prototype.update = function() {
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      if (!p.active) continue;
      if (++p.life >= p.maxLife) { p.active = false; continue; }
      p.vx *= p.drag; p.vy *= p.drag; p.vy += p.gravity;
      p.x += p.vx; p.y += p.vy;
      p.alpha = 1 - p.life / p.maxLife;
      if (p.sizeDecay) p.size *= 0.98;
    }
  };
  ParticlePool.prototype.draw = function(ctx) {
    ctx.save();
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      if (!p.active || p.alpha < 0.01) continue;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
  ParticlePool.prototype.reset = function() {
    for (var i = 0; i < this.particles.length; i++) this.particles[i].active = false;
  };

  var P = {
    smoke: new ParticlePool(CONFIG.particles.smokeMax),
    cloud: new ParticlePool(CONFIG.particles.cloudMax),
    exhaust: new ParticlePool(CONFIG.particles.exhaustMax)
  };

  // ======= EFFECTS =======
  var FX = {
    speedLines: function(ctx, w, h, intensity) {
      if (intensity < 0.05) return;
      var n = Math.floor(intensity * 30);
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.3 * intensity) + ')';
      ctx.lineWidth = 1 + intensity * 3;
      for (var i = 0; i < n; i++) {
        var x = Math.random() * w, y = Math.random() * h, len = 30 + intensity * 120;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 5, y + len); ctx.stroke();
      }
      ctx.restore();
    },
    whiteFlash: function(op) {
      var overlay = document.getElementById('overlay');
      if (overlay) overlay.style.opacity = op;
    },
    waterDroplets: function(ctx, w, h, intensity) {
      if (intensity < 0.1) return;
      ctx.save();
      for (var i = 0; i < Math.floor(intensity * 15); i++) {
        var x = Math.random() * w, y = Math.random() * h, r = 2 + Math.random() * 6;
        var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,' + (0.3 * intensity) + ')');
        g.addColorStop(1, 'rgba(200,220,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },
    starStreaks: function(ctx, w, h, intensity) {
      if (intensity < 0.05) return;
      ctx.save();
      for (var i = 0; i < Math.floor(intensity * 25); i++) {
        var x = Math.random() * w, y = Math.random() * h, len = 5 + intensity * 50;
        ctx.strokeStyle = 'rgba(200,220,255,' + ((0.3 + Math.random() * 0.5) * intensity) + ')';
        ctx.lineWidth = 0.5 + Math.random() * 1.5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + len); ctx.stroke();
      }
      ctx.restore();
    },
    vibrate: function(d) {
      d = d || 50;
      if (navigator.vibrate) navigator.vibrate(d);
    }
  };

  // ======= SCENE RENDERERS =======
  var S = {
    // ユーティリティ
    gradBg: function(ctx, w, h, stops) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      stops.forEach(function(pair) { g.addColorStop(pair[0], pair[1]); });
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    },
    stars: function(ctx, w, h, density, seed) {
      seed = seed || 42;
      var s = seed;
      var rng = function() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
      var n = Math.floor(density * CONFIG.particles.starMax);
      var t = performance.now();
      ctx.save();
      for (var i = 0; i < n; i++) {
        var x = rng() * w, y = rng() * h, r = 0.5 + rng() * 2;
        ctx.globalAlpha = (0.4 + rng() * 0.6) * (0.5 + 0.5 * Math.sin(t * 0.003 + i * 1.7));
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    },
    waves: function(ctx, w, y, t, color) {
      ctx.save(); ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (var x = 0; x <= w; x += 8) {
        ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 0.002) * 5 + Math.sin(x * 0.01 + t * 0.001) * 3);
      }
      ctx.lineTo(w, y + 50); ctx.lineTo(0, y + 50); ctx.closePath(); ctx.fill();
      ctx.restore();
    },

    // 共通: 緑の山
    drawMountains: function(ctx, w, baseY, color, seed) {
      seed = seed || 1;
      ctx.save(); ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(0, baseY);
      var s = seed;
      var rng = function() { s = (s * 16807 + 7) % 2147483647; return (s - 1) / 2147483646; };
      for (var x = 0; x <= w; x += 5) {
        var h1 = Math.sin(x * 0.008 + seed) * 40 + Math.sin(x * 0.015 + seed * 2) * 25;
        var h2 = Math.sin(x * 0.003 + seed * 0.5) * 60;
        ctx.lineTo(x, baseY - 30 - Math.abs(h1) - Math.abs(h2) * rng());
      }
      ctx.lineTo(w, baseY + 200); ctx.lineTo(0, baseY + 200);
      ctx.closePath(); ctx.fill(); ctx.restore();
    },

    // 橋杭岩遠景の共通描画
    drawDistantScene: function(ctx, w, h, t, rocketTrailProgress) {
      rocketTrailProgress = rocketTrailProgress || 0;

      // 空: 明るい昼間の青空
      this.gradBg(ctx, w, h, [
        [0, '#5588cc'], [0.3, '#6699dd'], [0.6, '#88aadd'],
        [0.8, '#aabbdd'], [1, '#bbccdd']
      ]);

      // 薄い雲
      ctx.save(); ctx.globalAlpha = 0.3;
      [[w * 0.2, h * 0.15, 180, 30], [w * 0.7, h * 0.25, 150, 25],
       [w * 0.4, h * 0.1, 200, 35], [w * 0.85, h * 0.18, 120, 22]].forEach(function(c) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(c[0], c[1], c[2], c[3], 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();

      // 海
      var seaY = h * 0.52;
      var seaH = h * 0.25;
      var sg = ctx.createLinearGradient(0, seaY, 0, seaY + seaH);
      sg.addColorStop(0, '#5588aa'); sg.addColorStop(0.5, '#4a7a9a'); sg.addColorStop(1, '#3a6a8a');
      ctx.fillStyle = sg; ctx.fillRect(0, seaY, w, seaH);
      this.waves(ctx, w, seaY, t, 'rgba(90,150,180,0.15)');

      // 対岸の山
      this.drawMountains(ctx, w, seaY + 5, '#3a6a3a', 3);
      this.drawMountains(ctx, w, seaY + 15, '#2a5a2a', 7);

      // 小さな島々
      ctx.fillStyle = '#3a5a3a';
      [[w * 0.55, seaY + 8, 35, 15], [w * 0.62, seaY + 10, 25, 12],
       [w * 0.68, seaY + 12, 20, 8]].forEach(function(c) {
        ctx.beginPath(); ctx.ellipse(c[0], c[1], c[2], c[3], 0, -Math.PI, 0); ctx.fill();
      });

      // ロケット
      var padX = w * 0.48;
      var padBaseY = seaY - 20;
      var rocketRiseY = rocketTrailProgress * h * 0.5;
      var rocketY = padBaseY - 12 - rocketRiseY;

      // 飛行機雲
      if (rocketTrailProgress > 0) {
        ctx.save();
        var tg = ctx.createLinearGradient(padX, rocketY + 5, padX, padBaseY);
        tg.addColorStop(0, 'rgba(255,255,255,0.6)');
        tg.addColorStop(0.4, 'rgba(255,255,255,0.3)');
        tg.addColorStop(1, 'rgba(255,255,255,0.05)');
        ctx.strokeStyle = tg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padX, rocketY + 5);
        ctx.lineTo(padX, padBaseY);
        ctx.stroke();
        ctx.restore();
      }

      // ロケット本体
      var rocketScale = 0.18 - rocketTrailProgress * 0.06;
      SVG.drawRocket(ctx, padX, rocketY, Math.max(0.06, rocketScale));

      // 手前の地面
      var groundY = seaY + seaH;
      ctx.fillStyle = '#7a6a50';
      ctx.fillRect(0, groundY, w, h - groundY);
      ctx.fillStyle = '#6a5a40';
      for (var x = 0; x < w; x += 15) {
        ctx.fillRect(x, groundY + Math.sin(x * 0.1) * 3, 10, 5);
      }

      // 橋杭岩
      SVG.drawHashiguiIwa(ctx, w * 0.45, groundY + 3, 1.4, '#4a3a28');
      SVG.drawHashiguiIwa(ctx, w * 0.1, groundY + 5, 0.8, '#3a2a18');

      // 低木
      ctx.fillStyle = '#2a5a1a';
      [[w * 0.05, groundY, 40, 20], [w * 0.9, groundY - 5, 50, 25],
       [w * 0.75, groundY, 35, 18]].forEach(function(c) {
        ctx.beginPath(); ctx.ellipse(c[0], c[1], c[2], c[3], 0, -Math.PI, 0); ctx.fill();
      });
    },

    // ====== Scene 2: 点火→リフトオフ 谷間の発射場 (31-60) ======
    scene2: function(ctx, w, h, progress, speed) {
      var t = performance.now();

      // 空（明るい青空＋白い雲）
      this.gradBg(ctx, w, h, [
        [0, '#4488cc'], [0.3, '#5599dd'], [0.5, '#77aadd'],
        [0.7, '#99bbdd'], [1, '#bbccdd']
      ]);
      ctx.save(); ctx.globalAlpha = 0.5;
      [[w * 0.15, h * 0.2, 160, 40], [w * 0.6, h * 0.15, 200, 50],
       [w * 0.85, h * 0.25, 130, 35], [w * 0.35, h * 0.08, 180, 45]].forEach(function(c) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(c[0], c[1], c[2], c[3], 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();

      var ignitePhase = Math.min(progress / 0.15, 1);
      var liftPhase = Math.max(0, (progress - 0.15) / 0.85);
      var liftEase = liftPhase * liftPhase;

      var rocketScale = 3.0;
      var baseY = h * 0.5;
      var rocketY = baseY - liftEase * h * 1.5;

      // 奥の海
      ctx.fillStyle = '#5588aa';
      ctx.fillRect(w * 0.3, h * 0.45, w * 0.4, h * 0.1);

      // 左の山
      ctx.fillStyle = '#2a6a2a';
      ctx.beginPath();
      ctx.moveTo(-w * 0.1, h);
      ctx.bezierCurveTo(0, h * 0.3, w * 0.15, h * 0.2, w * 0.25, h * 0.35);
      ctx.bezierCurveTo(w * 0.3, h * 0.45, w * 0.33, h * 0.5, w * 0.35, h);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a7a3a';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.6);
      ctx.bezierCurveTo(w * 0.05, h * 0.35, w * 0.12, h * 0.25, w * 0.2, h * 0.38);
      ctx.lineTo(w * 0.15, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();

      // 右の山
      ctx.fillStyle = '#2a6a2a';
      ctx.beginPath();
      ctx.moveTo(w * 0.65, h);
      ctx.bezierCurveTo(w * 0.67, h * 0.5, w * 0.75, h * 0.2, w * 0.85, h * 0.3);
      ctx.bezierCurveTo(w * 0.95, h * 0.4, w * 1.05, h * 0.35, w * 1.1, h);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a8a3a';
      ctx.beginPath();
      ctx.moveTo(w * 0.7, h);
      ctx.bezierCurveTo(w * 0.72, h * 0.55, w * 0.78, h * 0.3, w * 0.88, h * 0.35);
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();

      // 発射台
      var padY = h * 0.78;
      ctx.fillStyle = '#888880';
      ctx.fillRect(w * 0.38, padY, w * 0.24, h * 0.05);
      ctx.fillStyle = '#666660';
      ctx.fillRect(w * 0.4, padY + h * 0.04, w * 0.04, h * 0.03);
      ctx.fillRect(w * 0.56, padY + h * 0.04, w * 0.04, h * 0.03);
      ctx.fillStyle = '#8a8070';
      ctx.fillRect(0, padY + h * 0.06, w, h);

      // ロケット
      SVG.drawRocket(ctx, w * 0.5, rocketY, rocketScale);

      // 噴射
      var exhaustY = rocketY + rocketScale * 56;
      SVG.drawExhaustFlare(ctx, w * 0.5, exhaustY, rocketScale * 0.8, ignitePhase);

      // レンズフレア
      if (ignitePhase > 0.3) {
        ctx.save();
        var lensR = 120 * ignitePhase;
        var lens = ctx.createRadialGradient(w * 0.5, exhaustY, 0, w * 0.5, exhaustY, lensR);
        lens.addColorStop(0, 'rgba(255,255,240,' + (0.5 * ignitePhase) + ')');
        lens.addColorStop(0.3, 'rgba(255,220,180,' + (0.3 * ignitePhase) + ')');
        lens.addColorStop(1, 'rgba(255,150,80,0)');
        ctx.fillStyle = lens;
        ctx.beginPath(); ctx.arc(w * 0.5, exhaustY, lensR, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // 大量の白い煙
      if (ignitePhase > 0.15) {
        var sr = ignitePhase;
        if (Math.random() < sr) {
          P.smoke.emitBurst({
            x: w * 0.5, y: exhaustY + 15, vx: -4, vy: -1, vxSpread: 6, vySpread: 4,
            spread: 30, size: 12 + Math.random() * 18,
            color: 'rgba(240,235,225,' + (0.25 + Math.random() * 0.25) + ')',
            life: 55, gravity: -0.02, drag: 0.94, sizeDecay: false
          }, Math.floor(sr * 5));
          P.smoke.emitBurst({
            x: w * 0.5, y: exhaustY + 15, vx: 4, vy: -1, vxSpread: 6, vySpread: 4,
            spread: 30, size: 12 + Math.random() * 18,
            color: 'rgba(240,235,225,' + (0.25 + Math.random() * 0.25) + ')',
            life: 55, gravity: -0.02, drag: 0.94, sizeDecay: false
          }, Math.floor(sr * 5));
          P.smoke.emitBurst({
            x: w * 0.5, y: padY, vx: 0, vy: 2, vxSpread: 15, vySpread: 3,
            spread: 60, size: 15 + Math.random() * 20,
            color: 'rgba(230,225,215,' + (0.2 + Math.random() * 0.2) + ')',
            life: 45, gravity: 0.01, drag: 0.93, sizeDecay: false
          }, Math.floor(sr * 3));
        }
      }

      if (ignitePhase > 0.1) {
        P.exhaust.emitBurst({
          x: w * 0.5, y: exhaustY, vx: 0, vy: 5, vxSpread: 5, vySpread: 3,
          size: 3 + Math.random() * 5,
          color: CONFIG.colors.orange, life: 15, drag: 0.93
        }, Math.floor(ignitePhase * 5));
      }

      if (progress > 0.08 && !state.vibratedIgnition && state.scrollDirection > 0) {
        FX.vibrate(200); state.vibratedIgnition = true;
      }

      if (ignitePhase > 0.4) {
        ctx.save(); ctx.globalAlpha = (ignitePhase - 0.4) * 0.12;
        ctx.fillStyle = 'rgba(255,180,80,1)'; ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      P.smoke.update(); P.smoke.draw(ctx);
      P.exhaust.update(); P.exhaust.draw(ctx);
    },

    // ====== Scene 3: 橋杭岩遠景から眺める上昇（感動シーン）(61-90) ======
    scene3: function(ctx, w, h, progress, speed) {
      var t = performance.now();
      this.drawDistantScene(ctx, w, h, t, progress);
    },

    // ====== Scene 4: 近景に戻って上昇 (91-97) ======
    scene4: function(ctx, w, h, progress, speed) {
      var t = performance.now();

      this.gradBg(ctx, w, h, [
        [0, '#1a4a8a'], [0.5, '#4a80cc'], [1, '#8ab8ee']
      ]);

      // 地上が離れていく
      var groundDrop = progress * h * 2;
      var groundY = h * 0.85 + groundDrop;
      if (groundY < h + 200) {
        ctx.fillStyle = '#1a3a1a';
        ctx.beginPath(); ctx.moveTo(0, groundY);
        for (var x = 0; x <= w; x += 30) {
          ctx.lineTo(x, groundY - 10 - Math.sin(x * 0.01) * 15 - Math.cos(x * 0.02) * 8);
        }
        ctx.lineTo(w, h + 500); ctx.lineTo(0, h + 500); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,80,150,0.4)';
        ctx.fillRect(0, groundY + 20, w, h);
      }

      // ロケット
      var rocketX = w * 0.5, rocketY = h * 0.35;
      SVG.drawRocket(ctx, rocketX, rocketY, 2.5);
      var exhaustY = rocketY + 2.5 * 56;
      SVG.drawExhaustFlare(ctx, rocketX, exhaustY, 2, 0.8);

      // 飛行機雲（真下）
      ctx.save();
      var trailLen = h - exhaustY + groundDrop * 0.5;
      var tg = ctx.createLinearGradient(rocketX, exhaustY + 30, rocketX, exhaustY + trailLen);
      tg.addColorStop(0, 'rgba(255,255,255,0.5)');
      tg.addColorStop(0.3, 'rgba(255,255,255,0.2)');
      tg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = tg; ctx.lineWidth = 5 + progress * 3;
      ctx.beginPath(); ctx.moveTo(rocketX, exhaustY + 30); ctx.lineTo(rocketX, exhaustY + trailLen); ctx.stroke();
      ctx.restore();

      P.smoke.emitBurst({
        x: rocketX, y: exhaustY + 10, vx: 0, vy: 4, vxSpread: 5, vySpread: 2,
        size: 5 + Math.random() * 6, color: 'rgba(255,255,255,0.25)', life: 35, drag: 0.96, gravity: 0.02
      }, 3);
      P.smoke.update(); P.smoke.draw(ctx);

      // 雲が近づいてくる
      if (progress > 0.6) {
        var cloudApproach = (progress - 0.6) / 0.4;
        ctx.save();
        ctx.globalAlpha = cloudApproach * 0.6;
        var cloudTopY = -h * 0.3 + cloudApproach * h * 0.5;
        for (var i = 0; i < 6; i++) {
          ctx.fillStyle = 'rgba(240,245,250,' + (0.3 + i * 0.05) + ')';
          var cx = w * (0.1 + i * 0.15) + Math.sin(i * 2.3) * 40;
          ctx.beginPath();
          ctx.ellipse(cx, cloudTopY + i * 20, 130 + i * 20, 35 + i * 10, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 速度線
      if (speed > 0.05 || progress > 0.2) {
        var lineI = Math.max(speed, progress * 0.6);
        var count = Math.floor(lineI * 30);
        ctx.save();
        for (var j = 0; j < count; j++) {
          var lx = Math.random() * w;
          var ly = Math.random() * h;
          var len = 40 + lineI * 150;
          var alpha = 0.1 + lineI * 0.25;
          ctx.strokeStyle = 'rgba(255,255,255,' + (alpha * (0.5 + Math.random() * 0.5)) + ')';
          ctx.lineWidth = 1 + lineI * 2 + Math.random();
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(lx, ly + len);
          ctx.stroke();
        }
        ctx.restore();
      }
    },

    // ====== Scene 5: 斜め上POV 雲を突き抜ける (98-187) ======
    scene5: function(ctx, w, h, progress, speed) {
      var t = performance.now();

      var inCloudP = Math.min(progress / 0.4, 1);
      var breakP = Math.max(0, Math.min((progress - 0.4) / 0.3, 1));
      var aboveP = Math.max(0, (progress - 0.7) / 0.3);

      // 背景: 白→青→深い青
      if (progress < 0.5) {
        var density = 1 - progress * 1.5;
        ctx.fillStyle = 'rgba(230,235,245,' + Math.max(0, density) + ')';
        ctx.fillRect(0, 0, w, h);
        if (density < 1) {
          this.gradBg(ctx, w, h, [
            [0, 'rgba(40,90,170,' + (1 - density) + ')'],
            [1, 'rgba(120,170,220,' + (1 - density) + ')']
          ]);
          ctx.fillStyle = 'rgba(230,235,245,' + (density * 0.8) + ')';
          ctx.fillRect(0, 0, w, h);
        }
      } else {
        var skyP = (progress - 0.5) / 0.5;
        this.gradBg(ctx, w, h, [
          [0, 'hsl(215, ' + (55 - skyP * 15) + '%, ' + (25 - skyP * 10) + '%)'],
          [1, 'hsl(210, ' + (50 - skyP * 20) + '%, ' + (45 - skyP * 20) + '%)']
        ]);
      }

      // ロケット全体（斜め上）
      SVG.drawRocket(ctx, w * 0.48, h * 0.35, 3.5, 0.08);
      SVG.drawExhaustFlare(ctx, w * 0.48, h * 0.35 + 3.5 * 56, 2.5, 0.7);

      // 雲がパース的に収束
      var cx = w * 0.5, cy = h * 1.1;
      var cloudDensity = progress < 0.5 ? (1 - progress * 1.8) : 0;

      if (cloudDensity > 0) {
        ctx.save();
        for (var i = 0; i < 25; i++) {
          var angle = (i / 25) * Math.PI * 2;
          var dist = 80 + (i % 5) * 60 + Math.sin(t * 0.001 + i * 2) * 20;
          var cloudX = cx + Math.cos(angle) * dist;
          var cloudYp = cy + Math.sin(angle) * dist * 0.4;
          var sz = 30 + dist * 0.3;

          ctx.globalAlpha = cloudDensity * 0.35 * (1 - dist / 500);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(cloudX, cloudYp - h * 0.3, sz, sz * 0.4, angle * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 速度線（収束点に向かう）
      var speedFade = progress < 0.5 ? 1 : Math.max(0, 1 - (progress - 0.5) / 0.3);
      if (speedFade > 0) {
        ctx.save();
        var lineI = (0.6 + speed * 0.4) * speedFade;
        var lineCount = Math.floor(lineI * 30);
        for (var j = 0; j < lineCount; j++) {
          var a = Math.random() * Math.PI * 2;
          var r1 = 40 + Math.random() * 80;
          var r2 = r1 + 60 + lineI * 100;
          ctx.strokeStyle = 'rgba(255,255,255,' + ((0.15 + Math.random() * 0.15) * lineI) + ')';
          ctx.lineWidth = 1 + lineI * 1.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r1, cy - h * 0.3 + Math.sin(a) * r1 * 0.4);
          ctx.lineTo(cx + Math.cos(a) * r2, cy - h * 0.3 + Math.sin(a) * r2 * 0.4);
          ctx.stroke();
        }
        ctx.restore();
      }

      FX.waterDroplets(ctx, w, h, cloudDensity * 0.8);
    },

    // ====== Scene 6: 空が青→藍→黒 (188-217) ======
    scene6: function(ctx, w, h, progress, speed) {
      var t = performance.now();

      var hue = 215 + progress * 15;
      var sat = 40 - progress * 30;
      var light = 15 - progress * 13;

      this.gradBg(ctx, w, h, [
        [0, 'hsl(' + hue + ', ' + Math.max(5, sat) + '%, ' + Math.max(2, light) + '%)'],
        [1, 'hsl(' + (hue + 5) + ', ' + Math.max(5, sat - 10) + '%, ' + Math.max(3, light + 5) + '%)']
      ]);

      // 星（後半から出現）
      if (progress > 0.3) {
        this.stars(ctx, w, h, (progress - 0.3) / 0.7 * 0.6);
      }

      // ロケット全体
      SVG.drawRocket(ctx, w * 0.48, h * 0.35, 3.5, 0.08);

      // 噴射
      var exhaustI = 0.6 - progress * 0.3;
      if (exhaustI > 0) {
        SVG.drawExhaustFlare(ctx, w * 0.48, h * 0.35 + 3.5 * 56, 2, exhaustI);
      }

      // 宇宙移行
      if (speed > 0.3 && progress < 0.5) {
        FX.starStreaks(ctx, w, h, speed * 0.2);
      }
    },

    // ====== Scene 7: 宇宙・地球の曲率 (218-242) ======
    scene7: function(ctx, w, h, progress, speed) {
      var t = performance.now();

      ctx.fillStyle = CONFIG.colors.spaceBlack;
      ctx.fillRect(0, 0, w, h);

      this.stars(ctx, w, h, 0.5 + progress * 0.3);

      // 地球の曲率
      var curveY = h * 0.75 - progress * h * 0.05;
      var curveR = w * 2.5;

      ctx.save();
      ctx.beginPath();
      ctx.arc(w * 0.5, curveY + curveR, curveR, -Math.PI * 0.15, -Math.PI * 0.85, true);
      ctx.lineTo(0, h); ctx.lineTo(w, h); ctx.closePath();
      ctx.clip();

      ctx.fillStyle = '#0a3060';
      ctx.fillRect(0, 0, w, h);

      // 陸地
      ctx.fillStyle = '#1a5a2a';
      ctx.beginPath();
      ctx.ellipse(w * 0.3, curveY + 30, w * 0.2, 40, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(w * 0.65, curveY + 50, w * 0.15, 30, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a6a3a';
      ctx.beginPath(); ctx.ellipse(w * 0.5, curveY + 20, 25, 12, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * 0.8, curveY + 35, 15, 8, 0, 0, Math.PI * 2); ctx.fill();

      // 雲
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.ellipse(w * 0.4, curveY + 15, w * 0.3, 8, 0.05, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * 0.7, curveY + 40, w * 0.2, 6, -0.1, 0, Math.PI * 2); ctx.fill();

      ctx.restore();

      // 大気グロー
      ctx.save();
      ctx.strokeStyle = 'rgba(100,180,255,' + (0.3 + progress * 0.3) + ')';
      ctx.lineWidth = 3 + progress * 5;
      ctx.shadowColor = 'rgba(100,180,255,0.4)';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(w * 0.5, curveY + curveR, curveR, -Math.PI * 0.13, -Math.PI * 0.87, true);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // ロケット
      var rs = 2.0 - progress * 0.8;
      SVG.drawRocket(ctx, w * 0.5, h * 0.35, rs);
      SVG.drawExhaustFlare(ctx, w * 0.5, h * 0.35 + rs * 56, rs * 0.5, 0.3 - progress * 0.15);
    },

    // ====== Scene 8: 衛星軌道投入・デプロイ (243-256) ======
    scene8: function(ctx, w, h, progress, speed) {
      var t = performance.now();

      ctx.fillStyle = CONFIG.colors.spaceBlack;
      ctx.fillRect(0, 0, w, h);

      this.stars(ctx, w, h, 0.85);

      // 地球
      var earthR = Math.min(w, h) * 0.45;
      var earthY = h * 0.85;
      SVG.drawEarth(ctx, w * 0.5, earthY, earthR);

      if (progress < 0.4) {
        // フェーズA: ロケットが軌道に乗る
        var pA = progress / 0.4;
        var rocketX = w * 0.3 + pA * w * 0.2;
        var rocketY = h * 0.35 - Math.sin(pA * Math.PI * 0.3) * h * 0.05;
        SVG.drawRocket(ctx, rocketX, rocketY, 1.0, -Math.PI * 0.05);
        SVG.drawExhaustFlare(ctx, rocketX - 5, rocketY + 58, 0.7, 0.5 * (1 - pA));

      } else if (progress < 0.7) {
        // フェーズB: フェアリング分離、衛星放出
        var pB = (progress - 0.4) / 0.3;
        var rktX = w * 0.5;
        var rktY = h * 0.3;

        SVG.drawRocket(ctx, rktX - pB * 30, rktY, 0.8 * (1 - pB * 0.5), -Math.PI * 0.1 * pB);

        var satX = rktX + pB * 60;
        var satY = rktY - pB * 20;
        var satScale = 0.5 + pB * 1.0;
        SVG.drawSatellite(ctx, satX, satY, satScale);

        // 分離の光
        if (pB > 0.1 && pB < 0.5) {
          var sparkI = (0.5 - Math.abs(pB - 0.3)) / 0.2;
          ctx.save();
          var sg = ctx.createRadialGradient(rktX + pB * 20, rktY, 0, rktX + pB * 20, rktY, 15 * sparkI);
          sg.addColorStop(0, 'rgba(255,255,200,' + (0.6 * sparkI) + ')');
          sg.addColorStop(1, 'rgba(255,200,100,0)');
          ctx.fillStyle = sg;
          ctx.beginPath(); ctx.arc(rktX + pB * 20, rktY, 15 * sparkI, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }

      } else {
        // フェーズC: 衛星が軌道へ
        var pC = (progress - 0.7) / 0.3;

        var orbitAngle = -Math.PI * 0.15 + pC * Math.PI * 0.4;
        var orbitRx = earthR * 1.3;
        var orbitRy = earthR * 0.3;
        var satOX = w * 0.5 + Math.cos(orbitAngle) * orbitRx;
        var satOY = earthY - earthR * 0.5 + Math.sin(orbitAngle) * orbitRy;

        // 軌道線（破線）
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 8]);
        ctx.beginPath();
        ctx.ellipse(w * 0.5, earthY - earthR * 0.5, orbitRx, orbitRy, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        SVG.drawSatellite(ctx, satOX, satOY, 1.2 + Math.sin(t * 0.002) * 0.05);

        // ロケット上段（消えていく光点）
        var rocketFade = 1 - pC;
        if (rocketFade > 0.1) {
          ctx.save();
          ctx.globalAlpha = rocketFade * 0.6;
          var dg = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.3, h * 0.2, 6);
          dg.addColorStop(0, 'rgba(255,200,100,0.8)');
          dg.addColorStop(1, 'rgba(255,150,50,0)');
          ctx.fillStyle = dg;
          ctx.beginPath(); ctx.arc(w * 0.3, h * 0.2, 6, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }

      // 最終フレーム付近: 余韻
      if (progress > 0.92) {
        var fadeP = (progress - 0.92) / 0.08;
        ctx.save();
        ctx.globalAlpha = fadeP * 0.3;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
    }
  };

  // ======= CANVAS INIT =======
  var canvas = document.getElementById('rocket-canvas');
  if (!canvas) return; // アニメーション要素がなければ何もしない

  var ctx = canvas.getContext('2d');

  function resizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
    state.canvasW = window.innerWidth;
    state.canvasH = window.innerHeight;
    canvas.width = state.canvasW * dpr;
    canvas.height = state.canvasH * dpr;
    canvas.style.width = state.canvasW + 'px';
    canvas.style.height = state.canvasH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // ======= SCROLL CONTROLLER =======
  // GSAPは既にページで読み込み済み（main.jsと共有）
  gsap.registerPlugin(ScrollTrigger);

  function updateScrollSpeed() {
    var now = performance.now();
    var currentY = window.scrollY;
    var dt = (now - state.lastScrollTime) / 1000;
    if (dt > 0) {
      var dy = currentY - state.lastScrollY;
      state.scrollDirection = dy >= 0 ? 1 : -1;
      var speedVhPerSec = Math.abs(dy / window.innerHeight * 100) / dt;
      state.prevScrollSpeed = state.scrollSpeed;
      state.scrollSpeed = Math.min(speedVhPerSec / 120, 1.0);
    }
    state.lastScrollY = currentY;
    state.lastScrollTime = now;
  }

  function decaySpeed() {
    state.prevScrollSpeed = state.scrollSpeed;
    state.scrollSpeed *= 0.92;
    if (state.scrollSpeed < 0.01) state.scrollSpeed = 0;
  }

  // ======= 初期スクロール位置 =======
  // ページロード時にスペーサーの最下部（サイトコンテンツの直前）に配置
  // 上スクロール → アニメーション再生 / 下スクロール → 通常サイト
  var spacer = document.getElementById('scroll-spacer');

  // 即座にスペーサー最下部へ（DOMContentLoaded前でも実行）
  function scrollToSpacerBottom() {
    if (spacer) {
      var targetY = spacer.offsetTop + spacer.offsetHeight - window.innerHeight;
      window.scrollTo(0, targetY);
    }
  }
  // 複数タイミングで実行し確実に位置を合わせる
  scrollToSpacerBottom();
  window.addEventListener('load', function() {
    scrollToSpacerBottom();
    setTimeout(function() {
      ScrollTrigger.refresh();
      scrollToSpacerBottom();
    }, 150);
  });
  if (document.readyState === 'complete') {
    scrollToSpacerBottom();
  }

  // ======= フレームマッピング: UP scroll = animation forward =======
  // scrollTop最下部(spacer bottom) → frame 31(開始)
  // scrollTop最上部(0) → frame 256(終了)
  var frameObj = { value: 0 };
  var usableFrames = CONFIG.totalFrames - CONFIG.frameOffset - 1; // 225
  var maxFrameReached = CONFIG.frameOffset; // ラチェット: 到達最大フレーム
  var animationComplete = false;

  gsap.to(frameObj, {
    value: usableFrames,
    snap: 'value',
    ease: 'none',
    scrollTrigger: {
      trigger: '#scroll-spacer',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5,
      onUpdate: function() {
        // UP scroll → higher frame (inverted: spacer bottom=frame31, top=frame256)
        var rawFrame = (usableFrames - frameObj.value) + CONFIG.frameOffset;
        // ラチェット: 一度到達したフレームより戻らない
        if (rawFrame > maxFrameReached) {
          maxFrameReached = rawFrame;
        }
        state.frame = maxFrameReached;
        updateScrollSpeed();
      }
    }
  });

  // ======= アニメーション完了 → サイトへ遷移 =======
  function transitionToSite() {
    if (animationComplete) return;
    animationComplete = true;

    // ホワイトフラッシュ → フェードアウト → サイトコンテンツへ
    var overlay = document.getElementById('overlay');
    if (overlay) {
      overlay.style.transition = 'opacity 0.6s ease';
      overlay.style.opacity = '1';
    }

    setTimeout(function() {
      // キャンバス・UI非表示
      var rCanvas = document.getElementById('rocket-canvas');
      var rUi = document.getElementById('rocket-ui');
      if (rCanvas) rCanvas.style.display = 'none';
      if (rUi) rUi.style.display = 'none';

      // スペーサーを除去（上スクロール領域をなくす）
      if (spacer) spacer.style.display = 'none';

      // サイトコンテンツの先頭へ
      window.scrollTo(0, 0);
      ScrollTrigger.refresh();

      // オーバーレイをフェードアウト
      setTimeout(function() {
        if (overlay) {
          overlay.style.opacity = '0';
          setTimeout(function() {
            if (overlay) overlay.style.display = 'none';
          }, 600);
        }
      }, 200);
    }, 700);
  }

  // ======= 下スクロール時のキャンバス非表示 =======
  // サイトコンテンツ領域に入ったらキャンバスをフェードアウト
  ScrollTrigger.create({
    trigger: '#site-content',
    start: 'top bottom',
    end: 'top top',
    onEnter: function() {
      gsap.to('#rocket-canvas', { opacity: 0, duration: 0.5, ease: 'power2.out' });
      gsap.to('#rocket-ui', { opacity: 0, duration: 0.5, ease: 'power2.out' });
    },
    onLeaveBack: function() {
      if (!animationComplete) {
        gsap.to('#rocket-canvas', { opacity: 1, duration: 0.3, ease: 'power2.in' });
        gsap.to('#rocket-ui', { opacity: 1, duration: 0.3, ease: 'power2.in' });
      }
    }
  });

  // ======= HERO TITLE DISPLAY =======
  // フレーム61-120（遠景・近景上昇シーン）でヒーロータイトルを表示
  function updateHeroTitle(frame) {
    var heroTitle = document.getElementById('hero-title');
    if (!heroTitle) return;

    if (frame >= 61 && frame <= 120) {
      // フェードイン/アウト計算
      var opacity = 1;
      if (frame < 70) {
        opacity = (frame - 61) / 9; // フレーム61-70: フェードイン
      } else if (frame > 110) {
        opacity = (120 - frame) / 10; // フレーム110-120: フェードアウト
      }
      heroTitle.style.display = 'flex';
      heroTitle.style.opacity = Math.max(0, Math.min(1, opacity));
    } else {
      heroTitle.style.display = 'none';
      heroTitle.style.opacity = 0;
    }
  }

  // ======= RENDER LOOP =======
  function getSceneIndex(frame) {
    for (var i = 0; i < CONFIG.scenes.length; i++) {
      if (frame <= CONFIG.scenes[i].end) return i;
    }
    return CONFIG.scenes.length - 1;
  }

  function getSceneProgress(frame, scene) {
    var range = scene.end - scene.start;
    return range > 0 ? Math.max(0, Math.min(1, (frame - scene.start) / range)) : 0;
  }

  function render() {
    var frame = Math.round(state.frame);
    decaySpeed();

    if (frame === state.prevFrame && state.scrollSpeed < 0.01) {
      requestAnimationFrame(render);
      return;
    }

    var sceneIdx = getSceneIndex(frame);
    var scene = CONFIG.scenes[sceneIdx];
    var progress = getSceneProgress(frame, scene);
    var w = state.canvasW, h = state.canvasH;

    ctx.clearRect(0, 0, w, h);

    // シーン番号は元のdemoと同じ（scene2〜scene8）
    var sceneFunc = 'scene' + (sceneIdx + 2);
    if (S[sceneFunc]) {
      S[sceneFunc](ctx, w, h, progress, state.scrollSpeed);
    }

    // クロスフェード（3フレーム）
    if (sceneIdx > 0 && frame <= scene.start + 1) {
      var fadeP = (frame - scene.start + 1) / 3;
      if (fadeP < 1) {
        ctx.save();
        ctx.globalAlpha = 1 - fadeP;
        var prevFunc = 'scene' + (sceneIdx + 1);
        if (S[prevFunc]) {
          S[prevFunc](ctx, w, h, 1, state.scrollSpeed);
        }
        ctx.restore();
      }
    }

    // ヒーロータイトルの表示制御
    updateHeroTitle(frame);

    // アニメーション完了チェック（最終フレーム到達）
    if (frame >= CONFIG.totalFrames - 2 && !animationComplete) {
      transitionToSite();
    }

    state.prevFrame = frame;
    requestAnimationFrame(render);
  }

  // ======= APP INIT =======
  function init() {
    var loadingBar = document.getElementById('loading-bar');
    var loading = document.getElementById('loading');
    var scrollHint = document.getElementById('scroll-hint');
    var skipBtn = document.getElementById('skip-btn');

    // prefers-reduced-motion対応
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (loading) loading.style.display = 'none';
      // 初期フレームを描画
      S.scene2(ctx, state.canvasW, state.canvasH, 0, 0);
      return;
    }

    // ローディングアニメーション
    var loadProgress = 0;
    var loadInterval = setInterval(function() {
      loadProgress += Math.random() * 15 + 5;
      if (loadProgress >= 100) {
        loadProgress = 100;
        clearInterval(loadInterval);
        setTimeout(function() {
          if (loading) loading.style.opacity = '0';
          setTimeout(function() {
            if (loading) loading.style.display = 'none';
            if (scrollHint) scrollHint.style.display = 'block';
            if (skipBtn) skipBtn.style.display = 'block';
            state.initialized = true;
          }, 600);
        }, 300);
      }
      if (loadingBar) loadingBar.style.width = loadProgress + '%';
    }, 100);

    // スキップボタン: アニメーションをスキップしてサイトへ
    if (skipBtn) {
      skipBtn.addEventListener('click', function() {
        transitionToSite();
      });
    }

    // スクロールヒントの非表示（上スクロールで50px以上動いたら）
    var hintHidden = false;
    var initialScrollY = null;
    window.addEventListener('scroll', function() {
      if (initialScrollY === null) initialScrollY = window.scrollY;
      // UP scroll で50px以上動いたら非表示
      if (!hintHidden && initialScrollY - window.scrollY > 50) {
        if (scrollHint) {
          scrollHint.style.opacity = '0';
          scrollHint.style.transition = 'opacity 0.5s';
          setTimeout(function() { scrollHint.style.display = 'none'; }, 500);
        }
        hintHidden = true;
      }
    });

    // ページはスペーサー最下部から開始（scrollToSpacerBottomで設定済み）
    requestAnimationFrame(render);
  }

  init();
})();
