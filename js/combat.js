// ===== combat.js: 전투 엔진 =====

// ===== 헬퍼 =====

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedPick(units) {
  const total = units.reduce((s, u) => s + u.getTargetWeight(), 0);
  let r = Math.random() * total;
  for (const u of units) {
    r -= u.getTargetWeight();
    if (r <= 0) return u;
  }
  return units[units.length - 1];
}

// 물리 데미지 (방어력 반영)
function physDmg(atk, def, mult, isCrit, critDmgPct) {
  let d = Math.max(1, atk * mult - def * 0.5);
  if (isCrit) d *= critDmgPct / 100;
  return Math.max(1, Math.floor(d * (0.9 + Math.random() * 0.2)));
}

// 마법 데미지 (방어력 무시)
function magicDmg(atk, mult, isCrit, critDmgPct) {
  let d = Math.max(1, atk * mult);
  if (isCrit) d *= critDmgPct / 100;
  return Math.max(1, Math.floor(d * (0.9 + Math.random() * 0.2)));
}

function rollCrit(unit) {
  if (unit.guaranteedCrit > 0) { unit.guaranteedCrit--; return true; }
  return Math.random() * 100 < unit.crit;
}

// ===== 스킬 정의 =====
const SKILLS = {

  /* ---------- 전사 계열 ---------- */
  warrior_smash: {
    name: '강타', type: 'cooldown', cooldown: 4,
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const crit = rollCrit(u);
      const d = physDmg(u.atk, t.def, 1.9, crit, u.critDmg);
      const r = t.takeDamage(d);
      log(`💥 [강타] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b>${crit ? ' 💥치명타' : ''}`);
    },
  },

  knight_provoke: {
    name: '도발 태세', type: 'battle_start',
    exec(u, al, en, log) {
      u.taunting = 4;
      log(`🛡️ [도발 태세] ${u.name}: 4턴간 도발!`);
    },
  },
  knight_shield_bash: {
    name: '방패 강타', type: 'cooldown', cooldown: 2,
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const crit = rollCrit(u);
      const d = physDmg(u.atk, t.def, 1.2, crit, u.critDmg);
      const r = t.takeDamage(d);
      if (!t.isBoss) { t.addStatus('stun', 1); log(`🛡️ [방패 강타] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b> + 기절 1턴!`); }
      else            { log(`🛡️ [방패 강타] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b> (보스 기절 면역)`); }
    },
  },

  guardian_fortress: {
    name: '성벽', type: 'battle_start',
    exec(u, al, en, log) {
      u.taunting = 6;
      al.filter(a => a !== u && a.isAlive()).forEach(a => { a.damageReduction = Math.min(0.5, (a.damageReduction || 0) + 0.2); });
      log(`🏯 [성벽] ${u.name}: 6턴 도발 + 아군 피해 경감 20%!`);
    },
  },
  guardian_judgment: {
    name: '심판의 일격', type: 'cooldown', cooldown: 2,
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const crit = rollCrit(u);
      const d = physDmg(u.atk, t.def, 1.7, crit, u.critDmg);
      const r = t.takeDamage(d);
      if (!t.isBoss) t.addStatus('stun', 2);
      log(`⚖️ [심판의 일격] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b>${!t.isBoss ? ' + 기절 2턴!' : ''}`);
    },
  },

  gladiator_counter: {
    name: '반격 태세', type: 'battle_start',
    exec(u, al, en, log) {
      u.counterStance = { turns: 5, reduction: 0.2 };
      u.damageReduction = Math.min(0.5, (u.damageReduction || 0) + 0.2);
      log(`⚔️ [반격 태세] ${u.name}: 5턴간 피해 경감 20% + 피격 시 반격!`);
    },
  },
  gladiator_whirlwind: {
    name: '회오리', type: 'cooldown', cooldown: 3,
    exec(u, al, en, log) {
      const alive = en.filter(e => e.isAlive());
      let total = 0;
      alive.forEach(t => { const d = physDmg(u.atk, t.def, 0.85, false, u.critDmg); const r = t.takeDamage(d); total += r.actual; });
      log(`🌀 [회오리] ${u.name}: 전체 적 ${alive.length}마리에게 총 <b class="log-damage">${total}</b>!`);
    },
  },

  champion_boiling: {
    name: '끓어오르는 피', type: 'battle_start',
    exec(u, al, en, log) {
      u.counterStance = { turns: 999, reduction: 0.2, teamCounter: true };
      u.damageReduction = Math.min(0.5, (u.damageReduction || 0) + 0.2);
      log(`🔥 [끓어오르는 피] ${u.name}: 아군 피격 시 반격 (전투 지속)!`);
    },
  },
  champion_storm: {
    name: '폭풍', type: 'cooldown', cooldown: 3,
    exec(u, al, en, log) {
      const alive = en.filter(e => e.isAlive());
      let total = 0;
      alive.forEach(t => { const crit = rollCrit(u); const d = physDmg(u.atk, t.def, 1.5, crit, u.critDmg); const r = t.takeDamage(d); total += r.actual; });
      log(`⛈️ [폭풍] ${u.name}: 전체 1.5배 피해 총 <b class="log-damage">${total}</b>!`);
    },
  },

  /* ---------- 도적 계열 ---------- */
  rogue_ambush: {
    name: '기습', type: 'cooldown', cooldown: 4,
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const d = physDmg(u.atk, t.def, 1.9, true, u.critDmg);
      const r = t.takeDamage(d);
      log(`🗡️ [기습] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b> 💥치명타!`);
    },
  },

  assassin_vital: {
    name: '급소 노리기', type: 'cooldown', cooldown: 3,
    exec(u, al, en, log) {
      u.guaranteedCrit = (u.guaranteedCrit || 0) + 1;
      log(`🎯 [급소 노리기] ${u.name}: 다음 공격 치명타 확정!`);
    },
  },
  assassin_poison: {
    name: '독침', type: 'cooldown', cooldown: 4,
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const tickDmg = Math.max(1, Math.floor(u.atk * 0.3));
      t.addStatus('poison', 3, tickDmg);
      log(`☠️ [독침] ${u.name}→${t.name}: 3턴 독 (턴당 ${tickDmg})!`);
    },
  },

  ninja_mass_assassinate: {
    name: '대규모 암살', type: 'cooldown', cooldown: 3,
    exec(u, al, en, log) {
      u.guaranteedCrit = (u.guaranteedCrit || 0) + 1;
      u.chainAssassinate = true;
      log(`🌑 [대규모 암살] ${u.name}: 치명타 확정 + 연쇄 암살 준비!`);
    },
  },
  ninja_poison_fog: {
    name: '독안개', type: 'cooldown', cooldown: 4,
    exec(u, al, en, log) {
      const alive = en.filter(e => e.isAlive());
      const tickDmg = Math.max(1, Math.floor(u.atk * 0.25));
      alive.forEach(t => { t.addStatus('poison', 3, tickDmg); t.addStatus('acc_down', 1, 0.4); });
      log(`🌫️ [독안개] ${u.name}: 적 전체 독 + 명중률 감소!`);
    },
  },

  hunter_mark: {
    name: '표식', type: 'battle_start',
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      u.markTarget = t;
      t.marked = true;
      log(`🏹 [표식] ${u.name}: ${t.name}에게 표식 부착!`);
    },
  },
  hunter_rapidfire: {
    name: '연사', type: 'cooldown', cooldown: 3,
    exec(u, al, en, log) {
      let t = (u.markTarget && u.markTarget.isAlive()) ? u.markTarget : pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const hits = 2 + (Math.random() < 0.5 ? 1 : 0);
      let total = 0;
      for (let i = 0; i < hits; i++) {
        if (!t.isAlive()) break;
        const d = physDmg(u.atk, t.def, 0.75, false, u.critDmg);
        total += t.takeDamage(d).actual;
      }
      log(`🏹 [연사] ${u.name}→${t.name}: ${hits}연타 총 <b class="log-damage">${total}</b>!`);
    },
  },

  bounty_obsession: {
    name: '집착', type: 'battle_start',
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      u.markTarget = t; u.markBonus = 0.3; t.marked = true;
      log(`👁️ [집착] ${u.name}: ${t.name}에게 집착 (피해 +30%)!`);
    },
  },
  bounty_finisher: {
    name: '확인 사살', type: 'cooldown', cooldown: 3,
    exec(u, al, en, log) {
      let t = (u.markTarget && u.markTarget.isAlive()) ? u.markTarget : pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const mult = 1.0 * (1 + (u.markBonus || 0));
      let total = 0;
      for (let i = 0; i < 3; i++) { if (!t.isAlive()) break; const d = physDmg(u.atk, t.def, mult, false, u.critDmg); total += t.takeDamage(d).actual; }
      log(`🎯 [확인 사살] ${u.name}→${t.name}: 3연타 총 <b class="log-damage">${total}</b>!`);
    },
  },

  /* ---------- 마법사 계열 ---------- */
  mage_barrage: {
    name: '마력 난사', type: 'cooldown', cooldown: 4,
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const crit = rollCrit(u);
      const d = magicDmg(u.atk, 1.9, crit, u.critDmg);
      const r = t.takeDamage(d);
      log(`✨ [마력 난사] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b>${crit ? ' 💥' : ''} (방어 무시)`);
    },
  },

  cathedral_shield: {
    name: '수호 술식', type: 'battle_start',
    exec(u, al, en, log) {
      const amt = Math.floor(u.atk * 2);
      al.filter(a => a.isAlive()).forEach(a => { a.shield = (a.shield || 0) + amt; a.shieldReflect = 0.5; });
      log(`✨ [수호 술식] ${u.name}: 아군 전체 보호막 ${amt} 부여!`);
    },
  },
  cathedral_heal: {
    name: '회복', type: 'cooldown', cooldown: 3,
    exec(u, al, en, log) {
      const alive = al.filter(a => a.isAlive());
      const t = alive.sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp))[0];
      if (!t) return;
      const h = t.heal(Math.floor(u.atk * 1.5));
      log(`💚 [회복] ${u.name}→${t.name}: <b class="log-heal">${h}</b> 회복!`);
    },
  },

  scholar_shield2: {
    name: '수호 술식 2.0', type: 'battle_start',
    exec(u, al, en, log) {
      const amt = Math.floor(u.atk * 3.5);
      al.filter(a => a.isAlive()).forEach(a => { a.shield = (a.shield || 0) + amt; a.shieldReflect = 0.5; });
      log(`✨✨ [수호 술식 2.0] ${u.name}: 아군 전체 보호막 ${amt} 부여!`);
    },
  },
  scholar_mass_heal: {
    name: '광역 회복', type: 'cooldown', cooldown: 3,
    exec(u, al, en, log) {
      const h = Math.floor(u.atk * 1.0);
      al.filter(a => a.isAlive()).forEach(a => a.heal(h));
      log(`💚💚 [광역 회복] ${u.name}: 아군 전체 <b class="log-heal">${h}</b> 회복!`);
    },
  },

  ivory_coordinate: {
    name: '좌표 타격', type: 'cooldown', cooldown: 3,
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const crit = rollCrit(u);
      const d = magicDmg(u.atk, 2.2, crit, u.critDmg);
      const r = t.takeDamage(d, { unavoidable: true });
      log(`⚡ [좌표 타격] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b> (방어+회피 무시)${crit ? ' 💥' : ''}`);
    },
  },
  ivory_lightning: {
    name: '연발 번개', type: 'cooldown', cooldown: 3,
    exec(u, al, en, log) {
      const alive = en.filter(e => e.isAlive());
      const hits = 3 + Math.floor(Math.random() * 2);
      let total = 0;
      for (let i = 0; i < hits; i++) {
        const t = pickRandom(alive.filter(e => e.isAlive()));
        if (!t) break;
        const d = magicDmg(u.atk, 0.7, false, u.critDmg);
        total += t.takeDamage(d).actual;
      }
      log(`⚡⚡ [연발 번개] ${u.name}: ${hits}회 연속 총 <b class="log-damage">${total}</b>!`);
    },
  },

  sage_collapse: {
    name: '좌표 붕괴', type: 'cooldown', cooldown: 3,
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const crit = rollCrit(u);
      const d = magicDmg(u.atk, 2.8, crit, u.critDmg);
      t.currentHp = Math.max(0, t.currentHp - d); // 회피 불가, shield 무시
      log(`💥 [좌표 붕괴] ${u.name}→${t.name}: <b class="log-damage">${d}</b> (모든 방어 무시)${crit ? ' 💥' : ''}`);
    },
  },
  sage_lightning_hell: {
    name: '번개 지옥', type: 'cooldown', cooldown: 3,
    exec(u, al, en, log) {
      const alive = en.filter(e => e.isAlive());
      const hits = 5 + Math.floor(Math.random() * 3);
      let total = 0;
      for (let i = 0; i < hits; i++) {
        const t = pickRandom(alive.filter(e => e.isAlive()));
        if (!t) break;
        const d = magicDmg(u.atk, 0.85, false, u.critDmg);
        total += t.takeDamage(d).actual;
      }
      log(`⚡💀 [번개 지옥] ${u.name}: ${hits}회 번개 총 <b class="log-damage">${total}</b>!`);
    },
  },
};

// 직업 → 스킬 매핑
const JOB_SKILLS = {
  warrior:            ['warrior_smash'],
  knight:             ['knight_provoke', 'knight_shield_bash'],
  guardian_knight:    ['guardian_fortress', 'guardian_judgment'],
  gladiator:          ['gladiator_counter', 'gladiator_whirlwind'],
  champion:           ['champion_boiling', 'champion_storm'],
  rogue:              ['rogue_ambush'],
  assassin:           ['assassin_vital', 'assassin_poison'],
  ninja:              ['ninja_mass_assassinate', 'ninja_poison_fog'],
  hunter:             ['hunter_mark', 'hunter_rapidfire'],
  bounty_hunter:      ['bounty_obsession', 'bounty_finisher'],
  mage:               ['mage_barrage'],
  cathedral_sorcerer: ['cathedral_shield', 'cathedral_heal'],
  cathedral_scholar:  ['scholar_shield2', 'scholar_mass_heal'],
  ivory_sorcerer:     ['ivory_coordinate', 'ivory_lightning'],
  ivory_sage:         ['sage_collapse', 'sage_lightning_hell'],
};

// ===== CombatUnit 클래스 =====
class CombatUnit {
  constructor(src, isAlly) {
    this.isAlly = isAlly;

    if (isAlly) {
      const stats = getEffectiveStats(src);
      this.id      = src.id;
      this.name    = src.name;
      this.job     = src.job;
      this.isBoss  = false;
      this.atk     = stats.atk;
      this.def     = stats.def;
      this.spd     = stats.spd;
      this.crit    = stats.crit;
      this.critDmg = stats.critDmg;
      this.maxHp   = stats.hp;
      this.currentHp = (src._dispatchHp !== undefined) ? src._dispatchHp : stats.hp;
    } else {
      this.id      = 'm_' + Math.random().toString(36).slice(2, 7);
      this.name    = src.name;
      this.job     = null;
      this.isBoss  = src.isBoss || false;
      this.sprite  = src.sprite;
      this.atk     = src.atk;
      this.def     = src.def;
      this.spd     = src.spd;
      this.crit    = src.crit ?? 8;
      this.critDmg = src.critDmg ?? 150;
      this.maxHp   = src.maxHp;
      this.currentHp = src.maxHp;
    }

    // 전투 상태
    this.shield        = 0;
    this.shieldReflect = 0;
    this.damageReduction = 0;
    this.statusEffects = [];   // [{type, duration, value}]
    this.skillCooldowns = {};  // {skillId: turns}

    // 스킬 플래그
    this.taunting        = 0;
    this.counterStance   = null;
    this.guaranteedCrit  = 0;
    this.chainAssassinate = false;
    this.markTarget      = null;
    this.markBonus       = 0;
    this.marked          = false;
    this._startSkillsDone = false;
  }

  isAlive() { return this.currentHp > 0; }

  takeDamage(raw, opts = {}) {
    let dmg = Math.max(1, Math.floor(raw));

    // 피해 경감
    if (!opts.ignoreReduction && this.damageReduction > 0) {
      dmg = Math.max(1, Math.floor(dmg * (1 - this.damageReduction)));
    }

    // 보호막
    let reflected = 0;
    if (!opts.ignoreShield && this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      reflected = Math.floor(absorbed * this.shieldReflect);
      this.shield -= absorbed;
      dmg -= absorbed;
    }

    dmg = Math.max(0, dmg);
    this.currentHp = Math.max(0, this.currentHp - dmg);
    return { actual: dmg, reflected };
  }

  heal(amount) {
    const h = Math.min(Math.floor(amount), this.maxHp - this.currentHp);
    this.currentHp += h;
    return h;
  }

  addStatus(type, duration, value = 0) {
    const ex = this.statusEffects.find(s => s.type === type);
    if (ex) { ex.duration = Math.max(ex.duration, duration); ex.value = Math.max(ex.value, value); }
    else     { this.statusEffects.push({ type, duration, value }); }
  }

  hasStatus(type) { return this.statusEffects.some(s => s.type === type && s.duration > 0); }

  getTargetWeight() { return this.taunting > 0 ? 8 : 1; }

  // 턴 시작: 상태이상 처리 및 쿨다운 감소
  tickStart(log) {
    // 독 피해
    for (const s of this.statusEffects) {
      if (s.type === 'poison' && s.duration > 0) {
        const dmg = Math.max(1, s.value);
        this.currentHp = Math.max(0, this.currentHp - dmg);
        log(`☠️ ${this.name}: 독으로 <b class="log-damage">${dmg}</b> 피해!`);
      }
      s.duration--;
    }
    this.statusEffects = this.statusEffects.filter(s => s.duration > 0);

    // 타운트 틱
    if (this.taunting > 0) this.taunting--;

    // 반격 태세 틱
    if (this.counterStance && this.counterStance.turns !== 999) {
      this.counterStance.turns--;
      if (this.counterStance.turns <= 0) {
        this.counterStance = null;
        this.damageReduction = Math.max(0, this.damageReduction - 0.2);
      }
    }

    // 스킬 쿨다운 감소
    for (const k of Object.keys(this.skillCooldowns)) {
      if (this.skillCooldowns[k] > 0) this.skillCooldowns[k]--;
    }
  }

  // 일반 공격
  normalAttack(enemies, allies, log) {
    if (this.hasStatus('stun')) {
      log(`😵 ${this.name}: 기절로 행동 불가!`);
      return;
    }

    // 사냥꾼 계열: 표식 대상 우선
    let target;
    if (this.markTarget && this.markTarget.isAlive()) {
      target = this.markTarget;
    } else {
      const alive = enemies.filter(e => e.isAlive());
      if (alive.length === 0) return;
      target = weightedPick(alive);
      // 표식 대상이 죽으면 다음 표식
      if (this.markTarget && !this.markTarget.isAlive() && (JOB_SKILLS[this.job] || []).some(s => s.includes('mark') || s.includes('obsession'))) {
        this.markTarget = pickRandom(alive);
        if (this.markTarget) { this.markTarget.marked = true; target = this.markTarget; }
      }
    }

    if (!target || !target.isAlive()) return;

    // 명중률 하락 처리
    if (target.hasStatus('acc_down') && Math.random() < 0.35) {
      log(`🌫️ ${this.name}→${target.name}: 빗나감!`);
      return;
    }

    const crit = rollCrit(this);
    let dmg;
    if (!this.job) {
      // 몬스터: 물리
      dmg = physDmg(this.atk, target.def, 1.0, crit, this.critDmg);
    } else {
      dmg = physDmg(this.atk, target.def, 1.0, crit, this.critDmg);
      // 표식 보너스
      if (this.markBonus && target === this.markTarget) dmg = Math.floor(dmg * (1 + this.markBonus));
    }

    const r = target.takeDamage(dmg);
    log(`${this.isAlly ? '⚔️' : '🐾'} ${this.name}→${target.name}: <b class="log-damage">${r.actual}</b>${crit ? ' 💥' : ''}${r.reflected > 0 ? ` <span class="log-skill">[보호막 반사 ${r.reflected}]</span>` : ''}`);

    // 보호막 반사 처리
    if (r.reflected > 0 && this.isAlive()) {
      this.currentHp = Math.max(0, this.currentHp - r.reflected);
    }

    // 연쇄 암살
    if (this.chainAssassinate && !target.isAlive()) {
      this.chainAssassinate = false;
      const next = pickRandom(enemies.filter(e => e.isAlive()));
      if (next) {
        const cd = physDmg(this.atk, next.def, 1.2, true, this.critDmg);
        const cr = next.takeDamage(cd);
        log(`🌑 [연쇄 암살] ${this.name}→${next.name}: <b class="log-damage">${cr.actual}</b> 💥`);
      }
    }

    // 반격 태세 처리 (피격 시)
    if (r.actual > 0 && target.counterStance && target.counterStance.turns > 0 && target.isAlive()) {
      const cd = physDmg(target.atk, this.def, 0.6, false, target.critDmg);
      const cr = this.takeDamage(cd);
      log(`⚔️ [반격] ${target.name}→${this.name}: <b class="log-damage">${cr.actual}</b>`);
    }

    // 챔피언: 팀 반격
    if (r.actual > 0 && !this.isAlly) {
      const champion = allies.find(a => a.isAlive() && a.counterStance?.teamCounter && a !== target);
      if (champion) {
        const cd = physDmg(champion.atk, this.def, 0.6, false, champion.critDmg);
        const cr = this.takeDamage(cd);
        log(`🔥 [끓어오르는 피 반격] ${champion.name}→${this.name}: <b class="log-damage">${cr.actual}</b>`);
      }
    }

    if (!target.isAlive()) log(`<span class="log-system">💀 ${target.name} 쓰러짐!</span>`);
    if (!this.isAlive()) log(`<span class="log-system">💀 ${this.name} 쓰러짐!</span>`);
  }

  // 스킬 사용 시도
  trySkill(allies, enemies, log) {
    if (this.hasStatus('stun')) return false;
    const skillIds = JOB_SKILLS[this.job] || [];

    // battle_start 스킬 (최초 1회)
    if (!this._startSkillsDone) {
      this._startSkillsDone = true;
      for (const sid of skillIds) {
        const sk = SKILLS[sid];
        if (sk && sk.type === 'battle_start') {
          sk.exec(this, allies, enemies, log);
        }
      }
    }

    // cooldown 스킬
    for (const sid of skillIds) {
      const sk = SKILLS[sid];
      if (!sk || sk.type !== 'cooldown') continue;
      if ((this.skillCooldowns[sid] || 0) > 0) continue;
      sk.exec(this, allies, enemies, log);
      this.skillCooldowns[sid] = sk.cooldown;
      return true; // 스킬 1개만 사용
    }
    return false;
  }
}

// ===== 몬스터 그룹 생성 =====
function generateEnemyGroup(area, progress) {
  const isBoss  = Math.random() < 0.08;
  const stageMult = [1, 1.8, 3.0, 3.2, 5.5, 9.0, 15.0][area.stage - 1];
  const progMult  = 1 + (progress / area.maxProgress) * 1.5;
  const bossMult  = isBoss ? 4.5 : 1;

  const makeMonster = (m, isBoss) => {
    const hp  = Math.floor(80  * stageMult * progMult * bossMult);
    const atk = Math.floor(15  * stageMult * progMult * bossMult * 0.8);
    const def = Math.floor(5   * stageMult * progMult);
    const spd = Math.floor(8   * stageMult * 0.6 + 4);
    return new CombatUnit({
      name: m.name, sprite: m.sprite,
      isBoss, maxHp: hp, atk, def, spd, crit: isBoss ? 15 : 8, critDmg: isBoss ? 180 : 150,
    }, false);
  };

  if (isBoss) {
    const bossPool = area.monsters.filter(m => m.boss);
    const pick = pickRandom(bossPool) || area.monsters[0];
    return [makeMonster(pick, true)];
  }

  const normalPool = area.monsters.filter(m => !m.boss);
  const count = 1 + Math.floor(Math.random() * 3);
  return Array.from({ length: Math.min(count, normalPool.length || 1) }, () =>
    makeMonster(pickRandom(normalPool), false)
  );
}

// ===== BattleEngine: 백그라운드 즉시 시뮬레이션 =====
class BattleEngine {
  constructor(allyUnits, enemyUnits) {
    this.allies  = allyUnits;
    this.enemies = enemyUnits;
    this.log     = [];
    this.turn    = 0;
  }

  addLog(html) { this.log.push(html); }

  run() {
    const MAX_TURNS = 80;

    // battle_start 스킬 발동
    [...this.allies, ...this.enemies].forEach(u => u.trySkill(
      u.isAlly ? this.allies : this.enemies,
      u.isAlly ? this.enemies : this.allies,
      (t) => this.addLog(t)
    ));

    while (this.turn < MAX_TURNS) {
      this.turn++;
      const all = [...this.allies, ...this.enemies].filter(u => u.isAlive());
      all.sort((a, b) => b.spd - a.spd);

      for (const unit of all) {
        if (!unit.isAlive()) continue;
        const myTeam  = unit.isAlly ? this.allies : this.enemies;
        const oppTeam = unit.isAlly ? this.enemies : this.allies;

        if (!myTeam.some(u => u.isAlive()) || !oppTeam.some(u => u.isAlive())) break;

        // 턴 시작: 상태이상 + 쿨다운
        unit.tickStart((t) => this.addLog(t));
        if (!unit.isAlive()) continue;

        // 스킬 우선, 없으면 일반 공격
        const usedSkill = unit.isAlly ? unit.trySkill(this.allies, this.enemies, (t) => this.addLog(t)) : false;
        if (!usedSkill) {
          unit.normalAttack(oppTeam, myTeam, (t) => this.addLog(t));
        }
      }

      const aliveAllies  = this.allies.filter(u => u.isAlive()).length;
      const aliveEnemies = this.enemies.filter(u => u.isAlive()).length;

      if (aliveEnemies === 0) {
        this.addLog('<span class="log-system">🏆 전투 승리!</span>');
        return { win: true, allyHpMap: this._allyHpMap(), log: this.log };
      }
      if (aliveAllies === 0) {
        this.addLog('<span class="log-system">💀 전멸...</span>');
        return { win: false, allyHpMap: {}, log: this.log };
      }
    }

    // 턴 초과: 아군 HP 합계로 판정
    const allySum  = this.allies.reduce((s, u) => s + u.currentHp, 0);
    const enemySum = this.enemies.reduce((s, u) => s + u.currentHp, 0);
    const win = allySum >= enemySum;
    this.addLog(`<span class="log-system">${win ? '🏆 시간 초과 — 아군 승리!' : '💀 시간 초과 — 패배...'}</span>`);
    return { win, allyHpMap: win ? this._allyHpMap() : {}, log: this.log };
  }

  _allyHpMap() {
    const m = {};
    this.allies.forEach(u => { m[u.id] = u.currentHp; });
    return m;
  }
}

// ===== 파견 전투 통합 =====

const COMBAT_INTERVAL = 6; // 6초마다 전투 1회

function initDispatchCombat(dispatch) {
  if (!dispatch.partyHp)       dispatch.partyHp = {};
  if (!dispatch.combatCooldown) dispatch.combatCooldown = 2; // 파견 직후 2초 후 첫 전투
  if (!dispatch.lastBattleLog)  dispatch.lastBattleLog = [];
  if (!dispatch.isBossEncounter) dispatch.isBossEncounter = false;
}

function tickDispatchCombat(dispatch, delta) {
  dispatch.combatCooldown -= delta;
  if (dispatch.combatCooldown > 0) return;
  dispatch.combatCooldown = COMBAT_INTERVAL;

  const area = AREAS.find(a => a.id === dispatch.areaId);
  if (!area) return;

  // 아군 유닛 생성 (HP 복원)
  const advList = dispatch.team
    .map(id => State.adventurers.find(a => a.id === id))
    .filter(Boolean);
  if (advList.length === 0) return;

  const allies = advList.map(adv => {
    const clone = { ...adv, _dispatchHp: dispatch.partyHp[adv.id] };
    return new CombatUnit(clone, true);
  });

  // 적 생성
  const enemies = generateEnemyGroup(area, Math.floor(dispatch.progress));

  // 전투 실행
  const engine = new BattleEngine(allies, enemies);
  const result = engine.run();

  dispatch.lastBattleLog = result.log.slice(-40);
  dispatch.isBossEncounter = enemies.some(e => e.isBoss);

  if (result.win) {
    // 아군 HP 저장
    for (const u of allies) {
      dispatch.partyHp[u.id] = result.allyHpMap[u.id] ?? 0;
    }
    // 진행도 +1
    dispatch.progress = Math.min(dispatch.progress + 1, area.maxProgress);

    // 최대 진행도 도달 시 재시작
    if (dispatch.progress >= area.maxProgress) {
      dispatch.progress = 1;
      // 최대 도달 기록
      State.areaProgress[area.id] = area.maxProgress;
      checkAreaUnlocks();
      showToast(`${area.name} 최대 진행도 달성! 처음부터 재시작`, 'success');
    }
  } else {
    // 전멸: 전원 HP 회복, 진행도 1 리셋
    dispatch.partyHp = {};
    dispatch.progress = 1;
  }
}

// ===== LiveBattle: 팝업 실시간 관람 =====
class LiveBattle {
  constructor(allies, enemies, onUpdate, onEnd) {
    this.allies  = allies;
    this.enemies = enemies;
    this.turn    = 0;
    this.log     = [];
    this.onUpdate = onUpdate;
    this.onEnd    = onEnd;
    this.timer    = null;
    this._startDone = false;
  }

  addLog(html) {
    this.log.push(html);
    if (this.log.length > 120) this.log.shift();
  }

  start() {
    // battle_start 스킬 발동
    if (!this._startDone) {
      this._startDone = true;
      [...this.allies, ...this.enemies].forEach(u => u.trySkill(
        u.isAlly ? this.allies : this.enemies,
        u.isAlly ? this.enemies : this.allies,
        (t) => this.addLog(t)
      ));
    }
    this.onUpdate(this);
    this.timer = setInterval(() => this.tick(), 2000);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  tick() {
    this.turn++;
    const all = [...this.allies, ...this.enemies].filter(u => u.isAlive());
    all.sort((a, b) => b.spd - a.spd);

    for (const unit of all) {
      if (!unit.isAlive()) continue;
      const myTeam  = unit.isAlly ? this.allies : this.enemies;
      const oppTeam = unit.isAlly ? this.enemies : this.allies;
      if (!oppTeam.some(u => u.isAlive())) break;

      unit.tickStart((t) => this.addLog(t));
      if (!unit.isAlive()) continue;

      const usedSkill = unit.isAlly
        ? unit.trySkill(this.allies, this.enemies, (t) => this.addLog(t))
        : false;
      if (!usedSkill) {
        unit.normalAttack(oppTeam, myTeam, (t) => this.addLog(t));
      }
    }

    this.onUpdate(this);

    const aliveA = this.allies.filter(u => u.isAlive()).length;
    const aliveE = this.enemies.filter(u => u.isAlive()).length;

    if (aliveE === 0) {
      this.addLog('<span class="log-system">🏆 승리! 다음 전투 대기 중...</span>');
      this.onUpdate(this);
      this.stop();
      this.onEnd(true);
    } else if (aliveA === 0) {
      this.addLog('<span class="log-system">💀 전멸... 체력 회복 후 재도전</span>');
      this.onUpdate(this);
      this.stop();
      this.onEnd(false);
    }
  }
}
