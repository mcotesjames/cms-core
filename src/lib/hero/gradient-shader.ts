// Ported from the original theme's src/js/gradient-bg.js.
export const gradientFragmentShader = /* glsl */ `
        uniform float uTime;
        uniform vec2  uResolution;
        uniform vec3  uColor1;
        uniform vec3  uColor2;
        uniform vec3  uColor3;
        uniform vec3  uColor4;
        uniform vec3  uColor5;
        uniform vec3  uColor6;
        uniform float uSpeed;
        uniform sampler2D uTouchTexture;
        uniform vec3  uDarkNavy;
        uniform float uGradientSize;
        uniform float uColor1Weight;
        uniform float uColor2Weight;

        varying vec2 vUv;

        vec3 getGradientColor(vec2 uv, float time) {
          float r = uGradientSize;

          vec2 c1 = vec2(0.5 + sin(time*uSpeed*0.40 + 0.68)*0.40, 0.5 + cos(time*uSpeed*0.50 + 0.90)*0.40);
          vec2 c2 = vec2(0.5 + cos(time*uSpeed*0.60 + 2.21)*0.50, 0.5 + sin(time*uSpeed*0.45 - 0.64)*0.50);
          vec2 c3 = vec2(0.5 + sin(time*uSpeed*0.35 + 0.73)*0.45, 0.5 + cos(time*uSpeed*0.55 + 2.16)*0.45);
          vec2 c4 = vec2(0.5 + cos(time*uSpeed*0.50 + 2.42)*0.40, 0.5 + sin(time*uSpeed*0.40 + 0.85)*0.40);
          vec2 c5 = vec2(0.5 + sin(time*uSpeed*0.70 + 3.92)*0.35, 0.5 + cos(time*uSpeed*0.60 + 0.78)*0.35);
          vec2 c6 = vec2(0.5 + cos(time*uSpeed*0.45 + 1.05)*0.50, 0.5 + sin(time*uSpeed*0.65 - 0.52)*0.50);

          float i1 = 1.0 - smoothstep(0.0, r, length(uv - c1));
          float i2 = 1.0 - smoothstep(0.0, r, length(uv - c2));
          float i3 = 1.0 - smoothstep(0.0, r, length(uv - c3));
          float i4 = 1.0 - smoothstep(0.0, r, length(uv - c4));
          float i5 = 1.0 - smoothstep(0.0, r, length(uv - c5));
          float i6 = 1.0 - smoothstep(0.0, r, length(uv - c6));

          float sharpen = 3.0;
          float w1 = pow(i1, sharpen) * (0.9 + 0.1*sin(time*uSpeed*1.0)) * uColor1Weight;
          float w2 = pow(i2, sharpen) * (0.9 + 0.1*cos(time*uSpeed*1.2)) * uColor2Weight;
          float w3 = pow(i3, sharpen) * (0.9 + 0.1*sin(time*uSpeed*0.8)) * uColor1Weight;
          float w4 = pow(i4, sharpen) * (0.9 + 0.1*cos(time*uSpeed*1.3)) * uColor2Weight;
          float w5 = pow(i5, sharpen) * (0.9 + 0.1*sin(time*uSpeed*1.1)) * uColor1Weight;
          float w6 = pow(i6, sharpen) * (0.9 + 0.1*cos(time*uSpeed*0.9)) * uColor2Weight;

          float totalW = w1 + w2 + w3 + w4 + w5 + w6;
          vec3 color = (uColor1*w1 + uColor2*w2 + uColor3*w3 + uColor4*w4 + uColor5*w5 + uColor6*w6)
                       / max(totalW, 0.0001);

          float coverage = clamp(totalW * 4.0, 0.0, 1.0);
          color = mix(uDarkNavy, color, coverage);

          return clamp(pow(color, vec3(0.95)), vec3(0.0), vec3(1.0));
        }

        void main() {
          vec2 uv = vUv;

          vec4 touch = texture2D(uTouchTexture, uv);
          float vx = -(touch.r * 2.0 - 1.0);
          float vy = -(touch.g * 2.0 - 1.0);
          float intensity = touch.b;
          uv.x += vx * 0.35 * intensity;
          uv.y += vy * 0.35 * intensity;

          float dist = length(uv - vec2(0.5));
          uv += vec2(
            sin(dist * 20.0 - uTime * 3.0) * 0.02 * intensity +
            sin(dist * 15.0 - uTime * 2.0) * 0.015 * intensity
          );

          gl_FragColor = vec4(getGradientColor(uv, uTime), 1.0);
        }
      `;
