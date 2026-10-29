/**
 * Diagonal screen-space wipe used by every "Phalanx AI" scan transition.
 * Verbatim from the shipped terrain/grid/fire shaders.
 */
export const computeScreenUv = /* glsl */ `
vec2 computeScreenUv() {
    vec2 screenUv = gl_FragCoord.xy / uResolution;
    screenUv = (screenUv - 0.5) / sqrt(2.0) + 0.5;
    vec2 center = vec2(0.5);
    float angle = radians(5.0 * 45.0);
    vec2 rotatedUv;
    rotatedUv.x = cos(angle) * (screenUv.x - center.x) - sin(angle) * (screenUv.y - center.y) + center.x;
    rotatedUv.y = sin(angle) * (screenUv.x - center.x) + cos(angle) * (screenUv.y - center.y) + center.y;
    return rotatedUv;
}
`;

export const gridFunctions = /* glsl */ `
vec2 getGrid(in vec2 uv, vec2 lineWidth) {
    vec2 ddx = dFdx(uv);
    vec2 ddy = dFdy(uv);
    vec2 uvDeriv = vec2(length(vec2(ddx.x, ddy.x)), length(vec2(ddx.y, ddy.y)));
    bool invertLineX = lineWidth.x > 0.5;
    bool invertLineY = lineWidth.y > 0.5;
    vec2 targetWidth = vec2(invertLineX ? 1.0 - lineWidth.x : lineWidth.x, invertLineY ? 1.0 - lineWidth.y : lineWidth.y);
    vec2 drawWidth = clamp(targetWidth, uvDeriv, vec2(0.5));
    vec2 lineAA = uvDeriv * 1.5;
    vec2 gridUV = abs(fract(uv) * 2.0 - 1.0);
    gridUV.x = invertLineX ? gridUV.x : 1.0 - gridUV.x;
    gridUV.y = invertLineY ? gridUV.y : 1.0 - gridUV.y;
    vec2 grid2 = smoothstep(drawWidth + lineAA, drawWidth - lineAA, gridUV);
    grid2 *= clamp(targetWidth / drawWidth, 0.0, 1.0);
    grid2 = mix(grid2, targetWidth, clamp(uvDeriv * 2.0 - 1.0, 0.0, 1.0));
    grid2.x = invertLineX ? 1.0 - grid2.x : grid2.x;
    grid2.y = invertLineY ? 1.0 - grid2.y : grid2.y;
    return grid2;
}
`;
