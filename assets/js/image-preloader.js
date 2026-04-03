/* ============================================
   IMAGE PRELOADER — Phase 2 画像素材読み込み基盤
   全素材を先読みしてからアニメーション開始。
   WebP優先、フォールバックPNG。
   画像未配置時はプレースホルダー（Canvas生成）で動作。
   ============================================ */
var ImagePreloader = (function() {
  'use strict';

  // ======= 素材マニフェスト =======
  // key: 参照用ID, file: ファイル名（拡張子なし）, placeholder: プレースホルダー色, width/height: 生成サイズ
  var MANIFEST = [
    { key: 'scene2-bg',            file: 'scene2-bg',            placeholder: '#1a0a2e', width: 1920, height: 1080 },
    { key: 'scene2-rocket',        file: 'scene2-rocket',        placeholder: '#ffffff', width: 200,  height: 500  },
    { key: 'scene4-silhouette-fg', file: 'scene4-silhouette-fg', placeholder: '#0a1a0a', width: 1920, height: 1080 },
    { key: 'scene4-silhouette-mg', file: 'scene4-silhouette-mg', placeholder: '#1a2a1a', width: 1920, height: 1080 },
    { key: 'scene4-silhouette-bg', file: 'scene4-silhouette-bg', placeholder: '#2a3a2a', width: 1920, height: 1080 },
    { key: 'scene5a-cloud',        file: 'scene5a-cloud',        placeholder: '#c8c8d0', width: 1920, height: 1080 },
    { key: 'scene5b-sky',          file: 'scene5b-sky',          placeholder: '#4a90d9', width: 1920, height: 1080 },
    { key: 'scene6-gradient',      file: 'scene6-gradient',      placeholder: '#0a1628', width: 1080, height: 1920 },
    { key: 'scene7-earth',         file: 'scene7-earth',         placeholder: '#1a4a7a', width: 1920, height: 1080 },
    { key: 'scene8-satellite',     file: 'scene8-satellite',     placeholder: '#050510', width: 1920, height: 1080 },
    { key: 'scene2_5-heli',        file: 'scene2_5-heli',        placeholder: '#2a4a6a', width: 1080, height: 1920 },
    { key: 'scene2_7-spectators',  file: 'scene2_7-spectators',  placeholder: '#3a2a1a', width: 1024, height: 1024 }
  ];

  // 画像ストア: { key: HTMLImageElement | HTMLCanvasElement }
  var images = {};

  // ======= プレースホルダー生成 =======
  // 単色矩形をCanvasで生成し、画像の代わりに使う
  function createPlaceholder(entry) {
    var canvas = document.createElement('canvas');
    canvas.width = entry.width;
    canvas.height = entry.height;
    var ctx = canvas.getContext('2d');

    // 背景色
    ctx.fillStyle = entry.placeholder;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ラベル（開発時の視認用）
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry.key, canvas.width / 2, canvas.height / 2);

    // サイズ表示
    ctx.font = '16px monospace';
    ctx.fillText(canvas.width + ' x ' + canvas.height, canvas.width / 2, canvas.height / 2 + 30);

    return canvas;
  }

  // ======= 単一画像読み込み =======
  // WebPを試行→失敗時にPNGフォールバック→それも失敗ならプレースホルダー
  function loadImage(entry) {
    var basePath = 'assets/images/';

    return new Promise(function(resolve) {
      var img = new Image();

      // WebP読み込み成功
      img.onload = function() {
        images[entry.key] = img;
        resolve({ key: entry.key, source: 'webp' });
      };

      // WebP失敗 → PNGフォールバック
      img.onerror = function() {
        var imgPng = new Image();

        imgPng.onload = function() {
          images[entry.key] = imgPng;
          resolve({ key: entry.key, source: 'png' });
        };

        // PNGも失敗 → プレースホルダー
        imgPng.onerror = function() {
          images[entry.key] = createPlaceholder(entry);
          resolve({ key: entry.key, source: 'placeholder' });
        };

        imgPng.src = basePath + entry.file + '.png';
      };

      img.src = basePath + entry.file + '.webp';
    });
  }

  // ======= 全素材一括読み込み =======
  // onProgress(loaded, total): 進捗コールバック
  // 戻り値: Promise<{images, stats}>
  function loadAll(onProgress) {
    var total = MANIFEST.length;
    var loaded = 0;
    var stats = { webp: 0, png: 0, placeholder: 0 };

    var promises = MANIFEST.map(function(entry) {
      return loadImage(entry).then(function(result) {
        loaded++;
        stats[result.source]++;
        if (typeof onProgress === 'function') {
          onProgress(loaded, total);
        }
        return result;
      });
    });

    return Promise.all(promises).then(function(results) {
      return { images: images, stats: stats, results: results };
    });
  }

  // ======= 公開API =======
  return {
    // 全素材マニフェスト
    MANIFEST: MANIFEST,

    // 全素材を読み込む
    // onProgress(loaded, total): 進捗コールバック
    // 戻り値: Promise
    loadAll: loadAll,

    // key で画像を取得（HTMLImageElement or HTMLCanvasElement）
    // 未読み込みの場合はnullを返す
    get: function(key) {
      return images[key] || null;
    },

    // 全画像オブジェクトを取得
    getAll: function() {
      return images;
    },

    // マニフェストにエントリを追加（将来の拡張用）
    addEntry: function(entry) {
      MANIFEST.push(entry);
    },

    // プレースホルダーを手動生成（テスト用）
    createPlaceholder: createPlaceholder
  };
})();
