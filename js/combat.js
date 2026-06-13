// ===== combat.js: 전투 시뮬레이션 =====

// 몬스터 스탯 생성 (진행도와 단계 기반)
function generateMonsterStats(area, progress, isBoss) {
  const stageMultiplier = [1, 1.8, 3.0, 3.2, 5.5, 9.0, 15.0][area.stage - 1];
  const progressMult = 1 + (progress / area.maxProgress) * 1.5;
  const bossMult = isBoss ? 4 : 1;

  return {
    name: '?',
    hp:      Math.floor(80  * stageMultiplier * progressMult * bossMult),
    maxHp:   Math.floor(80  * stageMultiplier * progressMult * bossMult),
    atk:     Math.floor(15  * stageMultiplier * progressMult * bossMult * 0.8),
    def:     Math.floor(5   * stageMultiplier * progressMult),
    spd:     Math.floor(8   * stageMultiplier * 0.6 + 4),
    crit:    isBoss ? 15 : 8,
    critDmg: isBoss ? 180 : 150,
    isMonster: true,
    isBoss,
  };
}

// 단일 전투 시뮬레이션 (결과만 반환)
function simulateBattle(allies, monsters) {
  // 깊은 복사
  const allyUnits = allies.map(a => ({
    ...a,
    stats: getEffectiveStats(a),
    currentHp: getEffectiveStats(a).hp,
    maxHp: getEffectiveStats(a).hp,
    isAlly: true,
    skillCooldown: {},
    statusEffects: [],
  }));

  const enemyUnits = monsters.map(m => ({
    ...m,
    currentHp: m.hp,
    maxHp: m.hp,
    isAlly: false,
    skillCooldown: {},
    statusEffects: [],
  }));

  const log = [];
  let turn = 0;
  const MAX_TURNS = 100;

  while (turn < MAX_TURNS) {
    turn++;
    // 속도 순 정렬
    const all = [...allyUnits, ...enemyUnits].filter(u => u.currentHp > 0);
    all.sort((a, b) => {
      const aSpd = a.isAlly ? a.stats.spd : a.spd;
      const bSpd = b.isAlly ? b.stats.spd : b.spd;
      return bSpd - aSpd;
    });

    for (const unit of all) {
      if (unit.currentHp <= 0) continue;
      const allies_alive  = allyUnits.filter(u => u.currentHp > 0);
      const enemies_alive = enemyUnits.filter(u => u.currentHp > 0);
      if (allies_alive.length === 0 || enemies_alive.length === 0) break;

      if (unit.isAlly) {
        // 아군 공격
        const target = enemies_alive[Math.floor(Math.random() * enemies_alive.length)];
        const result = calcDamage(unit.stats, target);
        target.currentHp = Math.max(0, target.currentHp - result.dmg);
        log.push({ type: result.crit ? 'crit' : 'damage', text: `${unit.name}→${target.name}: ${result.dmg}${result.crit ? '(치명타!)' : ''}` });
        if (target.currentHp <= 0) log.push({ type: 'system', text: `${target.name} 쓰러짐` });
      } else {
        // 적 공격
        const target = allies_alive[Math.floor(Math.random() * allies_alive.length)];
        const result = calcDamageMonster(unit, target.stats);
        target.currentHp = Math.max(0, target.currentHp - result.dmg);
        log.push({ type: 'damage', text: `${unit.name}→${target.name}: ${result.dmg}` });
        if (target.currentHp <= 0) log.push({ type: 'system', text: `${target.name} 쓰러짐` });
      }
    }

    const allyAlive  = allyUnits.filter(u => u.currentHp > 0).length;
    const enemyAlive = enemyUnits.filter(u => u.currentHp > 0).length;

    if (enemyAlive === 0) return { win: true, log, turnsUsed: turn, remainingHp: allyUnits.map(u => u.currentHp) };
    if (allyAlive  === 0) return { win: false, log, turnsUsed: turn, remainingHp: [] };
  }

  // 턴 초과 시 체력 비교
  const allyHpSum   = allyUnits.reduce((s, u) => s + Math.max(0, u.currentHp), 0);
  const enemyHpSum  = enemyUnits.reduce((s, u) => s + Math.max(0, u.currentHp), 0);
  return {
    win: allyHpSum >= enemyHpSum,
    log,
    turnsUsed: turn,
    remainingHp: allyUnits.map(u => u.currentHp),
  };
}

function calcDamage(atkStats, defUnit) {
  const isCrit = Math.random() * 100 < atkStats.crit;
  let dmg = Math.max(1, atkStats.atk - defUnit.def);
  if (isCrit) dmg = Math.floor(dmg * (atkStats.critDmg / 100));
  dmg = Math.max(1, Math.floor(dmg * (0.85 + Math.random() * 0.3)));
  return { dmg, crit: isCrit };
}

function calcDamageMonster(monster, defStats) {
  const isCrit = Math.random() * 100 < monster.crit;
  let dmg = Math.max(1, monster.atk - defStats.def);
  if (isCrit) dmg = Math.floor(dmg * (monster.critDmg / 100));
  dmg = Math.max(1, Math.floor(dmg * (0.85 + Math.random() * 0.3)));
  return { dmg, crit: isCrit };
}

// 파견 중 전투 관람용 전투 상태
class LiveBattle {
  constructor(allies, monsters, onUpdate, onEnd) {
    this.allies  = allies.map(a => ({
      ...a, stats: getEffectiveStats(a),
      currentHp: getEffectiveStats(a).hp, maxHp: getEffectiveStats(a).hp, isAlly: true,
    }));
    this.enemies = monsters.map(m => ({
      ...m, currentHp: m.hp, maxHp: m.hp, isAlly: false,
    }));
    this.turn = 0;
    this.log  = [];
    this.onUpdate = onUpdate;
    this.onEnd    = onEnd;
    this.timer    = null;
  }

  start() {
    this.timer = setInterval(() => this.tick(), 2000);
    this.onUpdate(this);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  tick() {
    this.turn++;
    const all = [...this.allies, ...this.enemies].filter(u => u.currentHp > 0);
    all.sort((a, b) => {
      const aSpd = a.isAlly ? a.stats.spd : a.spd;
      const bSpd = b.isAlly ? b.stats.spd : b.spd;
      return bSpd - aSpd;
    });

    for (const unit of all) {
      if (unit.currentHp <= 0) continue;
      const allyAlive  = this.allies.filter(u => u.currentHp > 0);
      const enemyAlive = this.enemies.filter(u => u.currentHp > 0);
      if (allyAlive.length === 0 || enemyAlive.length === 0) break;

      if (unit.isAlly) {
        const target = enemyAlive[Math.floor(Math.random() * enemyAlive.length)];
        const r = calcDamage(unit.stats, target);
        target.currentHp = Math.max(0, target.currentHp - r.dmg);
        this.addLog(`⚔️ ${unit.name} → ${target.name}: <span class="log-damage">${r.dmg}${r.crit ? ' 💥' : ''}</span>`);
      } else {
        const target = allyAlive[Math.floor(Math.random() * allyAlive.length)];
        const r = calcDamageMonster(unit, target.stats);
        target.currentHp = Math.max(0, target.currentHp - r.dmg);
        this.addLog(`🐾 ${unit.name} → ${target.name}: <span class="log-damage">${r.dmg}</span>`);
      }
    }

    const allyAlive  = this.allies.filter(u => u.currentHp > 0).length;
    const enemyAlive = this.enemies.filter(u => u.currentHp > 0).length;

    this.onUpdate(this);

    if (enemyAlive === 0) { this.addLog('<span class="log-system">— 승리! 다음 전투 준비 중 —</span>'); this.stop(); this.onEnd(true); }
    else if (allyAlive === 0) { this.addLog('<span class="log-system">— 전멸... 체력 회복 후 재시작 —</span>'); this.stop(); this.onEnd(false); }
  }

  addLog(html) {
    this.log.push(html);
    if (this.log.length > 100) this.log.shift();
  }
}
