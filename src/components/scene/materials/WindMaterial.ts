import * as THREE from "three";

/** Animated airflow sprite-sheet on the USAvionix_Air mesh (shipped class `tI`). */
export class WindMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: /* glsl */ `
uniform sampler2D uWindTexture;
uniform float uTime;
uniform float uSpeed;
uniform float uFramesPerRow;
uniform float uAlpha;
varying vec2 vUv;
void main() {
    float totalFrames = uFramesPerRow * uFramesPerRow;
    float frameIndex = mod(floor(uTime * uSpeed), totalFrames);
    float row = floor(frameIndex / uFramesPerRow);
    float col = mod(frameIndex, uFramesPerRow);
    vec2 frameSize = vec2(1.0 / uFramesPerRow);
    float flippedRow = uFramesPerRow - 1.0 - row;
    vec2 frameOffset = vec2(col, flippedRow) * frameSize;
    vec2 frameUv = vUv * frameSize + frameOffset;
    vec2 rotatedUv = vec2(1.0) - frameUv;
    vec4 color = texture2D(uWindTexture, rotatedUv);
    gl_FragColor = color;
    gl_FragColor.a *= uAlpha;
}`,
      uniforms: {
        uWindTexture: { value: null },
        uTime: { value: 0 },
        uSpeed: { value: 60 },
        uFramesPerRow: { value: 8 },
        uAlpha: { value: 0.2 },
      },
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }

  set windTexture(t: THREE.Texture | null) {
    this.uniforms.uWindTexture.value = t;
    if (t) {
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = 4;
    }
  }
  set time(v: number) {
    this.uniforms.uTime.value = -v;
  }
  set alpha(v: number) {
    this.uniforms.uAlpha.value = v;
  }
}
