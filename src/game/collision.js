// Hitboxes are ellipses half as tall as they are wide (the street is seen at an
// angle), shrunk by `scale` so near misses feel fair.
function hitbox(u, scale) {
  return { cx: u.x, cy: u.y - u.r * 0.25, rx: u.r * scale, ry: u.r * 0.5 * scale };
}

// Squared normalised distance between two hitboxes: < 1 means they touch.
export function overlapRatio(a, b, scale) {
  const ha = hitbox(a, scale);
  const hb = hitbox(b, scale);
  const dx = (ha.cx - hb.cx) / (ha.rx + hb.rx);
  const dy = (ha.cy - hb.cy) / (ha.ry + hb.ry);
  return dx * dx + dy * dy;
}

export function umbrellasOverlap(a, b, scale) {
  return overlapRatio(a, b, scale) < 1;
}
