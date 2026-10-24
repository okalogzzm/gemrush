/* ============================================================
   重ねて表示する画面（開始画面・メニュー・ルール説明）
   ============================================================ */
import { saveStatus, type SaveData } from '../app/save.ts';
import { CPU_LEVELS } from '../cpu/index.ts';
import { COLORS, JP } from '../game/constants.ts';
import { getPoints } from '../game/rules.ts';
import type { Card, Noble } from '../game/types.ts';
import { cardHTML, gemShape, nobleHTML, tokenHTML } from './components.ts';
import { $ } from './dom.ts';

// ---------- 開始画面 ----------
export function renderStartScreen(save: SaveData | null): void {
  let resume = '';
  if (save) {
    const g = save.game;
    const mode = save.settings.mode === 'pvp' ? '2人対戦' : `CPU（${CPU_LEVELS[save.settings.level] ?? ''}）`;
    const pts = g.players.map(p => `${p.name} ${getPoints(p)}点`).join(' ／ ');
    let when = '';
    try {
      when = new Date(save.savedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { /* 日付が読めなくても続ける */ }
    resume = `<div class="resume-box">
      <b>前回の続きがあります</b>
      <small>${mode}・ラウンド${g.round}<br>${pts}${when ? `<br>保存：${when}` : ''}</small>
      <button class="btn primary big" data-act="resume">続きから</button>
    </div>
    <h3>新しく始める</h3>`;
  } else {
    resume = '<p>CPUの強さを選んでください（先手はランダム）</p>';
  }
  const warn = saveStatus.ok === false
    ? '<p class="warn">このブラウザでは途中保存が使えません（遊ぶことはできます）</p>' : '';
  $('#startScreen').innerHTML = `<div class="modal-box">
    <div class="logo">${gemShape('red')}${gemShape('blue')}${gemShape('green')}</div>
    <h1>ジェムラッシュ</h1>
    ${resume}
    <button class="level-btn" data-act="start" data-level="easy">${gemShape('green')}<span><b>かんたん</b><small>ほぼでたらめに動く。買えるカードはよく買う</small></span></button>
    <button class="level-btn" data-act="start" data-level="normal">${gemShape('blue')}<span><b>ふつう</b><small>目標のカードを決めて宝石を集める</small></span></button>
    <button class="level-btn" data-act="start" data-level="hard">${gemShape('red')}<span><b>つよい</b><small>数手先まで読み、邪魔もしてくる</small></span></button>
    <button class="level-btn" data-act="start" data-level="pvp">${gemShape('white')}<span><b>2人で対戦</b><small>CPUなし。同じ画面で交互に操作</small></span></button>
    <button class="btn big" data-act="rules" style="margin-top:8px">ルール説明</button>
    ${warn}
  </div>`;
}

// ---------- メニュー ----------
export function openMenu(): void {
  const el = $('#saveStatus');
  if (saveStatus.ok === true) el.textContent = '💾 1手ごとに自動保存しています';
  else if (saveStatus.ok === false) el.textContent = '⚠️ このブラウザでは保存できません（ゲームはそのまま遊べます）';
  else el.textContent = '';
  $('#menuScreen').hidden = false;
}

// ---------- ルール説明 ----------
export function openRules(): void {
  $('#rulesBody').innerHTML = buildRulesHTML();
  $('#menuScreen').hidden = true;
  $('#rulesScreen').hidden = false;
  $('#rulesScreen').scrollTop = 0;
}

function buildRulesHTML(): string {
  const t = (c: Parameters<typeof tokenHTML>[0]) => tokenHTML(c);
  // 説明用のカード（本物のカードデータとは別の例）
  const sample: Pick<Card, 'level' | 'color' | 'points' | 'cost'> = { level: 2, color: 'blue', points: 2, cost: { white: 0, blue: 0, green: 0, red: 3, black: 2 } };
  const cheap: Pick<Card, 'level' | 'color' | 'points' | 'cost'> = { level: 1, color: 'red', points: 0, cost: { white: 2, blue: 1, green: 0, red: 0, black: 0 } };
  const noble: Pick<Noble, 'points' | 'req'> = { points: 3, req: { white: 0, blue: 0, green: 4, red: 4, black: 0 } };
  const bonusRed = (n: number) => `<span class="bonus-card c-red">${gemShape('red')}${n}</span>`;
  const sampleCard = cardHTML(sample, { tag: 'div' });

  return `
  <div class="rules-head"><h2>ルール説明</h2><button class="btn" data-act="closeRules">閉じる ✕</button></div>

  <div class="rule-sec">
    <h3><span class="num">★</span>ゲームの目的</h3>
    <p>宝石を集めて<span class="hl">発展カード</span>を買い、<span class="hl">先に15点</span>を目指します。
    買ったカードは<span class="hl">ずっと使える割引</span>になるので、安いカードから育てていくのがコツです。</p>
  </div>

  <div class="rule-sec">
    <h3><span class="num">?</span>カードの見方</h3>
    <div class="anatomy">
      ${sampleCard}
      <ol>
        <li>左上の数字＝<span class="hl">得点</span>（0点のカードは空白）</li>
        <li>右上の宝石＝買うともらえる<span class="hl">ボーナスの色</span></li>
        <li>下の丸＝買うのに必要な<span class="hl">宝石（コスト）</span></li>
        <li>真ん中の鳥＝ボーナスの色とレベルで決まる<span class="hl">15種類の鳥</span>（同じ色は同じ色の鳥）</li>
      </ol>
    </div>
    <p>宝石は色ごとに形も違います：
      ${COLORS.map(c => `${gemShape(c)}${JP[c]}`).join('　')}　${gemShape('gold')}金（何色の代わりにもなる）</p>
  </div>

  <div class="rule-sec">
    <h3><span class="num">1</span>手番では、次の4つから1つだけ</h3>

    <div class="rule-box a1">
      <h4>① 違う色の宝石を3個とる</h4>
      <div class="figure">${t('white')}${t('blue')}${t('green')}<span class="tag-ok">OK</span></div>
      <p class="hint" style="text-align:left">場に残っている色が3色より少ないときだけ、その分少なくてもかまいません。</p>
    </div>

    <div class="rule-box a2">
      <h4>② 同じ色の宝石を2個とる</h4>
      <div class="figure">${t('red')}${t('red')}<span class="tag-ok">その色が4個残っていればOK</span></div>
      <p class="hint" style="text-align:left">残りが3個以下の色は、2個とりできません。</p>
    </div>

    <div class="rule-box a3">
      <h4>③ カードを1枚予約する（金がもらえる）</h4>
      <div class="figure">${cardHTML(cheap, { tag: 'div' })}<span class="arrow">→</span>手元にキープ　＋ ${t('gold')}</div>
      <ul>
        <li>場のカードでも、山札の一番上（伏せたまま）でもOK</li>
        <li>予約できるのは<span class="hl">3枚まで</span>。予約したカードは後で買えます</li>
        <li>金が残っていなければ、金はもらえません</li>
      </ul>
    </div>

    <div class="rule-box a4">
      <h4>④ カードを1枚買う</h4>
      <p style="text-align:left">場のカードか、自分が予約したカードを買えます。払った宝石は場に戻ります。</p>
    </div>
  </div>

  <div class="rule-sec">
    <h3><span class="num">2</span>ボーナス（割引）のしくみ</h3>
    <p>買ったカードは、その色のコストを<span class="hl">1つずつずっと割引</span>します。</p>
    <div class="rule-box">
      <div class="figure">${sampleCard}
        <div>コスト：${tokenHTML('red', 3, 'mini')} ${tokenHTML('black', 2, 'mini')}<br>
        赤のボーナス：${bonusRed(2)}<br>
        <span class="arrow">→</span> 払うのは ${tokenHTML('red', 1, 'mini')} ${tokenHTML('black', 2, 'mini')} だけ！</div>
      </div>
      <p class="hint" style="text-align:left">足りない分は ${tokenHTML('gold', '', 'mini')} 金で払えます（金1個＝好きな色1個）。</p>
    </div>
  </div>

  <div class="rule-sec">
    <h3><span class="num">3</span>トークンは10個まで</h3>
    <p>手番の終わりに、金も含めて<span class="hl">10個を超えていたら</span>、10個になるまで好きなトークンを返します。</p>
  </div>

  <div class="rule-sec">
    <h3><span class="num">4</span>貴族（3点）</h3>
    <div class="figure">${nobleHTML(noble)}
      <div>この貴族は<br><span class="hl">緑のボーナス4枚＋赤のボーナス4枚</span>で来てくれる</div>
    </div>
    <ul>
      <li>四角い数字は<span class="hl">買ったカードの枚数（ボーナス）</span>です。宝石トークンでは呼べません</li>
      <li>手番の終わりに条件を満たしていれば、<span class="hl">自動で</span>訪れて3点もらえます（行動は使いません）</li>
      <li>1回の手番で来る貴族は1枚だけ。2枚同時に満たしたら、どちらか1枚を選びます</li>
    </ul>
  </div>

  <div class="rule-sec">
    <h3><span class="num">5</span>勝ち負けの決まり方</h3>
    <ul>
      <li>どちらかが<span class="hl">15点以上</span>になったら、そのラウンドの最後まで続けます（先手と後手の手番数をそろえる）</li>
      <li>最後に<span class="hl">得点が高い方の勝ち</span></li>
      <li>同点なら、<span class="hl">買ったカードが少ない方の勝ち</span></li>
    </ul>
  </div>

  <div class="rule-sec">
    <h3><span class="num">✋</span>操作のしかた</h3>
    <ul>
      <li>宝石をタップして選び、「取る」。同じ色を2回タップすると2個取り</li>
      <li>カードや山札をタップすると「購入する」「予約する」が出ます</li>
      <li><span class="tag-ok">買える</span>マークが付いたカードは、今すぐ買えます</li>
      <li><span class="new-badge inline">NEW</span>は、あなたの前の手番のあとに新しく並んだカードです</li>
      <li>だれかが行動すると、画面の真ん中に<span class="hl">何をしたか</span>が大きく出て、取った宝石やカードがその人の席へ飛んでいきます</li>
      <li>相手が直前にしたことは、下の<span class="hl">「直前」</span>の欄と、宝石の<span class="hl">−1</span>・相手の手元の<span class="hl">+1</span>の印でもわかります</li>
      <li>これまでの全部の行動は、<span class="hl">☰ メニュー →「対戦ログを見る」</span>で見られます</li>
      <li>ゲームは1手ごとに自動で保存され、次に開いたとき「続きから」で再開できます</li>
    </ul>
  </div>

  <div class="rule-sec">
    <h3><span class="num">📱</span>スマホのホーム画面に追加</h3>
    <ul>
      <li><b>iPhone（Safari）</b>：共有ボタン →「ホーム画面に追加」</li>
      <li><b>Android（Chrome）</b>：右上の︙ →「ホーム画面に追加」または「アプリをインストール」</li>
      <li>追加すると、アプリのように全画面で開けて、電波がなくても遊べます</li>
    </ul>
  </div>
  <button class="btn primary big" data-act="closeRules">閉じる</button>`;
}
