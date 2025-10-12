//src: https://godotshaders.com/shader/background-blur-with-tint/

shader_type canvas_item;

uniform sampler2D screen_texture : hint_screen_texture, filter_linear_mipmap;

uniform int samples = 35;
uniform int lod = 2;
uniform vec4 tint_color : source_color = vec4(0.0, 0.0, 0.0, 0.0);

float gaussian(vec2 i, float sigma) {
	return exp(-0.5 * dot(i /= sigma, i)) / (6.28 * sigma * sigma);
}

vec4 blur(sampler2D text, vec2 uv, vec2 pixel_size) {
	vec4 original_color = vec4(0.0);

	// the spread of the blur based on the number of samples.
	float sigma = float(samples) * 0.25;

	int sLOD = 1 << lod;
	int s = samples / sLOD;

	for (int i = 0; i < s * s; i++) {
		vec2 offset = vec2(float(i % s), float(i / s)) * float(sLOD) - float(samples) / 2.0;

		// Accumulate the color from the texture at the calculated offset
		// weighted by the gaussian function
		original_color += gaussian(offset, sigma) * textureLod(text, uv + pixel_size * offset, float(lod));
	}

	// Normalize the final color by the accumulated alpha to prevent darkening + a check to prevent division by zero if fully transparent
	return original_color.a > 0.0 ? original_color / original_color.a : vec4(0.0);
}

void fragment() {
	vec4 blurred_color = blur(screen_texture, SCREEN_UV, SCREEN_PIXEL_SIZE);
	vec3 mixed_rgb = mix(blurred_color.rgb, tint_color.rgb, tint_color.a);
	COLOR = vec4(mixed_rgb, blurred_color.a);
}
