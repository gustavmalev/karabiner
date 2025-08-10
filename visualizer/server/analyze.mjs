function isFallbackManipulator(manip) {
  try {
    const fromKey = manip?.from?.key_code;
    const to = manip?.to?.[0];
    const mods = to?.modifiers || [];
    return (
      to?.key_code === fromKey &&
      Array.isArray(mods) &&
      ['left_shift', 'left_command', 'left_control', 'left_option'].every(m => mods.includes(m))
    );
  } catch {
    return false;
  }
}

function analyze(json) {
  const rules = json?.profiles?.[0]?.complex_modifications?.rules || [];

  const baseCustom = {}; // key -> { description, detail }
  const baseFallback = new Set();
  const sublayerKeys = new Set();
  const layers = {}; // key -> { title, commands: [{ key, description, detail }] }

  for (const rule of rules) {
    const desc = rule?.description || '';

    // Base top-level (Hyper + X)
    if (desc.startsWith('Hyper Key + ')) {
      const key = desc.replace('Hyper Key + ', '');
      const firstManip = rule?.manipulators?.[0];
      if (isFallbackManipulator(firstManip)) {
        baseFallback.add(key);
      } else {
        baseCustom[key] = {
          description: firstManip?.description,
          detail: firstManip?.to || firstManip,
        };
      }
    }

    // Sublayers
    if (desc.startsWith('Hyper Key sublayer "')) {
      const key = (desc.match(/Hyper Key sublayer \"(.+?)\"/)?.[1]) || '';
      if (!key) continue;
      sublayerKeys.add(key);
      const manips = Array.isArray(rule?.manipulators) ? rule.manipulators : [];
      const first = manips[0];
      const title = first?.to?.find(t => t?.set_notification_message)?.set_notification_message?.text;

      const cmds = [];
      for (let i = 1; i < manips.length; i++) {
        const m = manips[i];
        const fromKey = m?.from?.key_code;
        if (!fromKey) continue;
        cmds.push({ key: fromKey, description: m?.description, detail: m?.to || m });
      }
      layers[key] = { title, commands: cmds };
    }
  }

  // Clean up fallback keys if they are actually custom or sublayer anchors
  for (const k of Object.keys(baseCustom)) baseFallback.delete(k);
  for (const k of sublayerKeys) baseFallback.delete(k);

  const seenKeys = new Set();
  for (const rule of rules) {
    for (const manip of rule?.manipulators || []) {
      const fk = manip?.from?.key_code;
      if (fk) seenKeys.add(fk);
    }
  }

  return {
    base: {
      sublayerKeys: Array.from(sublayerKeys).sort(),
      customKeys: Object.keys(baseCustom).sort().map(k => ({ key: k, description: baseCustom[k].description, detail: baseCustom[k].detail })),
      fallbackKeys: Array.from(baseFallback).sort(),
    },
    layers,
    stats: {
      totalBaseCustom: Object.keys(baseCustom).length,
      totalBaseFallback: baseFallback.size,
      totalSublayers: sublayerKeys.size,
      seenBaseKeys: Array.from(seenKeys).sort(),
    }
  };
}

export { analyze };
