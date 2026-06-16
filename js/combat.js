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
  let d = Math.max(1, atk * mult * (100 / (100 + def)));
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
    name: '강타', type: 'cooldown', cooldown: 4, desc: '적 1명에게 물리 피해 (ATK×1.9). 50% 확률로 치명타 확정.',
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
    name: '도발 태세', type: 'cooldown', cooldown: 3, durationBonus: 4,
    desc: '4턴간 공격받을 확률 대폭 상승. (지속 4턴 + 쿨타임 3턴)',
    exec(u, al, en, log) {
      u.taunting = 4;
      log(`🛡️ [도발 태세] ${u.name}: 4턴간 피격 확률 대폭 상승!`);
    },
  },
  knight_shield_bash: {
    name: '방패 강타', type: 'cooldown', cooldown: 2, desc: '적 1명에게 물리 피해 (ATK×1.2) + 기절 1턴. (보스 기절 면역)',
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
    name: '성벽', type: 'cooldown', cooldown: 3, durationBonus: 6,
    desc: '6턴간 공격받을 확률 대폭 상승 + 아군 전체 피해 경감 20%. (지속 6턴 + 쿨타임 3턴)',
    exec(u, al, en, log) {
      u.taunting = 6;
      al.filter(a => a !== u && a.isAlive()).forEach(a => { a.damageReduction = Math.min(0.5, (a.damageReduction || 0) + 0.2); });
      log(`🏯 [성벽] ${u.name}: 6턴 피격 확률 대폭 상승 + 아군 피해 경감 20%!`);
    },
  },
  guardian_judgment: {
    name: '심판의 일격', type: 'cooldown', cooldown: 2, desc: '적 1명에게 물리 피해 (ATK×1.7) + 기절 2턴. (보스 기절 면역)',
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
    name: '반격 태세', type: 'cooldown', cooldown: 3, durationBonus: 5, desc: '5턴간 피해 경감 20% + 피격 시 반격. (지속 5턴 + 쿨타임 3턴)',
    exec(u, al, en, log) {
      u.counterStance = { turns: 5, reduction: 0.2 };
      u.damageReduction = Math.min(0.5, (u.damageReduction || 0) + 0.2);
      log(`⚔️ [반격 태세] ${u.name}: 5턴간 피해 경감 20% + 피격 시 반격!`);
    },
  },
  gladiator_whirlwind: {
    name: '회오리', type: 'cooldown', cooldown: 3, desc: '적 전체에게 물리 피해 (ATK×0.85).',
    exec(u, al, en, log) {
      const alive = en.filter(e => e.isAlive());
      let total = 0;
      alive.forEach(t => { const d = physDmg(u.atk, t.def, 0.85, false, u.critDmg); const r = t.takeDamage(d); total += r.actual; });
      log(`🌀 [회오리] ${u.name}: 전체 적 ${alive.length}마리에게 총 <b class="log-damage">${total}</b>!`);
    },
  },

  champion_boiling: {
    name: '끓어오르는 피', type: 'cooldown', cooldown: 3,
    desc: '4턴간 피해 경감 20% + 아군 피격 시마다 반격. (지속 4턴 + 쿨타임 3턴)',
    exec(u, al, en, log) {
      const dur = 4;
      u._pendingDurationBonus = dur;
      u.counterStance = { turns: dur, reduction: 0.2, teamCounter: true };
      u.damageReduction = Math.min(0.5, (u.damageReduction || 0) + 0.2);
      log(`🔥 [끓어오르는 피] ${u.name}: ${dur}턴간 피해 경감 + 아군 피격 시 반격!`);
    },
  },
  champion_storm: {
    name: '폭풍', type: 'cooldown', cooldown: 3, desc: '적 전체에게 물리 피해 (ATK×1.5).',
    exec(u, al, en, log) {
      const alive = en.filter(e => e.isAlive());
      let total = 0;
      alive.forEach(t => { const crit = rollCrit(u); const d = physDmg(u.atk, t.def, 1.5, crit, u.critDmg); const r = t.takeDamage(d); total += r.actual; });
      log(`⛈️ [폭풍] ${u.name}: 전체 1.5배 피해 총 <b class="log-damage">${total}</b>!`);
    },
  },

  /* ---------- 도적 계열 ---------- */
  rogue_ambush: {
    name: '기습', type: 'cooldown', cooldown: 4, desc: '적 1명에게 물리 피해 (ATK×1.9). 치명타 확정.',
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const d = physDmg(u.atk, t.def, 1.9, true, u.critDmg);
      const r = t.takeDamage(d);
      log(`🗡️ [기습] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b> 💥치명타!`);
    },
  },

  assassin_vital: {
    name: '급소 노리기', type: 'cooldown', cooldown: 3, desc: '다음 공격이 치명타 확정.',
    exec(u, al, en, log) {
      u.guaranteedCrit = (u.guaranteedCrit || 0) + 1;
      log(`🎯 [급소 노리기] ${u.name}: 다음 공격 치명타 확정!`);
    },
  },
  assassin_poison: {
    name: '독침', type: 'cooldown', cooldown: 4, desc: '적 1명에게 3턴간 독 (ATK×0.3/턴).',
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const tickDmg = Math.max(1, Math.floor(u.atk * 0.3));
      t.addStatus('poison', 3, tickDmg);
      log(`☠️ [독침] ${u.name}→${t.name}: 3턴 독 (턴당 ${tickDmg})!`);
    },
  },

  ninja_mass_assassinate: {
    name: '대규모 암살', type: 'cooldown', cooldown: 3, desc: '치명타 확정 단일 공격. 대상 사망 시 무작위 적에게 연쇄 시전.',
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const d = physDmg(u.atk, t.def, 1.9, true, u.critDmg);
      const r = t.takeDamage(d);
      log(`🌑 [대규모 암살] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b> 💥치명타!`);
      let last = t, lastR = r;
      while (!last.isAlive()) {
        log(`💀 ${last.name} 쓰러짐!`);
        const next = pickRandom(en.filter(e => e.isAlive()));
        if (!next) break;
        const d2 = physDmg(u.atk, next.def, 1.9, true, u.critDmg);
        const r2 = next.takeDamage(d2);
        log(`🌑 [연쇄 암살] ${u.name}→${next.name}: <b class="log-damage">${r2.actual}</b> 💥`);
        last = next;
        lastR = r2;
      }
    },
  },
  ninja_poison_fog: {
    name: '독안개', type: 'cooldown', cooldown: 4, desc: '적 전체에게 3턴 독 (ATK×0.25/턴) + 명중률 감소 1턴.',
    exec(u, al, en, log) {
      const alive = en.filter(e => e.isAlive());
      const tickDmg = Math.max(1, Math.floor(u.atk * 0.25));
      alive.forEach(t => { t.addStatus('poison', 3, tickDmg); t.addStatus('acc_down', 1, 0.4); });
      log(`🌫️ [독안개] ${u.name}: 적 전체 독 + 명중률 감소!`);
    },
  },

  hunter_mark: {
    name: '표식', type: 'cooldown', cooldown: 3, desc: '적 1명에게 표식 부착. 표식 대상에게 연사 피해 집중.',
    exec(u, al, en, log) {
      if (u.markTarget && u.markTarget.isAlive()) return; // 기존 표식 유효 → 재적용 안 함
      if (u.markTarget) u.markTarget.marked = false;
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      u.markTarget = t;
      t.marked = true;
      log(`🏹 [표식] ${u.name}: ${t.name}에게 표식 부착!`);
    },
  },
  hunter_rapidfire: {
    name: '연사', type: 'cooldown', cooldown: 3, desc: '표식 대상(없으면 랜덤)에게 2~3회 물리 공격 (ATK×0.75/회).',
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
    name: '집착', type: 'cooldown', cooldown: 4, desc: '적 1명을 집착 표적으로 지정. 해당 대상에게 피해 +30%.',
    exec(u, al, en, log) {
      if (u.markTarget && u.markTarget.isAlive()) return; // 기존 집착 표적 유효 → 재적용 안 함
      if (u.markTarget) { u.markTarget.marked = false; }
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      u.markTarget = t; u.markBonus = 0.3; t.marked = true;
      log(`👁️ [집착] ${u.name}: ${t.name}에게 집착 (피해 +30%)!`);
    },
  },
  bounty_finisher: {
    name: '확인 사살', type: 'cooldown', cooldown: 3, desc: '집착 표적(없으면 랜덤)에게 3연타 물리 공격 (ATK×1.0/회, 집착 보너스 포함).',
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
    name: '마력 난사', type: 'cooldown', cooldown: 4, desc: '적 1명에게 마법 피해 (ATK×1.9). 방어 무시.',
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
    name: '수호 술식', type: 'cooldown', cooldown: 4, desc: '아군 전체에게 보호막 부여 (ATK×2). 보호막 파괴 시 공격자에게 50% 피해 반사.',
    exec(u, al, en, log) {
      const amt = Math.floor(u.atk * 2);
      al.filter(a => a.isAlive()).forEach(a => { a.shield = (a.shield || 0) + amt; a.shieldReflect = 0.5; });
      log(`✨ [수호 술식] ${u.name}: 아군 전체 보호막 ${amt} 부여!`);
    },
  },
  cathedral_deny: {
    name: '접근 거부', type: 'cooldown', cooldown: 3, desc: '적 전체에게 마법 피해 (ATK×0.4) + 2턴간 공격력 25% 하락.',
    exec(u, al, en, log) {
      const alive = en.filter(e => e.isAlive());
      if (alive.length === 0) return;
      alive.forEach(t => {
        const d = magicDmg(u.atk, 0.4, false, u.critDmg);
        t.takeDamage(d);
        t.addStatus('atk_down', 2, 0.25);
      });
      log(`🚫 [접근 거부] ${u.name}: 적 전체 소량 피해 + 2턴간 공격력 25% 하락!`);
    },
  },

  scholar_shield2: {
    name: '수호 술식 2.0', type: 'cooldown', cooldown: 4, desc: '아군 전체에게 강화 보호막 부여 (ATK×3.5). 보호막 파괴 시 50% 피해 반사.',
    exec(u, al, en, log) {
      const amt = Math.floor(u.atk * 3.5);
      al.filter(a => a.isAlive()).forEach(a => { a.shield = (a.shield || 0) + amt; a.shieldReflect = 0.5; });
      log(`✨✨ [수호 술식 2.0] ${u.name}: 아군 전체 보호막 ${amt} 부여!`);
    },
  },
  scholar_isolate: {
    name: '시스템 격리', type: 'cooldown', cooldown: 3, desc: '적 전체에게 마법 피해 (ATK×0.4) + 3턴간 공격력 35% 하락.',
    exec(u, al, en, log) {
      const alive = en.filter(e => e.isAlive());
      if (alive.length === 0) return;
      alive.forEach(t => {
        const d = magicDmg(u.atk, 0.4, false, u.critDmg);
        t.takeDamage(d);
        t.addStatus('atk_down', 3, 0.35);
      });
      log(`🔒 [시스템 격리] ${u.name}: 적 전체 소량 피해 + 3턴간 공격력 35% 하락!`);
    },
  },

  ivory_coordinate: {
    name: '좌표 타격', type: 'cooldown', cooldown: 3, desc: '적 1명에게 마법 피해 (ATK×2.2). 방어력·회피 완전 무시.',
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
    name: '연발 번개', type: 'cooldown', cooldown: 3, desc: '적 전체 랜덤 대상에게 3~4회 마법 공격 (ATK×0.7/회).',
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
    name: '좌표 붕괴', type: 'cooldown', cooldown: 3, desc: '적 1명에게 마법 피해 (ATK×2.8). 보호막·방어·회피 모두 무시.',
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const crit = rollCrit(u);
      const d = magicDmg(u.atk, 2.8, crit, u.critDmg);
      t.currentHp = Math.max(0, t.currentHp - d); // 회피 불가, shield 무시
      log(`💥 [좌표 붕괴] ${u.name}→${t.name}: <b class="log-damage">${d}</b> (모든 방어 무시)${crit ? ' 💥' : ''}`);
      if (!t.isAlive()) log(`💀 ${t.name} 쓰러짐!`);
    },
  },
  sage_lightning_hell: {
    name: '번개 지옥', type: 'cooldown', cooldown: 3, desc: '적 전체 랜덤 대상에게 5~7회 마법 공격 (ATK×0.85/회).',
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


  /* ---------- 치유사 계열 ---------- */
  healer_first_aid: {
    name: '응급 처치', type: 'cooldown', cooldown: 4, desc: 'HP 비율이 가장 낮은 아군을 대량 회복 (ATK×3.0).',
    exec(u, al, en, log) {
      const alive = al.filter(a => a.isAlive());
      const t = alive.sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp))[0];
      if (!t) return;
      const h = t.heal(Math.floor(u.atk * 3.0));
      log(`🚑 [응급 처치] ${u.name}→${t.name}: <b class="log-heal">${h}</b> 대량 회복!`);
    },
  },

  cleric_light_veil: {
    name: '빛의 장막', type: 'passive', desc: '전투 내내 피격 가중치 50%로 감소 (적이 덜 노림).',
    exec(u) { u.lightVeil = 1; },
  },
  cleric_warm_light: {
    name: '따스한 빛', type: 'cooldown', cooldown: 3, desc: '아군 전체를 소량 회복 (ATK×0.8).',
    exec(u, al, en, log) {
      const h = Math.floor(u.atk * 0.8);
      al.filter(a => a.isAlive()).forEach(a => a.heal(h));
      log(`☀️ [따스한 빛] ${u.name}: 아군 전체 <b class="log-heal">${h}</b> 회복!`);
    },
  },

  priest_blessing: {
    name: '빛의 축복', type: 'passive', desc: '전투 내내 피격 가중치 25%로 대폭 감소 (적이 거의 안 노림).',
    exec(u) { u.lightVeil = 2; },
  },
  priest_embrace: {
    name: '포옹하는 빛', type: 'cooldown', cooldown: 5, delayedCooldown: true,
    desc: '3턴간 기본 공격이 아군 전체 회복 (ATK×0.6)으로 전환. 3턴 소모 후 쿨타임 시작.',
    exec(u, al, en, log) {
      u.embraceAoe = 3;
      log(`💖 [포옹하는 빛] ${u.name}: 3턴의 기본 공격이 전체 회복으로 변경!`);
    },
  },

  dragon_priest_punish: {
    name: '처벌', type: 'cooldown', cooldown: 3, desc: '적 1명에게 마법 피해 (ATK×1.8).',
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const crit = rollCrit(u);
      const d = magicDmg(u.atk, 1.8, crit, u.critDmg);
      const r = t.takeDamage(d);
      log(`⚡ [처벌] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b>${crit ? ' 💥' : ''}`);
    },
  },
  dragon_priest_sermon: {
    name: '설교', type: 'cooldown', cooldown: 3, desc: '적 전체에게 마법 피해 (ATK×0.6).',
    exec(u, al, en, log) {
      const alive = en.filter(e => e.isAlive());
      let total = 0;
      alive.forEach(t => { total += t.takeDamage(magicDmg(u.atk, 0.6, false, u.critDmg)).actual; });
      log(`📢 [설교] ${u.name}: 적 전체 총 <b class="log-damage">${total}</b> 피해!`);
    },
  },

  inquisitor_conviction: {
    name: '단죄', type: 'cooldown', cooldown: 3, desc: '적 1명에게 마법 피해 (ATK×2.2) + 피해량의 40%를 가장 HP 낮은 아군 회복.',
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const crit = rollCrit(u);
      const d = magicDmg(u.atk, 2.2, crit, u.critDmg);
      const r = t.takeDamage(d);
      const healAmt = Math.floor(r.actual * 0.4);
      const lowestHp = al.filter(a => a.isAlive()).sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp))[0];
      if (lowestHp) lowestHp.heal(healAmt);
      log(`⚖️ [단죄] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b>${crit ? ' 💥' : ''}${lowestHp ? ` + ${lowestHp.name} <b class="log-heal">${healAmt}</b> 회복` : ''}`);
    },
  },
  inquisitor_oration: {
    name: '웅변', type: 'cooldown', cooldown: 3, desc: '적 전체에게 마법 피해 (ATK×0.6) + 1턴간 명중률 감소.',
    exec(u, al, en, log) {
      const alive = en.filter(e => e.isAlive());
      let total = 0;
      alive.forEach(t => {
        total += t.takeDamage(magicDmg(u.atk, 0.6, false, u.critDmg)).actual;
        t.addStatus('acc_down', 1, 0.35);
      });
      log(`📣 [웅변] ${u.name}: 적 전체 총 <b class="log-damage">${total}</b> 피해 + 1턴 명중률 하락!`);
    },
  },

  /* ---------- 몬스터 전용 (쿨다운 5턴 고정) ---------- */

  // 짐승류: 야수의 일격 — 강한 단일 물리 피해
  monster_beast_strike: {
    name: '야수의 일격', type: 'cooldown', cooldown: 5,
    exec(u, al, en, log) {
      const t = weightedPick(en.filter(e => e.isAlive()));
      if (!t) return;
      const d = physDmg(u.atk, t.def, 1.8, false, u.critDmg);
      const r = t.takeDamage(d);
      log(`🐾 [야수의 일격] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b>`);
    },
  },

  // 충류: 독침 — 독 상태이상 부여
  monster_insect_poison: {
    name: '독침', type: 'cooldown', cooldown: 5,
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const tickDmg = Math.max(1, Math.floor(u.atk * 0.35));
      t.addStatus('poison', 3, tickDmg);
      log(`🕷️ [독침] ${u.name}→${t.name}: 3턴 독 (턴당 <b class="log-damage">${tickDmg}</b>)!`);
    },
  },

  // 인간형: 연속 공격 — 2연타
  monster_humanoid_combo: {
    name: '연속 공격', type: 'cooldown', cooldown: 5,
    exec(u, al, en, log) {
      let total = 0;
      for (let i = 0; i < 2; i++) {
        const t = weightedPick(en.filter(e => e.isAlive()));
        if (!t) break;
        const d = physDmg(u.atk, t.def, 0.9, false, u.critDmg);
        total += t.takeDamage(d).actual;
      }
      log(`⚔️ [연속 공격] ${u.name}: 2연타 총 <b class="log-damage">${total}</b>!`);
    },
  },

  // 마물: 마력 폭발 — 마법 피해 (방어 무시)
  monster_magical_blast: {
    name: '마력 폭발', type: 'cooldown', cooldown: 5,
    exec(u, al, en, log) {
      const t = pickRandom(en.filter(e => e.isAlive()));
      if (!t) return;
      const d = magicDmg(u.atk, 1.5, false, u.critDmg);
      const r = t.takeDamage(d);
      log(`✨ [마력 폭발] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b> 마법 피해!`);
    },
  },

  // 보스 전용
  boss_heavy: {
    name: '보스 강타', type: 'cooldown', cooldown: 5,
    exec(u, al, en, log) {
      const t = weightedPick(en.filter(e => e.isAlive()));
      if (!t) return;
      const crit = rollCrit(u);
      const d = physDmg(u.atk, t.def, 2.2, crit, u.critDmg);
      const r = t.takeDamage(d);
      log(`💢 [보스 강타] ${u.name}→${t.name}: <b class="log-damage">${r.actual}</b>${crit ? ' 💥치명타' : ''}`);
    },
  },
  boss_sweep: {
    name: '휩쓸기', type: 'cooldown', cooldown: 5,
    exec(u, al, en, log) {
      const alive = en.filter(e => e.isAlive());
      let total = 0;
      alive.forEach(t => { total += t.takeDamage(physDmg(u.atk, t.def, 0.9, false, u.critDmg)).actual; });
      log(`🌊 [휩쓸기] ${u.name}: 전체에게 총 <b class="log-damage">${total}</b> 피해!`);
    },
  },
};

// 치유사 계열 직업 집합
const HEALER_JOBS = new Set(['healer', 'cleric', 'priest', 'dragon_priest', 'inquisitor']);

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
  cathedral_sorcerer: ['cathedral_shield', 'cathedral_deny'],
  cathedral_scholar:  ['scholar_shield2', 'scholar_isolate'],
  ivory_sorcerer:     ['ivory_coordinate', 'ivory_lightning'],
  ivory_sage:         ['sage_collapse', 'sage_lightning_hell'],
  healer:             ['healer_first_aid'],
  cleric:             ['cleric_light_veil', 'cleric_warm_light'],
  priest:             ['priest_blessing', 'priest_embrace'],
  dragon_priest:      ['dragon_priest_punish', 'dragon_priest_sermon'],
  inquisitor:         ['inquisitor_conviction', 'inquisitor_oration'],
  monster_beast:      ['monster_beast_strike'],
  monster_insect:     ['monster_insect_poison'],
  monster_humanoid:   ['monster_humanoid_combo'],
  monster_magical:    ['monster_magical_blast'],
  monster_boss:       ['boss_heavy', 'boss_sweep'],
};

// 몬스터 이름/스프라이트 경로로 분류 결정
function classifyMonster(name, sprite) {
  // 충류: 이름 기반 (공통적으로 bugs/vermin에 해당하는 한국어 키워드)
  const insectKeys = ['딱정벌레', '지네', '지렁이', '두꺼비', '전갈', '거미', '거머리', '크라켄'];
  if (insectKeys.some(k => name.includes(k))) return 'monster_insect';

  // 짐승류: /animals/ 경로 (충류 제외 나머지 동물)
  if (sprite && sprite.includes('/animals/')) return 'monster_beast';

  // 인간형: 사람/지성체 계열 스프라이트
  const humanoidSprites = ['human', 'goblin', 'hobgoblin', 'orc', 'kobold',
    'merfolk', 'mermaid', 'centaur', 'troll', 'hell_knight',
    'vault_guard', 'wizard', 'siren', 'deep_troll'];
  if (humanoidSprites.some(k => sprite && sprite.includes(k))) return 'monster_humanoid';

  // 나머지: 마물 (드래곤, 악마, 정령, 환수 등)
  return 'monster_magical';
}

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
      this.job     = src.isBoss ? 'monster_boss' : classifyMonster(src.name, src.sprite);
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
    this.shield          = 0;
    this.shieldReflect   = 0;
    this.damageReduction = 0;
    this.statusEffects   = [];
    this.skillCooldowns  = {};

    // 스킬 플래그
    this.taunting         = 0;
    this.counterStance    = null;
    this.guaranteedCrit   = 0;
    this.markTarget       = null;
    this.markBonus        = 0;
    this.marked           = false;
    this._startSkillsDone = false;

    // 장비 옵션 배틀 효과
    this.armorPierce        = 0;
    this.bleedChance        = 0;
    this.doubleAttackChance = 0;
    this.hpScaleDmg         = 0;
    this.defBreakChance     = 0;
    this.evasion            = 0;
    this.critResist         = 0;
    this.lowHpDmgReduce     = 0;
    this.healAfterBattle    = 0;

    if (isAlly && src.equipment) {
      for (const slot of ['weapon', 'armor', 'accessory']) {
        const eq = src.equipment[slot];
        if (!eq || !eq.options) continue;
        for (const opt of eq.options) {
          if (opt.type !== 'battle') continue;
          switch (opt.effect) {
            case 'damageReduction':  this.damageReduction  = Math.min(0.75, this.damageReduction + opt.value / 100); break;
            case 'startShield':      this.shield           += opt.value; break;
            case 'firstStrikeCrit':  this.guaranteedCrit   += 1;         break;
            case 'evasion':          this.evasion          += opt.value; break;
            case 'armorPierce':      this.armorPierce      += opt.value; break;
            case 'bleed':            this.bleedChance      += opt.value; break;
            case 'doubleAttack':     this.doubleAttackChance += opt.value; break;
            case 'healAfterBattle':  this.healAfterBattle  += opt.value; break;
            case 'critResist':       this.critResist       += opt.value; break;
            case 'hpScaleDmg':       this.hpScaleDmg       += opt.value; break;
            case 'defBreak':         this.defBreakChance   += opt.value; break;
            case 'lowHpDmgReduce':   this.lowHpDmgReduce   += opt.value; break;
          }
        }
      }
    }
  }

  isAlive() { return this.currentHp > 0; }

  takeDamage(raw, opts = {}) {
    let dmg = Math.max(1, Math.floor(raw));

    // 치명타 저항 (장비 옵션)
    if (opts.isCrit && this.critResist > 0) {
      dmg = Math.max(1, Math.floor(dmg * (1 - this.critResist / 100)));
    }

    // 피해 경감
    if (!opts.ignoreReduction && this.damageReduction > 0) {
      dmg = Math.max(1, Math.floor(dmg * (1 - this.damageReduction)));
    }

    // 위기 방어 (장비 옵션 — HP 40% 이하 시 추가 경감)
    if (this.lowHpDmgReduce > 0 && this.currentHp < this.maxHp * 0.4) {
      dmg = Math.max(1, Math.floor(dmg * (1 - this.lowHpDmgReduce / 100)));
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

  getTargetWeight() {
    if (this.taunting > 0) return 8;
    if (this.lightVeil === 2) return 0.25; // 빛의 축복
    if (this.lightVeil === 1) return 0.5;  // 빛의 장막
    return 1;
  }

  // 턴 시작: 상태이상 처리 및 쿨다운 감소
  tickStart(log) {
    // 상태이상 피해 (독 / 출혈)
    for (const s of this.statusEffects) {
      if ((s.type === 'poison' || s.type === 'bleed') && s.duration > 0) {
        const dmg = Math.max(1, s.value);
        this.currentHp = Math.max(0, this.currentHp - dmg);
        const icon = s.type === 'bleed' ? '🩸' : '☠️';
        const label = s.type === 'bleed' ? '출혈' : '독';
        log(`${icon} ${this.name}: ${label}로 <b class="log-damage">${dmg}</b> 피해!`);
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

    // 치유사 계열: 기본 공격 대신 아군 회복
    if (HEALER_JOBS.has(this.job)) {
      const alive = allies.filter(a => a.isAlive());
      if (this.embraceAoe > 0) {
        const h = Math.floor(this.atk * 0.6);
        alive.forEach(a => a.heal(h));
        this.embraceAoe--;
        if (this.embraceAoe === 0) {
          this.skillCooldowns['priest_embrace'] = SKILLS['priest_embrace'].cooldown;
        }
        log(`💖 ${this.name}: 아군 전체 <b class="log-heal">${h}</b> 회복! (포옹하는 빛 남은 횟수: ${this.embraceAoe})`);
      } else {
        const t = alive.sort((a, b) => (a.currentHp / a.maxHp) - (b.currentHp / b.maxHp))[0];
        if (t) {
          const h = t.heal(Math.floor(this.atk * 1.0));
          log(`💚 ${this.name}→${t.name}: <b class="log-heal">${h}</b> 회복!`);
        }
      }
      return;
    }

    // 사냥꾼: 표식 대상만 공격. 표식 없거나 대상 사망 시 이번 턴에 새 표식 부여 후 공격 안 함
    const isHunterJob = this.job === 'hunter' || this.job === 'bounty_hunter';
    if (isHunterJob) {
      if (!this.markTarget || !this.markTarget.isAlive()) {
        if (this.markTarget) { this.markTarget.marked = false; }
        const alive = enemies.filter(e => e.isAlive());
        if (alive.length === 0) return;
        const newT = pickRandom(alive);
        this.markTarget = newT;
        newT.marked = true;
        const icon = this.job === 'bounty_hunter' ? '👁️' : '🏹';
        log(`${icon} ${this.name}: ${newT.name}에게 표식 부착!`);
        return; // 표식 부여 턴은 공격 없음
      }
    }

    let target;
    if (isHunterJob) {
      target = this.markTarget; // 표식 대상만 공격
    } else {
      const alive = enemies.filter(e => e.isAlive());
      if (alive.length === 0) return;
      target = weightedPick(alive);
    }

    if (!target || !target.isAlive()) return;

    // 명중률 하락 처리
    if (target.hasStatus('acc_down') && Math.random() < 0.35) {
      log(`🌫️ ${this.name}→${target.name}: 빗나감!`);
      return;
    }

    // 회피 (장비 옵션)
    if (target.evasion > 0 && Math.random() * 100 < target.evasion) {
      log(`💨 ${target.name}: 회피!`);
      return;
    }

    const crit = rollCrit(this);

    // 공격력 하락 상태이상 처리
    let effectiveAtk = this.atk;
    if (this.hasStatus('atk_down')) {
      const s = this.statusEffects.find(e => e.type === 'atk_down');
      if (s) effectiveAtk = Math.floor(effectiveAtk * (1 - s.value));
    }

    // 방어력 계산 (방어 무시 / 방어 감소 상태)
    let effectiveDef = target.def;
    if (target.hasStatus('def_break')) effectiveDef = Math.floor(effectiveDef * 0.6);
    if (this.armorPierce > 0 && Math.random() * 100 < this.armorPierce) effectiveDef = 0;

    let dmg;
    if (!this.job) {
      dmg = physDmg(effectiveAtk, effectiveDef, 1.0, crit, this.critDmg);
    } else {
      dmg = physDmg(effectiveAtk, effectiveDef, 1.0, crit, this.critDmg);
      if (this.markBonus && target === this.markTarget) dmg = Math.floor(dmg * (1 + this.markBonus));
    }

    // HP 비례 추가 피해 (장비 옵션)
    if (this.hpScaleDmg > 0) dmg += Math.floor(this.currentHp * this.hpScaleDmg / 100);

    const r = target.takeDamage(dmg, { isCrit: crit });
    log(`${this.isAlly ? '⚔️' : '🐾'} ${this.name}→${target.name}: <b class="log-damage">${r.actual}</b>${crit ? ' 💥' : ''}${r.reflected > 0 ? ` <span class="log-skill">[보호막 반사 ${r.reflected}]</span>` : ''}`);

    // 보호막 반사 처리
    if (r.reflected > 0 && this.isAlive()) {
      this.currentHp = Math.max(0, this.currentHp - r.reflected);
    }

    // 명중 후 추가 효과 (장비 옵션)
    if (r.actual > 0 && target.isAlive()) {
      // 출혈
      if (this.bleedChance > 0 && Math.random() * 100 < this.bleedChance) {
        const bleedDmg = Math.max(1, Math.floor(this.atk * 0.2));
        target.addStatus('bleed', 2, bleedDmg);
        log(`🩸 ${target.name}: 출혈!`);
      }
      // 방어 감소
      if (this.defBreakChance > 0 && Math.random() * 100 < this.defBreakChance) {
        target.addStatus('def_break', 2, 0);
        log(`💢 ${target.name}: 방어력 감소!`);
      }
      // 연속 공격
      if (this.doubleAttackChance > 0 && Math.random() * 100 < this.doubleAttackChance) {
        const d2 = physDmg(this.atk, target.def, 0.7, false, this.critDmg);
        const r2 = target.takeDamage(d2);
        log(`⚡ [연속 공격] ${this.name}→${target.name}: <b class="log-damage">${r2.actual}</b>`);
        if (!target.isAlive()) log(`<span class="log-system">💀 ${target.name} 쓰러짐!</span>`);
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

  // 스킬 사용 시도 — 쿨다운이 0인 첫 번째 cooldown 스킬 발동
  trySkill(allies, enemies, log) {
    if (this.hasStatus('stun')) return false;
    const skillIds = JOB_SKILLS[this.job] || [];

    for (const sid of skillIds) {
      const sk = SKILLS[sid];
      if (!sk || sk.type !== 'cooldown') continue;
      if ((this.skillCooldowns[sid] || 0) > 0) continue;
      sk.exec(this, allies, enemies, log);
      if (!sk.delayedCooldown) {
        // durationBonus: exec에서 _pendingDurationBonus를 설정한 경우 쿨다운에 합산
        const extra = this._pendingDurationBonus != null ? this._pendingDurationBonus : (sk.durationBonus || 0);
        delete this._pendingDurationBonus;
        this.skillCooldowns[sid] = sk.cooldown + extra;
      }
      return true;
    }
    return false;
  }
}

// ===== 몬스터 그룹 생성 =====
// 난이도 구조: 단계 기반 멱함수 스케일링 (diff 지수폭증 제거)
// HP  = 80 × s^1.15 × progMult × hpMult   (1단계 HP≈80, 40단계≈6300)
// ATK = 8  × s^0.65 × progMult × atkMult  (1단계 ATK≈8, 40단계≈66)
// DEF = 2  × s^0.8  × progMult            (1단계 DEF≈2, 40단계≈35)
// 보스: HP ×3.0 / ATK ×1.5 (더 단단하지만 공격력은 소폭 증가)
// 최대 진행도 도달 처리 — 세 곳(탐색/전투/팝업 관람)에서 공용
function handleProgressMax(dispatch, area) {
  if (dispatch.progress < area.maxProgress) return false;
  dispatch.progress = 1;
  State.areaProgress[area.id] = area.maxProgress;
  checkAreaUnlocks();
  showToast(`${area.name} 최대 진행도 달성! 처음부터 재시작`, 'success');
  return true;
}

function generateEnemyGroup(area, progress) {
  // 진행도 비율에 따라 보스 등장 확률 점진 증가: 2%(시작) → 15%(최대)
  const progressRatio = Math.min(1, progress / area.maxProgress);
  const isBoss   = Math.random() < (0.02 + progressRatio * 0.13);
  const s        = area.stage;
  const progMult = 1 + (progress / area.maxProgress) * 0.5;
  const hpMult   = isBoss ? 3.0 : 1;
  const atkMult  = isBoss ? 1.5 : 1;

  const makeMonster = (m, isBoss) => {
    const hp  = Math.floor(80  * Math.pow(s, 1.15) * progMult * hpMult);
    const atk = Math.floor(8   * Math.pow(s, 0.65) * progMult * atkMult);
    const def = Math.floor(2   * Math.pow(s, 0.8)  * progMult);
    const spd = Math.floor(5   * Math.pow(s, 0.3)  + 6);
    return new CombatUnit({
      name: m.name, sprite: m.sprite,
      isBoss, maxHp: hp, atk, def, spd, crit: isBoss ? 18 : 8, critDmg: isBoss ? 190 : 150,
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

    // 전투 시작: 패시브 즉시 적용, 쿨다운 스킬은 최대값으로 초기화 (즉발 방지)
    [...this.allies, ...this.enemies].forEach(u => {
      u.skillCooldowns = {};
      (JOB_SKILLS[u.job] || []).forEach(sid => {
        const sk = SKILLS[sid];
        if (!sk) return;
        if (sk.type === 'passive') { sk.exec(u); }
        else if (sk.cooldown > 0) { u.skillCooldowns[sid] = sk.cooldown; }
      });
    });

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
        const usedSkill = unit.trySkill(this.allies, this.enemies, (t) => this.addLog(t));
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

// 단계별 장비 등급 풀 (온라인/오프라인 공용)
const EQUIP_GRADE_POOLS = [
  ['일반','일반','일반','마법'],   // stage 1-2
  ['일반','일반','마법','마법'],   // stage 3-4
  ['일반','마법','마법','희귀'],   // stage 5-6
  ['마법','마법','희귀','희귀'],   // stage 7-8
  ['마법','희귀','희귀','영웅'],   // stage 9-12
  ['희귀','희귀','영웅','영웅'],   // stage 13-16
  ['희귀','영웅','영웅','전설'],   // stage 17-20
  ['영웅','영웅','전설','전설'],   // stage 21-25
  ['영웅','전설','전설','신화'],   // stage 26-30
  ['전설','전설','신화','신화'],   // stage 31-35
  ['전설','신화','신화','신화'],   // stage 36-40
];
function getEquipGradePoolIdx(stage) {
  return stage <= 2 ? 0 : stage <= 4 ? 1 : stage <= 6 ? 2
    : stage <= 8 ? 3 : stage <= 12 ? 4 : stage <= 16 ? 5
    : stage <= 20 ? 6 : stage <= 25 ? 7 : stage <= 30 ? 8
    : stage <= 35 ? 9 : 10;
}
const EQUIP_DROP_CHANCE      = 0.01; // 일반 전투 드롭률
const EQUIP_BOSS_DROP_CHANCE = 0.05; // 보스 전투 드롭률
const EQUIP_SLOTS = ['weapon', 'armor', 'accessory'];
const EQUIP_SELL_GOLD = { '일반': 50, '마법': 100, '희귀': 200, '영웅': 500, '전설': 1000, '신화': 2000 };

function initDispatchCombat(dispatch) {
  if (!dispatch.partyHp)       dispatch.partyHp = {};
  if (!dispatch.combatCooldown) dispatch.combatCooldown = 2; // 파견 직후 2초 후 첫 전투
  if (!dispatch.lastBattleLog)  dispatch.lastBattleLog = [];
  if (!dispatch.isBossEncounter) dispatch.isBossEncounter = false;
}

function tickDispatchCombat(dispatch, delta) {
  if (dispatch.viewerActive) return; // 관람 팝업이 열려있으면 백그라운드 전투 스킵
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

  // 30% 확률: 탐색 이벤트 (전투 없이 진행도 +1 + HP 회복)
  if (Math.random() < 0.30) {
    const healRatio = 0.12;
    for (const adv of advList) {
      const maxHp = getEffectiveStats(adv).hp;
      const curHp = dispatch.partyHp[adv.id] ?? maxHp;
      dispatch.partyHp[adv.id] = Math.min(maxHp, Math.floor(curHp + maxHp * healRatio));
    }
    dispatch.progress = Math.min(dispatch.progress + 1, area.maxProgress);
    dispatch.lastBattleLog = ['<span class="log-system">🌿 탐색: 이번 구역은 조용했다. 파티 HP +12% 회복</span>'];
    dispatch.isBossEncounter = false;

    handleProgressMax(dispatch, area);
    return;
  }

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
    // 아군 HP 저장 (healAfterBattle 옵션 적용)
    for (const u of allies) {
      let hp = result.allyHpMap[u.id] ?? 0;
      if (u.healAfterBattle > 0 && hp > 0) {
        hp = Math.min(u.maxHp, hp + Math.floor(u.maxHp * u.healAfterBattle / 100));
      }
      dispatch.partyHp[u.id] = hp;
    }
    // 진행도 +1 (+ 프레스티지 모험 가지 보너스)
    const isBossFight = enemies.some(e => e.isBoss);
    let progGain = 1 + getPrestigeBonusTotal('bonusProgress');
    if (isBossFight) progGain += getPrestigeBonusTotal('bossProgress');
    dispatch.progress = Math.min(dispatch.progress + progGain, area.maxProgress);

    // 몬스터 처치 즉시 골드 보너스 (#9)
    const killGold = Math.floor(enemies.length * area.stage * 1.5 * (isBossFight ? 2 : 1));
    const killMat  = isBossFight ? area.stage * 0.2 : area.stage * 0.04;
    dispatch.accumulated.gold     += killGold;
    dispatch.accumulated.material += killMat;

    // 장비 드롭
    const dropChance = isBossFight ? EQUIP_BOSS_DROP_CHANCE : EQUIP_DROP_CHANCE;
    if (Math.random() < dropChance) {
      const slot  = EQUIP_SLOTS[Math.floor(Math.random() * EQUIP_SLOTS.length)];
      const pool  = EQUIP_GRADE_POOLS[getEquipGradePoolIdx(area.stage)];
      const grade = pool[Math.floor(Math.random() * pool.length)];
      const eq    = generateEquipment(slot, grade);
      if (State.inventory.length < getInventoryCapacity()) {
        State.inventory.push(eq);
        showToast(`⚔️ 장비 획득: ${eq.name} (${eq.grade}급)`, 'success');
      } else {
        const sellGold = EQUIP_SELL_GOLD[grade] || 50;
        addGold(sellGold);
        showToast(`📦 창고 가득! ${eq.name} 자동 판매 (+${sellGold.toLocaleString()}G)`, 'info');
      }
    }

    // 파견 EXP: 전투 승리 시 모험가에게 소량 경험치
    const battleExp = Math.floor((area.stage * 2 + 3) * (isBossFight ? 3 : 1));
    for (const adv of advList) {
      giveExp(adv.id, battleExp);
    }

    // 최대 진행도 도달 시 재시작
    handleProgressMax(dispatch, area);
  } else {
    // 전멸: 전원 HP 회복
    dispatch.partyHp = {};
    // 기본: 진행도 50% 보존 / 사투의 경험 노드: +25% 추가 보존 (항상 유리)
    const wipeRetainBonus = getPrestigeBonusTotal('wipeRetain');
    const retainRate = 0.5 + wipeRetainBonus / 100;
    dispatch.progress = Math.max(1, Math.floor(dispatch.progress * retainRate));
  }
}

// ===== LiveBattle: 팝업 실시간 관람 =====
class LiveBattle {
  constructor(allies, enemies, onUpdate, onEnd) {
    this.allies  = allies;
    this.enemies = enemies;
    this.round   = 0;
    this.log     = [];
    this.onUpdate = onUpdate;
    this.onEnd    = onEnd;
    this.timer    = null;
    this._startDone  = false;
    this._actionQueue = []; // 속도 순 행동 큐 (1틱 = 1명 행동)
  }

  addLog(html) {
    this.log.push(html);
    if (this.log.length > 120) this.log.shift();
  }

  start() {
    // 전투 시작: 패시브 즉시 적용, 쿨다운 스킬은 최대값으로 초기화 (즉발 방지)
    if (!this._startDone) {
      this._startDone = true;
      [...this.allies, ...this.enemies].forEach(u => {
        u.skillCooldowns = {};
        (JOB_SKILLS[u.job] || []).forEach(sid => {
          const sk = SKILLS[sid];
          if (!sk) return;
          if (sk.type === 'passive') { sk.exec(u); }
          else if (sk.cooldown > 0) { u.skillCooldowns[sid] = sk.cooldown; }
        });
      });
    }
    this.onUpdate(this);
    this.timer = setInterval(() => this.tick(), 1500);
  }

  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  // 매 1.5초마다 호출 — 유닛 1명만 행동
  tick() {
    // 큐가 비면 새 라운드: 생존 유닛을 속도 내림차순으로 정렬해 채움
    if (this._actionQueue.length === 0) {
      const alive = [...this.allies, ...this.enemies].filter(u => u.isAlive());
      if (alive.length === 0) return;
      this.round++;
      this._actionQueue = alive.sort((a, b) => b.spd - a.spd);
      this.addLog(`<span class="log-system">── ${this.round}라운드 ──</span>`);
    }

    // 다음 행동 유닛 꺼내기
    const unit = this._actionQueue.shift();
    if (!unit || !unit.isAlive()) {
      // 이미 죽은 유닛은 건너뛰고 끝 판정만
      this._checkEnd();
      return;
    }

    const myTeam  = unit.isAlly ? this.allies : this.enemies;
    const oppTeam = unit.isAlly ? this.enemies : this.allies;

    if (!oppTeam.some(u => u.isAlive())) {
      this._checkEnd();
      return;
    }

    // 턴 시작 처리 (상태이상 틱, 쿨다운 감소)
    unit.tickStart((t) => this.addLog(t));
    if (!unit.isAlive()) {
      this.onUpdate(this);
      this._checkEnd();
      return;
    }

    // 스킬 우선, 없으면 일반 공격
    const usedSkill = unit.trySkill(this.allies, this.enemies, (t) => this.addLog(t));
    if (!usedSkill) {
      unit.normalAttack(oppTeam, myTeam, (t) => this.addLog(t));
    }

    this.onUpdate(this);
    this._checkEnd();
  }

  _checkEnd() {
    const aliveA = this.allies.filter(u => u.isAlive()).length;
    const aliveE = this.enemies.filter(u => u.isAlive()).length;

    if (aliveE === 0) {
      this.addLog('<span class="log-system">🏆 승리! 2초 후 다음 전투...</span>');
      this.onUpdate(this);
      this.stop();
      this.onEnd(true);
    } else if (aliveA === 0) {
      this.addLog('<span class="log-system">💀 전멸... 2초 후 재도전</span>');
      this.onUpdate(this);
      this.stop();
      this.onEnd(false);
    }
  }
}
