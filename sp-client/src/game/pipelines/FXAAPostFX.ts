/**
 * FXAA Post FX Pipeline for Phaser 3.
 *
 * Applies Fast Approximate Anti-Aliasing as a fullscreen post-process to smooth
 * jagged edges produced by upscaled rendering.
 */

const FXAA_FRAG = `
#define SHADER_NAME FXAA_FS
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 uResolution;

varying vec2 outTexCoord;

void main() {
    vec2 inverseResolution = 1.0 / uResolution;

    vec3 rgbNW = texture2D(uMainSampler, outTexCoord + vec2(-1.0, -1.0) * inverseResolution).rgb;
    vec3 rgbNE = texture2D(uMainSampler, outTexCoord + vec2(1.0, -1.0) * inverseResolution).rgb;
    vec3 rgbSW = texture2D(uMainSampler, outTexCoord + vec2(-1.0, 1.0) * inverseResolution).rgb;
    vec3 rgbSE = texture2D(uMainSampler, outTexCoord + vec2(1.0, 1.0) * inverseResolution).rgb;
    vec3 rgbM = texture2D(uMainSampler, outTexCoord).rgb;

    vec3 luma = vec3(0.299, 0.587, 0.114);
    float lumaNW = dot(rgbNW, luma);
    float lumaNE = dot(rgbNE, luma);
    float lumaSW = dot(rgbSW, luma);
    float lumaSE = dot(rgbSE, luma);
    float lumaM = dot(rgbM, luma);

    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

    vec2 dir;
    dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
    dir.y = (lumaNW + lumaSW) - (lumaNE + lumaSE);

    float dirReduce = max(
        (lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * (1.0 / 8.0)),
        1.0 / 128.0
    );
    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);

    dir = clamp(dir * rcpDirMin, vec2(-8.0), vec2(8.0)) * inverseResolution;

    vec3 rgbA = 0.5 * (
        texture2D(uMainSampler, outTexCoord + dir * (1.0 / 3.0 - 0.5)).rgb +
        texture2D(uMainSampler, outTexCoord + dir * (2.0 / 3.0 - 0.5)).rgb
    );

    vec3 rgbB = rgbA * 0.5 + 0.25 * (
        texture2D(uMainSampler, outTexCoord + dir * -0.5).rgb +
        texture2D(uMainSampler, outTexCoord + dir * 0.5).rgb
    );

    float lumaB = dot(rgbB, luma);

    if (lumaB < lumaMin || lumaB > lumaMax) {
        gl_FragColor = vec4(rgbA, 1.0);
    } else {
        gl_FragColor = vec4(rgbB, 1.0);
    }
}
`;

export class FXAAPostFX extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    public constructor(game: Phaser.Game) {
        super({
            game,
            name: 'FXAAPostFX',
            fragShader: FXAA_FRAG
        });
    }

    public bootFX(): void {
        super.bootFX();
        this.updateUniforms();
    }

    public onPreRender(): void {
        this.updateUniforms();
    }

    private updateUniforms(): void {
        this.set2f('uResolution', this.renderer.width, this.renderer.height);
    }
}
