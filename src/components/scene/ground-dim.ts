/**
 * Black overlay between the terrain and the cloud wisps (user, 2026-11-02: "add a black overlay below the clouds and
 * above the terrain so it is a little less evident"). 0..1 opacity, multiplied onto the terrain's final colour (fog
 * included), so it behaves like a black layer under the clouds. Written by CloudWisps with its own strength.
 * (The drone shadow on the terrain and clouds that lived beside it was removed, user 2026-11-03.)
 */
export const groundDimUniforms = { uGroundDim: { value: 0 } };
